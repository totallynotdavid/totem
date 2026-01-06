<script lang="ts">
import type { CatalogPeriod } from "@totem/types";

type Props = {
  periods: CatalogPeriod[];
  selected: CatalogPeriod | null;
  onSelect: (period: CatalogPeriod) => void;
};

let { periods, selected, onSelect }: Props = $props();

function getStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Borrador";
    case "active":
      return "Activo";
    case "archived":
      return "Archivado";
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "draft":
      return "text-amber-600";
    case "active":
      return "text-green-600";
    case "archived":
      return "text-ink-400";
    default:
      return "text-ink-600";
  }
}
</script>

<div class="relative">
  <select
    class="appearance-none bg-white border border-ink-200 px-4 py-2 pr-10 text-sm focus:outline-none focus:border-ink-400 cursor-pointer"
    value={selected?.id || ""}
    onchange={(e) => {
      const period = periods.find(p => p.id === e.currentTarget.value);
      if (period) onSelect(period);
    }}
  >
    {#each periods as period}
      <option value={period.id}>
        {period.name} ({getStatusLabel(period.status)})
      </option>
    {/each}
  </select>
  <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
    <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </div>
</div>

{#if selected}
  <span class="text-xs {getStatusColor(selected.status)} ml-2">
    {getStatusLabel(selected.status)}
  </span>
{/if}
