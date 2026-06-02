// @ts-nocheck
import { getSketch } from '$lib/sketches';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load = ({ params }: Parameters<PageLoad>[0]) => {
  const sketch = getSketch(params.slug);
  if (!sketch) error(404, `Sketch "${params.slug}" not found`);
  return { sketch };
};
