import type { Sketch } from '$lib/types';

const sketches: Sketch[] = [];

export default sketches;

export function getSketch(slug: string): Sketch | undefined {
  return sketches.find((s) => s.meta.slug === slug);
}
