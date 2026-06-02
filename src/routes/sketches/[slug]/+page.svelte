<script lang="ts">
  import Canvas from '$lib/components/Canvas.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const sketch = $derived(data.sketch);
</script>

<svelte:head>
  <title>{sketch.meta.title} — WILLSAMOSIR</title>
</svelte:head>

<div class="layout">
  <nav><a href="/">← WILLSAMOSIR</a></nav>
  <div class="canvas-wrap">
    <Canvas mount={sketch.mount} />
  </div>

  <div class="info-bar">
    <span class="title">{sketch.meta.title}</span>
    <span class="meta">{sketch.meta.date} · {sketch.meta.tags.join(', ')}</span>
    {#if sketch.meta.description}
      <p class="description">{sketch.meta.description}</p>
    {/if}
  </div>
</div>

<style>
  .layout {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    padding: var(--gap);
    gap: var(--gap);
  }

  .canvas-wrap {
    flex: 1;
    border: 1px solid #1a1a1a;
    border-radius: var(--radius);
    overflow: hidden;
    min-height: 0;
  }

  .info-bar {
    display: flex;
    align-items: baseline;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  nav a {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    color: var(--muted);
    transition: color 0.15s;
  }

  nav a:hover { color: var(--fg); }

  .title {
    font-size: 0.85rem;
  }

  .meta {
    font-size: 0.72rem;
    color: var(--muted);
  }

  .description {
    font-size: 0.72rem;
    color: var(--muted);
    width: 100%;
    max-width: 60ch;
  }
</style>
