<script lang="ts">
import { onMount } from "svelte";
import { goto } from "$app/navigation";
import type { Product, StockStatus, CatalogPeriod } from "@totem/types";
import { auth } from "$lib/state/auth.svelte";
import { catalogSelection } from "$lib/state/catalog.svelte";
import { fetchApi } from "$lib/utils/api";
import PageHeader from "$lib/components/shared/page-header.svelte";
import Button from "$lib/components/ui/button.svelte";
import ProductGrid from "$lib/components/catalog/product-grid.svelte";
import ProductModal from "$lib/components/catalog/product-modal.svelte";
import BulkActionsPanel from "$lib/components/catalog/bulk-actions-panel.svelte";
import PeriodSelector from "$lib/components/catalog/period-selector.svelte";
import PageTitle from "$lib/components/shared/page-title.svelte";
import type { PageData } from "./$types";

let { data }: { data: PageData } = $props();

let localProducts = $state<Product[]>([]);
let localPeriods = $state<CatalogPeriod[]>([]);
let selectedPeriod = $state<CatalogPeriod | null>(null);
let selectedProduct = $state<Product | null>(null);
let showModal = $state(false);

let products = $derived(
  localProducts.length > 0 ? localProducts : data.products,
);

let periods = $derived(localPeriods.length > 0 ? localPeriods : data.periods);

let currentPeriod = $derived(selectedPeriod || data.activePeriod);

let selectedProducts = $derived(
  products.filter((p: Product) => catalogSelection.isSelected(p.id)),
);

let canEdit = $derived(
  auth.canEditCatalog && currentPeriod?.status === "draft",
);

async function loadProducts(periodId?: string) {
  try {
    const pid = periodId || currentPeriod?.id;
    if (!pid) return;

    localProducts = await fetchApi<Product[]>(`/api/catalog?period_id=${pid}`);
    catalogSelection.clear();
  } catch (error) {
    console.error("Failed to load products:", error);
  }
}

async function loadPeriods() {
  try {
    localPeriods = await fetchApi<CatalogPeriod[]>("/api/periods");
  } catch (error) {
    console.error("Failed to load periods:", error);
  }
}

function handlePeriodChange(period: CatalogPeriod) {
  selectedPeriod = period;
  goto(`?period=${period.id}`, { replaceState: true });
  loadProducts(period.id);
}

function handleProductClick(product: Product) {
  if (canEdit) {
    selectedProduct = product;
    showModal = true;
  }
}

function handleStockUpdate(productId: string, newStatus: StockStatus) {
  const product = products.find((p: Product) => p.id === productId);
  if (product) {
    product.stock_status = newStatus;
  }
}

function openCreateModal() {
  selectedProduct = null;
  showModal = true;
}

onMount(() => {
  if (!data.user) {
    window.location.href = "/login";
    return;
  }
  loadPeriods();
  if (data.activePeriod) {
    loadProducts(data.activePeriod.id);
  }
});
</script>

<PageTitle title="Catálogo" />

<div class="max-w-7xl mx-auto p-8 md:p-12 min-h-screen">
	<PageHeader title="Catálogo de productos" subtitle="Inventario">
		{#snippet actions()}
			<PeriodSelector
				{periods}
				selected={currentPeriod}
				onSelect={handlePeriodChange}
			/>
			{#if canEdit}
				<Button onclick={openCreateModal}>Nuevo producto</Button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if currentPeriod?.status !== "draft" && auth.canEditCatalog}
		<div class="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
			Este período está {currentPeriod?.status === "active" ? "activo" : "archivado"}. 
			Los productos no se pueden editar.
		</div>
	{/if}

	{#if !currentPeriod}
		<div class="text-center py-12 text-ink-400">
			No hay períodos de catálogo. Crea uno para comenzar.
		</div>
	{:else}
		<ProductGrid
			{products}
			canEdit={canEdit}
			onProductClick={handleProductClick}
			onStockUpdate={handleStockUpdate}
		/>
	{/if}
</div>

{#if showModal && currentPeriod}
	<ProductModal
		product={selectedProduct}
		periodId={currentPeriod.id}
		open={true}
		onClose={() => showModal = false}
		onSuccess={() => loadProducts()}
	/>
{/if}

{#if catalogSelection.selectedCount > 0 && canEdit}
	<BulkActionsPanel
		{selectedProducts}
		onClose={() => catalogSelection.clear()}
		onSuccess={() => loadProducts()}
	/>
{/if}
