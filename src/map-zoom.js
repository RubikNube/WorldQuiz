// Adapted from BayernQuiz (GPL-3.0-or-later).
const MAX_ZOOM = 32;
const STEP = 1.25;
const DRAG_THRESHOLD = 8;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Fit the entire square source map into any viewport without stretching it.
export function fitMapBounds(source, aspectRatio) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return { ...source };
  const width = Math.max(source.width, source.height * aspectRatio);
  const height = Math.max(source.height, source.width / aspectRatio);
  return {
    x: source.x - (width - source.width) / 2,
    y: source.y - (height - source.height) / 2,
    width,
    height,
  };
}

export function constrainView(view, bounds) {
  const width = clamp(view.width, bounds.width / MAX_ZOOM, bounds.width);
  const height = width * bounds.height / bounds.width;
  return {
    x: clamp(view.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(view.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

// Anchor fractions describe a position in the visible viewport, not in map data.
export function zoomView(view, bounds, factor, anchor = { x: 0.5, y: 0.5 }) {
  const width = clamp(view.width / factor, bounds.width / MAX_ZOOM, bounds.width);
  const height = width * bounds.height / bounds.width;
  return constrainView({
    x: view.x + (view.width - width) * anchor.x,
    y: view.y + (view.height - height) * anchor.y,
    width,
    height,
  }, bounds);
}

export function panView(view, bounds, dx, dy) {
  return constrainView({ ...view, x: view.x + dx, y: view.y + dy }, bounds);
}

export function revealView(view, bounds, box, padding = 8) {
  // For a feature larger than the viewport, reveal its center rather than
  // jumping to a distant edge of a long river or a large region.
  const revealAxis = (start, size, featureStart, featureSize) => {
    if (featureSize + 2 * padding > size) {
      const center = featureStart + featureSize / 2;
      return center < start + padding || center > start + size - padding ? center - size / 2 : start;
    }
    if (featureStart - padding < start) return featureStart - padding;
    if (featureStart + featureSize + padding > start + size) return featureStart + featureSize + padding - size;
    return start;
  };
  return constrainView({
    ...view,
    x: revealAxis(view.x, view.width, box.x, box.width),
    y: revealAxis(view.y, view.height, box.y, box.height),
  }, bounds);
}

export function isDrag(start, current) {
  return Math.hypot(current.x - start.x, current.y - start.y) > DRAG_THRESHOLD;
}

const point = (event) => ({ x: event.clientX, y: event.clientY });
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createMapZoom({ svg, host, zoomIn, zoomOut, resetButton, percentage }) {
  const original = svg.viewBox.baseVal;
  const sourceBounds = { x: original.x, y: original.y, width: original.width, height: original.height };
  const viewport = svg.getBoundingClientRect();
  let bounds = fitMapBounds(sourceBounds, viewport.width / viewport.height);
  let view = { ...bounds };
  let gesture = null;
  let pointerId = null;
  let suppressClickUntil = 0;
  const listeners = new AbortController();
  const on = (target, type, handler, options = {}) => target.addEventListener(type, handler, { ...options, signal: listeners.signal });

  function render(next) {
    view = constrainView(next, bounds);
    const zoom = bounds.width / view.width;
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    host.classList.toggle("mapHost--zoomed", zoom > 1);
    zoomIn.disabled = zoom >= MAX_ZOOM;
    zoomOut.disabled = zoom <= 1;
    resetButton.disabled = zoom <= 1;
    percentage.textContent = `${Math.round(zoom * 100)} %`;
    svg.dispatchEvent(new CustomEvent('viewchange', { detail: { ...view } }));
  }

  function anchorAt(position) {
    const rect = svg.getBoundingClientRect();
    return { x: (position.x - rect.left) / rect.width, y: (position.y - rect.top) / rect.height };
  }

  function blockClick() {
    suppressClickUntil = performance.now() + 700;
  }

  function clearGesture() {
    if (gesture?.moved) blockClick();
    gesture = null;
    const capturedPointer = pointerId;
    pointerId = null;
    if (capturedPointer !== null && svg.hasPointerCapture(capturedPointer)) svg.releasePointerCapture(capturedPointer);
    host.classList.remove("mapHost--dragging");
  }

  function begin(points, moved = false) {
    const center = points.length > 1 ? midpoint(points[0], points[1]) : points[0];
    gesture = {
      start: center,
      view: { ...view },
      rect: svg.getBoundingClientRect(),
      anchor: anchorAt(center),
      distance: points.length > 1 ? distance(points[0], points[1]) : null,
      moved: moved || points.length > 1,
    };
  }

  function move(points) {
    if (!gesture) return;
    const center = points.length > 1 ? midpoint(points[0], points[1]) : points[0];
    gesture.moved ||= isDrag(gesture.start, center) || points.length > 1;
    if (!gesture.moved) return;
    let next = gesture.view;
    if (gesture.distance !== null && points.length > 1) {
      const factor = distance(points[0], points[1]) / Math.max(gesture.distance, 1);
      next = zoomView(next, bounds, Math.max(factor, 0.001), gesture.anchor);
    }
    render(panView(next, bounds,
      (gesture.start.x - center.x) * next.width / gesture.rect.width,
      (gesture.start.y - center.y) * next.height / gesture.rect.height));
    host.classList.add("mapHost--dragging");
  }

  function reset() {
    clearGesture();
    render(bounds);
  }

  on(zoomIn, "click", () => render(zoomView(view, bounds, STEP)));
  on(zoomOut, "click", () => render(zoomView(view, bounds, 1 / STEP)));
  on(resetButton, "click", reset);

  // Capture before the game's delegated click listener. Keyboard activation
  // (detail === 0) must remain available immediately after a gesture.
  on(host, "click", (event) => {
    if (event.detail && (gesture?.moved || performance.now() < suppressClickUntil)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  on(svg, "pointerdown", (event) => {
    if (event.pointerType === "touch" || event.button !== 0 || !event.isPrimary) return;
    suppressClickUntil = 0;
    begin([point(event)]);
    pointerId = event.pointerId;
  });
  on(window, "pointermove", (event) => {
    if (event.pointerId !== pointerId || !gesture) return;
    if (isDrag(gesture.start, point(event))) {
      // Capture only once dragging starts, so normal clicks keep their target.
      if (!svg.hasPointerCapture(pointerId)) svg.setPointerCapture(pointerId);
      event.preventDefault();
    }
    move([point(event)]);
  });
  on(window, "pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    move([point(event)]);
    clearGesture();
  });
  on(svg, "pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    blockClick();
    clearGesture();
  });
  on(svg, "lostpointercapture", (event) => {
    // Touch capture is implicit and can end while another finger still pans.
    if (event.pointerId === pointerId) clearGesture();
  });

  // Conditional cancellation keeps native page scrolling at full-map view.
  // Do not use touch-action:none: it would also disable that native scrolling.
  const touches = (event) => Array.from(event.touches, point).slice(0, 2);
  let touchActive = false;
  let touchOwned = false;
  on(svg, "touchstart", (event) => {
    const points = touches(event);
    if (!touchActive) suppressClickUntil = 0;
    const moved = touchActive && gesture?.moved;
    touchActive = true;
    touchOwned ||= points.length > 1 || view.width < bounds.width;
    begin(points, moved);
    // Single taps must retain native click/focus behavior, even when zoomed.
    if (points.length > 1 && event.cancelable) event.preventDefault();
  }, { passive: false });
  on(svg, "touchmove", (event) => {
    if (!touchActive || !gesture) return;
    const points = touches(event);
    if (touchOwned) {
      if (event.cancelable) event.preventDefault();
      move(points);
    } else {
      gesture.moved ||= isDrag(gesture.start, points[0]);
    }
  }, { passive: false });
  on(svg, "touchend", (event) => {
    if (!touchActive) return;
    // Rebase when a finger lifts so the remaining finger never causes a jump.
    if (event.touches.length) {
      begin(touches(event), gesture?.moved);
    } else {
      clearGesture();
      touchActive = false;
      touchOwned = false;
    }
  });
  on(svg, "touchcancel", () => {
    blockClick();
    clearGesture();
    touchActive = false;
    touchOwned = false;
  });

  on(svg, "wheel", (event) => {
    if (event.ctrlKey || event.metaKey || !event.deltaY || gesture) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1;
    const factor = Math.exp(-clamp(event.deltaY * unit, -100, 100) * 0.0025);
    const next = zoomView(view, bounds, factor, anchorAt(point(event)));
    if (next.width === view.width) return;
    event.preventDefault();
    render(next);
  }, { passive: false });

  on(host, "keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const pans = {
      ArrowLeft: [-view.width * 0.15, 0], ArrowRight: [view.width * 0.15, 0],
      ArrowUp: [0, -view.height * 0.15], ArrowDown: [0, view.height * 0.15],
    };
    if (event.key === "+" || event.key === "=") render(zoomView(view, bounds, STEP));
    else if (event.key === "-") render(zoomView(view, bounds, 1 / STEP));
    else if (event.key === "Home") reset();
    else if (pans[event.key] && view.width < bounds.width) render(panView(view, bounds, ...pans[event.key]));
    else return;
    event.preventDefault();
  });
  on(host, "focusin", (event) => {
    const feature = event.target.closest('[data-country], [data-river], [data-mountain]');
    if (feature) {
      const x = Number(feature.dataset.anchorX), y = Number(feature.dataset.anchorY);
      render(revealView(view, bounds, {x, y, width: 0, height: 0}, view.width * 0.03));
    }
  });

  function cancel() {
    if (gesture) blockClick();
    clearGesture();
    touchActive = false;
    touchOwned = false;
  }
  const resizeObserver = new ResizeObserver(() => {
    const rect = svg.getBoundingClientRect();
    const nextBounds = fitMapBounds(sourceBounds, rect.width / rect.height);
    if (nextBounds.width === bounds.width && nextBounds.height === bounds.height) return;
    cancel();
    const zoom = bounds.width / view.width;
    const center = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
    bounds = nextBounds;
    render(zoom <= 1 ? bounds : {
      x: center.x - bounds.width / zoom / 2,
      y: center.y - bounds.height / zoom / 2,
      width: bounds.width / zoom,
    });
  });
  resizeObserver.observe(svg);
  on(window, "blur", cancel);
  on(window, "resize", cancel);
  on(svg, "dragstart", (event) => event.preventDefault());
  render(view);

  return { reset, fit(box) {
    clearGesture();
    const width = Math.max(box.width * 1.15, box.height * 1.15 * bounds.width / bounds.height, bounds.width / MAX_ZOOM);
    render({ x: box.x + box.width / 2 - width / 2, y: box.y + box.height / 2 - width * bounds.height / bounds.width / 2, width });
  }, revealPoint([x, y]) {
    render(revealView(view, bounds, {x, y, width: 0, height: 0}, view.width * 0.03));
  }, destroy() { resizeObserver.disconnect(); cancel(); listeners.abort(); } };
}
