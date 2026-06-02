<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    mount: (canvas: HTMLCanvasElement) => () => void;
  }

  let { mount }: Props = $props();

  let canvasEl: HTMLCanvasElement;

  onMount(() => {
    const resize = () => {
      canvasEl.width = canvasEl.clientWidth * devicePixelRatio;
      canvasEl.height = canvasEl.clientHeight * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvasEl);

    const cleanup = mount(canvasEl);

    return () => {
      cleanup();
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvasEl}></canvas>

<style>
  canvas {
    width: 100%;
    height: 100%;
  }
</style>
