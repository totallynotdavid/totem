SVELTE5_RUNES: Compiler directives for fine-grained reactivity (NOT importable
functions).

STATE_MANAGEMENT:

- $state(val): Reactive variable, deep proxies for objects/arrays
  - Example: let count = $state(0); todos[0].done = !todos[0].done
- $derived(expr): Computed state, auto-recalcs on dependency changes
  - Example: let doubled = $derived(count \* 2)
  - Complex: $derived.by(() => { /_ multi-line _/ })
- $state.raw(val): Non-reactive (only reassignment triggers), for large
  immutable data
- $state.snapshot(proxy): Get plain object from proxy (for structuredClone,
  external libs)

EFFECTS_LIFECYCLE:

- $effect(() => {}): Side effects, runs on mount + dependency changes
  - Example: $effect(() => { const id = setInterval(...); return () =>
    clearInterval(id); })
  - Return cleanup function for teardown
- $effect.pre(): Runs before DOM updates (for autoscroll, measurements)
- Lifecycle: Use onMount/onDestroy, NO beforeUpdate/afterUpdate
- SSR-safe: onDestroy runs on server, onMount client-only

PROPS_COMPONENT_COMMUNICATION:

- $props(): Declare component props with TypeScript interfaces
  - Example: interface Props { required: number; optional?: string; onclick: (v:
    string) => void; } let { required, optional = "default", ...rest }: Props =
    $props();
- $bindable(): Two-way binding
  - Child: let { value = $bindable() } = $props()
  - Parent: <Input bind:value />
- NO $$props/$$restProps in runes mode, use let { ...rest } = $props()
- Rename reserved: let { class: className } = $props()

EVENTS: Use callback props, NOT createEventDispatcher

- Child: let { onclick, oninput } = $props() then <button {onclick}> or call
  onclick(data)
- Parent: <Child onclick={(e) => handle(e)} />
- Spread: <button {...props}> auto-forwards all event handlers
- Multiple: <button onclick={(e) => { one(e); two(e); }}>
- Export functions: export function greet() { alert('hi') } then
  <Child bind:this={ref} /> call ref.greet()

SNIPPETS: Replace Slots

- Define: {#snippet name(param)}<span>{param}</span>{/snippet} (supports
  defaults/destructuring)
- Pass: <Child>{#snippet item(d)}<td>{d.name}</td>{/snippet}</Child> (implicit
  prop)
- Render: {@render children?.()} or {#if children}{@render
  children()}{:else}fallback{/if}
- Recursive: {#snippet countdown(n)}{#if n > 0}{@render
  countdown(n-1)}{/if}{/snippet}

DOM_EVENTS:

- Modern syntax: <button onclick={() => count++}> or <button {onclick}>
  (shorthand)
- Window: <svelte:window onkeydown={handler} /> (auto-cleanup)
- Modifiers removed: Use event.preventDefault(), event.stopPropagation()
  directly

DYNAMIC_COMPONENTS:

- Use derived state: const Component = $derived(condition ? A : B);
  <Component />
- Each blocks: {#each items as item}<item.component {...item.props} />{/each}
  (dot notation)

PERFORMANCE:

- Prefer $derived over $effect for computed values
- Anti-pattern: $effect(() => { doubled = count \* 2 })
- Correct: let doubled = $derived(count \* 2)
- Use $state.raw() for large immutable data (only reassignment triggers)

COMMON_ERRORS:

- Cannot use runes in cleanup functions
- Must be in effect root
- No cyclical dependencies
- No state mutation in $derived
- Mutating unbound props (ownership violation)

SVELTEKIT_SSR_PATTERNS: Full-stack framework with file-based routing, SSR by
default.

FILE_TYPES:

- +page.svelte: UI component, receives data via let { data } = $props()
- +page.js: Universal load (runs server + client) Has: fetch, params, url,
  parent, depends
- +page.server.js: Server-only load (DB access, private env vars) Has: cookies,
  locals, request, getClientAddress
- +layout.server.js: Server layout load, data available to all child
  pages/layouts
- hooks.server.ts: handle({ event, resolve }) runs on every request, populate
  event.locals

LOAD_FUNCTIONS:

- Load chaining: +page.server.js data available as data prop in +page.js load
  function
- Example: +page.server.js
  export async function load({ cookies, locals }) {
  const user = await db.getUser(locals.userId); return { user }; } +page.js
  export async function load({ data, fetch }) { const posts = await
  fetch("/api/posts").then((r) => r.json()); return { user: data.user, posts };
  }

FORM_ACTIONS:

- Define: export const actions = { actionName: async (event) => {...} } in
  +page.server.js
- Invoke: <form method="POST" action="?/actionName"> or
  action="/path?/actionName"
- Progressive enhancement: use:enhance for no-reload submission
- Access result: let { form } = $props() in +page.svelte

ERROR_HANDLING:

- Redirects: redirect(303, '/path') in load/actions (NOT in try/catch)
- Errors: error(404, 'Not found') to trigger error page

AUTHENTICATION: hooks.server.ts validates sessions via backend /api/auth/me,
populates event.locals.user, protected routes check locals.user in
+layout.server.js

API_CALLS: Use centralized client at lib/utils/api.ts (handles auth cookies), DO
NOT use raw fetch for backend calls from frontend

STATE_MANAGEMENT_FILES: .svelte.js/.svelte.ts for runes outside components,
export state objects to share across components, Example: export const authState
= $state({ user: null })
