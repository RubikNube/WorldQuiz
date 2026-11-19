// Compare summit anchors in screen coordinates, including when the map is zoomed.
export function nearestMountain(svg, clientX, clientY, fallback) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return fallback;
  let nearest = fallback, best = Infinity;
  for (const node of svg.querySelectorAll('[data-mountain]')) {
    const point = new DOMPoint(Number(node.dataset.anchorX), Number(node.dataset.anchorY)).matrixTransform(matrix);
    const distance = Math.hypot(clientX - point.x, clientY - point.y);
    if (distance < best || (distance === best && node === fallback)) {
      best = distance;
      nearest = node;
    }
  }
  return nearest;
}
