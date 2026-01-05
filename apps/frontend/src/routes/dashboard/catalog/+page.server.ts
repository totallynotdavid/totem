import type { PageServerLoad } from "./$types";
import { fetchBackend } from "$lib/utils/server-fetch";

export const load: PageServerLoad = async ({ cookies }) => {
  const sessionToken = cookies.get("session");
  if (!sessionToken) {
    return { products: [] };
  }

  try {
    const response = await fetchBackend("/api/catalog", {
      headers: { cookie: `session=${sessionToken}` },
    });

    if (response.ok) {
      return { products: await response.json() };
    }
  } catch {}

  return { products: [] };
};
