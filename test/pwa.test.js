import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOfflineWorker } from "../scripts/build-pwa.mjs";

async function bundle(t) {
  const directory = await mkdtemp(join(tmpdir(), "worldquiz-pwa-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL("../src/", import.meta.url), directory, { recursive: true });
  await cp(new URL("../assets/", import.meta.url), join(directory, "assets"), { recursive: true });
  await cp(new URL("../LICENSE", import.meta.url), join(directory, "LICENSE"));
  await cp(new URL("../ATTRIBUTION.md", import.meta.url), join(directory, "ATTRIBUTION.md"));
  return directory;
}

test("manifest and PNG icons support root and subdirectory installation", async () => {
  const manifest = JSON.parse(await readFile(new URL("../src/manifest.webmanifest", import.meta.url)));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "de");
  for (const base of ["https://example.org/", "https://example.org/WorldQuiz/"]) {
    for (const field of ["id", "scope", "start_url"]) assert.equal(new URL(manifest[field], base).href, base);
    for (const icon of manifest.icons) {
      assert.ok(new URL(icon.src, base).href.startsWith(base));
      const data = await readFile(new URL(`../src/${icon.src}`, import.meta.url));
      assert.equal(data.subarray(1, 4).toString(), "PNG");
      assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
    }
  }
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable"));
});

test("precache contains the entire bundle and changes only when its inputs change", async t => {
  const directory = await bundle(t);
  const first = await buildOfflineWorker(directory);
  const second = await buildOfflineWorker(directory);
  assert.deepEqual(second, first);
  for (const path of ["index.html", "world.svg", "game.js", "pwa.js", "app.js", "highscores.js", "mistakes.js", "map-zoom.js", "manifest.webmanifest", "LICENSE",
    "assets/flags/de.svg", "assets/data/countries.json", "assets/data/countries-source.json",
    "assets/data/world-source.geojson", "assets/data/ODbL.txt", "ATTRIBUTION.md", "rivers.js",
    "assets/data/rivers.json", "assets/data/rivers-catalog.json", "assets/data/rivers-source.geojson",
    "mountains.js", "assets/data/mountains.json", "assets/data/mountains-catalog.json"]) {
    assert.ok(first.paths.includes(path), path);
  }
  assert.ok(!first.paths.includes("sw.js"));
  await writeFile(join(directory, "world.svg"), "changed map");
  assert.notEqual((await buildOfflineWorker(directory)).version, first.version);
});

async function worker(t, base, failInstall = false) {
  const directory = await bundle(t);
  const { paths, version } = await buildOfflineWorker(directory);
  const handlers = {};
  const stored = new Map();
  const deleted = [];
  const fetched = [];
  let claimed = false;
  const prefix = `worldquiz:${base}:`;
  const cacheName = `${prefix}${version}`;
  stored.set(`${prefix}old`, new Map());
  stored.set("other-app", new Map());
  stored.set("worldquiz:https://example.org/another/:old", new Map());
  vm.runInNewContext(await readFile(join(directory, "sw.js"), "utf8"), {
    URL, Request, Set,
    self: {
      registration: { scope: base },
      clients: { claim: async () => { claimed = true; } },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    caches: {
      open: async name => {
        if (!stored.has(name)) stored.set(name, new Map());
        return {
          addAll: async requests => {
            if (failInstall) throw new Error("download interrupted");
            for (const request of requests) stored.get(name).set(request.url, `cached:${request.url}`);
          },
          match: async key => stored.get(name).get(key),
        };
      },
      keys: async () => [...stored.keys()],
      delete: async name => { deleted.push(name); return stored.delete(name); },
    },
    fetch: async request => { fetched.push(request.url); return "network"; },
  });
  async function lifecycle(name) {
    let completion;
    handlers[name]({ waitUntil: promise => { completion = promise; } });
    await completion;
  }
  async function fetchPath(path, method = "GET") {
    let response;
    handlers.fetch({ request: new Request(new URL(path, base), { method }), respondWith: promise => { response = promise; } });
    return response;
  }
  return { lifecycle, fetchPath, stored, deleted, fetched, paths, cacheName, prefix, claimed: () => claimed };
}

for (const base of ["https://example.org/", "https://example.org/WorldQuiz/"]) {
  test(`offline cache and isolated cleanup at ${base}`, async t => {
    const sw = await worker(t, base);
    await sw.lifecycle("install");
    assert.equal(sw.stored.get(sw.cacheName).size, sw.paths.length);
    assert.equal(sw.claimed(), false);
    await sw.lifecycle("activate");
    assert.equal(sw.claimed(), true);
    assert.deepEqual(sw.deleted, [`${sw.prefix}old`]);
    assert.ok(sw.stored.has("other-app"));
    for (const path of ["./", "./?launch=home", "index.html?launch=home", "world.svg", "assets/flags/de.svg", "assets/data/rivers.json", "rivers.js"]) {
      assert.match(await sw.fetchPath(path), /^cached:/);
    }
    assert.equal(await sw.fetchPath("https://de.wikipedia.org/wiki/Welt"), undefined);
    assert.equal(await sw.fetchPath("missing.html"), undefined);
    assert.equal(await sw.fetchPath("index.html", "POST"), undefined);
    assert.equal(await sw.fetchPath("sw.js"), undefined);
    sw.stored.get(sw.cacheName).delete(new URL("world.svg", base).href);
    assert.equal(await sw.fetchPath("world.svg"), "network");
  });
}

test("failed download discards incomplete cache and keeps the previous version", async t => {
  const sw = await worker(t, "https://example.org/WorldQuiz/", true);
  await assert.rejects(sw.lifecycle("install"), /download interrupted/);
  assert.equal(sw.stored.has(sw.cacheName), false);
  assert.equal(sw.stored.has(`${sw.prefix}old`), true);
  assert.equal(sw.claimed(), false);
});

async function pwaUI({ supported = true, secure = true, standalone = false, rejectRegistration = false } = {}) {
  function target(properties = {}) {
    const listeners = new Map();
    return Object.assign({
      addEventListener(name, listener) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(listener);
      },
      async emit(name, event = {}) {
        for (const listener of listeners.get(name) || []) await listener(event);
      },
    }, properties);
  }
  const install = target({ hidden: true });
  const status = { textContent: "" };
  const display = target({ matches: standalone });
  const worker = target({ state: "installing" });
  const registration = target({ installing: worker, active: null });
  const registrations = [];
  const serviceWorker = target({
    register: async (url, options) => {
      registrations.push({ url: url.href, options });
      if (rejectRegistration) throw Error("registration failed");
      return registration;
    },
  });
  const window = target({ isSecureContext: secure });
  const source = (await readFile(new URL("../src/pwa.js", import.meta.url), "utf8"))
    .replaceAll("import.meta.url", '"https://example.org/WorldQuiz/pwa.js"');
  vm.runInNewContext(source, {
    URL, window, navigator: supported ? { serviceWorker } : {},
    document: { querySelector: selector => selector === "#installApp" ? install : status },
    matchMedia: () => display,
  });
  await new Promise(resolve => setImmediate(resolve));
  return { install, status, display, worker, registration, registrations, serviceWorker, window };
}

test("installation controls handle browser prompts, standalone mode and completed installation", async () => {
  const ui = await pwaUI();
  assert.equal(ui.install.hidden, true);
  let prevented = false;
  let prompted = 0;
  const prompt = {
    preventDefault() { prevented = true; },
    async prompt() { prompted++; },
  };
  await ui.window.emit("beforeinstallprompt", prompt);
  assert.equal(prevented, true);
  assert.equal(ui.install.hidden, false);
  await ui.install.emit("click");
  assert.equal(prompted, 1);
  assert.equal(ui.install.hidden, true);
  await ui.install.emit("click");
  assert.equal(prompted, 1);
  await ui.window.emit("beforeinstallprompt", prompt);
  await ui.window.emit("appinstalled");
  assert.equal(ui.install.hidden, true);
  await ui.install.emit("click");
  assert.equal(prompted, 1);
  await ui.window.emit("beforeinstallprompt", prompt);
  ui.display.matches = true;
  await ui.display.emit("change");
  assert.equal(ui.install.hidden, true);
  await ui.window.emit("beforeinstallprompt", prompt);
  assert.equal(ui.install.hidden, true);
});

test("offline status waits for activation and preserves availability during updates", async () => {
  const ui = await pwaUI();
  assert.equal(ui.registrations[0].url, "https://example.org/WorldQuiz/sw.js");
  assert.equal(ui.registrations[0].options.updateViaCache, "none");
  assert.equal(ui.status.textContent, "Offline noch nicht verfügbar");
  ui.worker.state = "activated";
  ui.registration.active = ui.worker;
  ui.registration.installing = null;
  await ui.worker.emit("statechange");
  assert.equal(ui.status.textContent, "Offline verfügbar");
  await ui.registration.emit("updatefound");
  await ui.serviceWorker.emit("controllerchange");
  assert.equal(ui.status.textContent, "Offline verfügbar");
});

for (const options of [{ supported: false }, { secure: false }, { rejectRegistration: true }]) {
  test(`unavailable offline support is reported: ${JSON.stringify(options)}`, async () => {
    const ui = await pwaUI(options);
    assert.equal(ui.status.textContent, "Offline noch nicht verfügbar");
    assert.equal(ui.install.hidden, true);
    if (!options.rejectRegistration) assert.equal(ui.registrations.length, 0);
  });
}
