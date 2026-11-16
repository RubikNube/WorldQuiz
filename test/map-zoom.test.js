import test from 'node:test';
import assert from 'node:assert/strict';
import { fitMapBounds, zoomView, panView, revealView, isDrag } from '../src/map-zoom.js';

const bounds = { x: 0, y: 0, width: 1200, height: 600 };
test('zoom is limited to 1–32x and stays anchored and bounded', () => {
  const zoom = zoomView(bounds, bounds, 2, { x: 0.25, y: 0.5 });
  assert.deepEqual(zoom, { x: 150, y: 150, width: 600, height: 300 });
  assert.equal(zoomView(bounds, bounds, 100).width, 37.5);
  assert.deepEqual(zoomView(bounds, bounds, 0.1), bounds);
  assert.deepEqual(panView(zoom, bounds, 1e4, -1e4), { x: 600, y: 0, width: 600, height: 300 });
});
test('reveal preserves zoom; mobile fitting retains the entire world', () => {
  const zoom = zoomView(bounds, bounds, 4);
  const revealed = revealView(zoom, bounds, { x: 1000, y: 500, width: 0, height: 0 });
  assert.equal(revealed.width, zoom.width);
  assert.ok(revealed.x <= 1000 && revealed.x + revealed.width >= 1000);
  const mobile = fitMapBounds(bounds, 1);
  assert.equal(mobile.width, mobile.height);
  assert.ok(mobile.x <= 0 && mobile.y <= 0);
  assert.ok(mobile.x + mobile.width >= 1200 && mobile.y + mobile.height >= 600);
});
test('drag threshold distinguishes intentional clicks from map movement', () => {
  assert.equal(isDrag({ x: 0, y: 0 }, { x: 2, y: 3 }), false);
  assert.equal(isDrag({ x: 0, y: 0 }, { x: 10, y: 0 }), true);
});
