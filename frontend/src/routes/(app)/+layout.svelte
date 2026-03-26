<script lang="ts">
    import { goto } from '$app/navigation';
    import { authStore } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    import Sidebar from '$lib/components/layout/Sidebar.svelte';
    import Topbar from '$lib/components/layout/Topbar.svelte';

    let { children } = $props();
    let sidebarOpen = $state(false);

    onMount(() => {
        if (!$authStore.isAuthenticated) {
            goto('/login');
        }
    });

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
    }
</script>

{#if $authStore.isAuthenticated}
    <div class="min-h-screen bg-gray-50">
        <Sidebar bind:open={sidebarOpen} />

        <div class="lg:ml-64 flex flex-col min-h-screen">
            <Topbar onToggleSidebar={toggleSidebar} />

            <main class="flex-1 p-4 lg:p-6">
                {@render children()}
            </main>
        </div>
    </div>
{/if}