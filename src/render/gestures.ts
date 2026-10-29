import { GESTURE, ZOOM } from './config';

export interface GestureHandlers {
  onPan(dx: number, dy: number): void;
  onZoom(factor: number, sx: number, sy: number): void;
  onTap(sx: number, sy: number): void;
}

interface Point {
  x: number;
  y: number;
}

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Traduit les pointer events d'un élément en gestes : glisser à un doigt,
 * pincer à deux doigts, molette, tap. Renvoie une fonction de nettoyage.
 */
export function attachGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
  const pointers = new Map<number, Point>();
  let tap: { id: number; start: Point; time: number } | null = null;

  const local = (event: PointerEvent | WheelEvent): Point => {
    const rect = element.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onDown = (event: PointerEvent) => {
    element.setPointerCapture(event.pointerId);
    const point = local(event);
    pointers.set(event.pointerId, point);
    tap = pointers.size === 1 ? { id: event.pointerId, start: point, time: event.timeStamp } : null;
  };

  const onMove = (event: PointerEvent) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    if (tap && distance(point, tap.start) > GESTURE.tapSlop) tap = null;

    const others = [...pointers.entries()].filter(([id]) => id !== event.pointerId);
    pointers.set(event.pointerId, point);
    const other = others[0]?.[1];

    if (!other) {
      handlers.onPan(point.x - previous.x, point.y - previous.y);
      return;
    }
    // Deux doigts : on suit le milieu, puis on zoome autour de lui.
    const before = midpoint(previous, other);
    const after = midpoint(point, other);
    handlers.onPan(after.x - before.x, after.y - before.y);
    const previousDistance = distance(previous, other);
    if (previousDistance > 0) {
      handlers.onZoom(distance(point, other) / previousDistance, after.x, after.y);
    }
  };

  const onUp = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (
      event.type === 'pointerup' &&
      tap?.id === event.pointerId &&
      event.timeStamp - tap.time <= GESTURE.tapMaxMs
    ) {
      handlers.onTap(tap.start.x, tap.start.y);
    }
    tap = null;
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const point = local(event);
    handlers.onZoom(Math.exp(-event.deltaY * ZOOM.wheelSensitivity), point.x, point.y);
  };

  element.addEventListener('pointerdown', onDown);
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', onUp);
  element.addEventListener('pointercancel', onUp);
  element.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onUp);
    element.removeEventListener('wheel', onWheel);
  };
}
