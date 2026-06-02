<script lang="ts">
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="site">
  {@render children()}
</div>

<style>
  .site {
    min-height: 100dvh;
    background: #000;
  }
</style>
