<script lang="ts">
import "./layout.css";
import { onMount } from "svelte";
import { user } from "$lib/state.svelte";

onMount(() => {
    user.checkAuth();
});

let { children } = $props();
</script>

{@render children()}
