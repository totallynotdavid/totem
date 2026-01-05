import type { PageServerLoad } from "./$types";
import { fetchBackend } from "$lib/utils/server-fetch";

export const load: PageServerLoad = async ({ cookies }) => {
  const sessionToken = cookies.get("session");
  if (!sessionToken) {
    return { conversations: [] };
  }

  try {
    const response = await fetchBackend("/api/conversations", {
      headers: { cookie: `session=${sessionToken}` },
    });

    if (response.ok) {
      return { conversations: await response.json() };
    }
  } catch {}

  return { conversations: [] };
};
