import { getSketch } from '$lib/sketches';
import sketches from '$lib/sketches';
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageLoad } from './$types';

export const entries: EntryGenerator = () =>
  sketches.map((s) => ({ slug: s.meta.slug }));

export const load: PageLoad = ({ params }) => {
  const sketch = getSketch(params.slug);
  if (!sketch) error(404, `Sketch "${params.slug}" not found`);
  return { sketch };
};
