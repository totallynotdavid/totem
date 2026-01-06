import type { PageServerLoad } from "./$types";
import { fetchBackend } from "$lib/utils/server-fetch";

export const load: PageServerLoad = async ({ cookies, url }) => {
  const sessionToken = cookies.get("session");
  if (!sessionToken) {
    return { products: [], periods: [], activePeriod: null };
  }

  const headers = { cookie: `session=${sessionToken}` };

  try {
    // Load periods
    const periodsRes = await fetchBackend("/api/periods", { headers });
    const periods = periodsRes.ok ? await periodsRes.json() : [];

    // Get selected period from URL or use active period
    const selectedPeriodId = url.searchParams.get("period");
    let activePeriod =
      periods.find((p: any) => p.status === "active") || periods[0] || null;

    if (selectedPeriodId) {
      const selected = periods.find((p: any) => p.id === selectedPeriodId);
      if (selected) activePeriod = selected;
    }

    // Load products for the selected period
    let products: any[] = [];
    if (activePeriod) {
      const productsRes = await fetchBackend(
        `/api/catalog?period_id=${activePeriod.id}`,
        { headers },
      );
      products = productsRes.ok ? await productsRes.json() : [];
    }

    return { products, periods, activePeriod };
  } catch {
    return { products: [], periods: [], activePeriod: null };
  }
};
