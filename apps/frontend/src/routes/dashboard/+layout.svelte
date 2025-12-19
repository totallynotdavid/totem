<script lang="ts">
import { user } from "$lib/state.svelte";
import { page } from "$app/state";

let { children } = $props();

let isHomePage = $derived(page.url.pathname === "/dashboard");
</script>

{#if isHomePage}
  {@render children()}
{:else}
  <div class="min-h-screen bg-cream-100 flex flex-col">
    <nav class="border-b border-ink-900/10 bg-cream-50 px-8 py-4 flex justify-between items-center sticky top-0 z-50">
      <a href="/dashboard" class="flex items-center gap-2 group">
        <span class="font-serif font-bold italic text-xl group-hover:text-ink-600 transition-colors">totem</span>
        <span class="text-ink-400 text-sm">/</span>
        <span class="text-xs uppercase tracking-widest font-bold text-ink-400 group-hover:text-ink-900 transition-colors">Volver al inicio</span>
      </a>

      <div class="flex items-center gap-6 text-xs font-mono">
        <span class="text-ink-600">{user.data?.name || user.data?.username} ({user.data?.role})</span>
        <button onclick={() => user.logout()} class="hover:underline text-red-600">
          Salir
        </button>
      </div>
    </nav>

    <main class="flex-1">
      {@render children()}
    </main>
  </div>
{/if}
