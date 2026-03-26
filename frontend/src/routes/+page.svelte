<script lang="ts">
    import { goto } from '$app/navigation';
    import { authStore } from '$lib/stores/auth';
    import { onMount } from 'svelte';

    onMount(() => {
        if ($authStore.isAuthenticated) {
            goto('/dashboard');
        } else {
            goto('/login');
        }
    });
</script>