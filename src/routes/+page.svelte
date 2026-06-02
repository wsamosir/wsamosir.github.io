<script lang="ts">
  import WordmarkGL from '$lib/components/WordmarkGL.svelte';
  import sketches from '$lib/sketches';
</script>

<section class="hero">
  <WordmarkGL />
</section>

<section class="gallery">
  <ul class="grid">
    {#each sketches as sketch}
      <li>
        <a href="/sketches/{sketch.meta.slug}">
          <div class="thumb"></div>
          <div class="info">
            <span class="title">{sketch.meta.title}</span>
            <span class="meta">{sketch.meta.date} · {sketch.meta.tags.join(', ')}</span>
          </div>
        </a>
      </li>
    {/each}
  </ul>
</section>

<style>
  .hero {
    width: 100%;
    height: 100dvh;
  }

  .gallery {
    padding: var(--gap);
  }

  .grid {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: var(--gap);
  }

  .grid a {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .grid a:hover .thumb {
    border-color: #333;
  }

  .thumb {
    aspect-ratio: 16 / 9;
    background: #000;
    border: 1px solid #1a1a1a;
    border-radius: var(--radius);
    transition: border-color 0.2s;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .title { font-size: 0.85rem; }

  .meta {
    font-size: 0.72rem;
    color: var(--muted);
  }
</style>
