<script lang="ts">
type Props = {
  role: string;
};

let { role }: Props = $props();

const permissions: Record<string, { label: string; included: boolean }[]> = {
  admin: [
    { label: "Acceso total al sistema", included: true },
    { label: "Gestión de usuarios", included: true },
    { label: "Ver logs de auditoría", included: true },
    { label: "Configuración global", included: true },
    { label: "Aprobar órdenes (nivel Calidda)", included: true },
    { label: "Simulador de pruebas", included: true },
  ],
  developer: [
    { label: "Gestión de usuarios", included: false },
    { label: "Ver logs de auditoría", included: true },
    { label: "Configuración técnica", included: true },
    { label: "Simulador de pruebas", included: true },
    { label: "Editar catálogo", included: true },
  ],
  supervisor: [
    { label: "Gestión de usuarios", included: false },
    { label: "Aprobar órdenes (Nivel Supervisor)", included: true },
    { label: "Marcar órdenes como entregadas", included: true },
    { label: "Editar catálogo", included: true },
    { label: "Ver reportes y métricas", included: true },
    { label: "Simulador de pruebas", included: false },
  ],
  sales_agent: [
    { label: "Atención de conversaciones", included: true },
    { label: "Ver catálogo (solo lectura)", included: true },
    { label: "Ver órdenes asignadas", included: true },
    { label: "Acceso a reportes", included: false },
    { label: "Modificar inventario", included: false },
  ],
};

const currentPermissions = $derived(permissions[role] || []);
</script>

<div class="mt-4">
  <p class="text-xs font-bold uppercase tracking-widest text-ink-400 mb-3 flex items-center gap-2">
    Capacidades del rol <span class="text-ink-600 border-b border-ink-200">{role}</span>
  </p>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4">
    {#each currentPermissions as perm}
      <div class="flex items-center gap-2 text-sm">
        {#if perm.included}
          <span class="text-green-600 font-bold">✓</span>
          <span class="text-ink-900">{perm.label}</span>
        {:else}
          <span class="text-gray-300">×</span>
          <span class="text-gray-400 line-through decoration-gray-300">{perm.label}</span>
        {/if}
      </div>
    {/each}
  </div>
</div>
