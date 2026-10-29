/** Caméra 2D : (x, y) est le point du monde affiché dans le coin haut-gauche de l'écran. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Zones de l'écran couvertes par l'interface (barres), en pixels écran. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ZoomLimits {
  min: number;
  max: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function screenToWorld(camera: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: camera.x + sx / camera.zoom, y: camera.y + sy / camera.zoom };
}

/** Déplace la caméra pour suivre un glissement du doigt de (dx, dy) pixels écran. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x - dx / camera.zoom, y: camera.y - dy / camera.zoom };
}

/** Zoome d'un facteur en gardant fixe le point du monde situé sous (sx, sy). */
export function zoomAt(
  camera: Camera,
  factor: number,
  sx: number,
  sy: number,
  limits: ZoomLimits,
): Camera {
  const zoom = clamp(camera.zoom * factor, limits.min, limits.max);
  const anchor = screenToWorld(camera, sx, sy);
  return { zoom, x: anchor.x - sx / zoom, y: anchor.y - sy / zoom };
}

function clampAxis(
  position: number,
  viewLength: number,
  insetStart: number,
  insetEnd: number,
  worldLength: number,
  zoom: number,
): number {
  // Bord du monde collé au bord de la zone visible (hors barres).
  const min = -insetStart / zoom;
  const max = worldLength - (viewLength - insetEnd) / zoom;
  // Monde plus petit que la zone visible : on le centre.
  if (max < min) return (min + max) / 2;
  return clamp(position, min, max);
}

/** Empêche la carte de sortir de la zone visible entre les barres. */
export function clampCamera(camera: Camera, view: Size, world: Size, insets: Insets): Camera {
  return {
    zoom: camera.zoom,
    x: clampAxis(camera.x, view.width, insets.left, insets.right, world.width, camera.zoom),
    y: clampAxis(camera.y, view.height, insets.top, insets.bottom, world.height, camera.zoom),
  };
}

/** Caméra centrée sur un point du monde, au milieu de la zone visible. */
export function centerOn(wx: number, wy: number, zoom: number, view: Size, insets: Insets): Camera {
  const cx = (insets.left + view.width - insets.right) / 2;
  const cy = (insets.top + view.height - insets.bottom) / 2;
  return { zoom, x: wx - cx / zoom, y: wy - cy / zoom };
}
