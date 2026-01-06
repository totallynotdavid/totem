<script lang="ts">
import { onMount } from "svelte";
import { fade } from "svelte/transition";
import Button from "$lib/components/ui/button.svelte";
import UserTable from "$lib/components/admin/user-table.svelte";
import { fetchApi } from "$lib/utils/api";

// Only users table logic here
type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  is_active: number;
  created_at: string;
};

let users = $state<User[]>([]);
let loading = $state(true);

async function loadUsers() {
  loading = true;
  try {
    const res = await fetchApi<{ users: User[] }>("/api/admin/users");
    users = res.users;
  } catch (e) {
    console.error(e);
  } finally {
    loading = false;
  }
}

onMount(() => {
  loadUsers();
});
</script>

<div in:fade class="space-y-6">
    <!-- Header with Actions -->
    <div class="flex justify-between items-center bg-white p-6 border border-cream-200">
        <div>
            <h2 class="text-xl font-serif text-ink-900">Usuarios del sistema</h2>
            <p class="text-sm text-ink-500 mt-1">Gestión de accesos y roles del equipo.</p>
        </div>
        <Button href="/dashboard/admin/users/create">
            + Nuevo usuario
        </Button>
    </div>

    <!-- Table -->
    {#if loading}
        <div class="p-12 text-center text-ink-400 animate-pulse">Cargando usuarios...</div>
    {:else}
        <UserTable {users} />
    {/if}
</div>
