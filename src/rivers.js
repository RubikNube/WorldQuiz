// Resolve overlapping wide hit strokes to the nearest actual course.
export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared)) : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

const courses = new WeakMap();
export function nearestRiver(svg, clientX, clientY, fallback) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return fallback;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  if (!courses.has(svg)) {
    courses.set(svg, [...svg.querySelectorAll('[data-river]')].map(node => {
      // Generated paths contain only M/L commands. Keep disconnected sections
      // separate so lake gaps never become imaginary selectable segments.
      const sections = node.querySelector('.river-line').getAttribute('d').split('M').filter(Boolean)
        .map(section => section.split('L').map(pair => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y };
        }));
      return { node, sections };
    }));
  }
  let nearest = fallback, best = Infinity;
  for (const { node, sections } of courses.get(svg)) {
    for (const section of sections) for (let i = 1; i < section.length; i++) {
      const distance = distanceToSegment(point, section[i - 1], section[i]);
      if (distance < best || (distance === best && node === fallback)) {
        best = distance;
        nearest = node;
      }
    }
  }
  return nearest;
}
