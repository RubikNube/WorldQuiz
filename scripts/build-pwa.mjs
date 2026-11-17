import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function buildOfflineWorker(directory) {
  async function files(relative = "") {
    const entries = await readdir(join(directory, relative), { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      return entry.isDirectory() ? files(path) : path === "sw.js" ? [] : [path];
    }));
    return nested.flat().sort();
  }
  const paths = await files();
  const hash = createHash("sha256");
  const template = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");
  hash.update(template);
  for (const path of paths) {
    const contents = await readFile(join(directory, path));
    hash.update(JSON.stringify([path, contents.length]));
    hash.update(contents);
  }
  const version = hash.digest("hex");
  await writeFile(join(directory, "sw.js"), template
    .replace("__PRECACHE_FILES__", JSON.stringify(paths))
    .replace("__BUILD_VERSION__", JSON.stringify(version)));
  return { paths, version };
}
