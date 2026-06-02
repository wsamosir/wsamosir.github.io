export interface SketchMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO date string e.g. "2026-06-01"
  tags: string[];
}

export interface Sketch {
  meta: SketchMeta;
  /** Called once when the sketch page mounts. Return a cleanup function. */
  mount: (canvas: HTMLCanvasElement) => () => void;
}
