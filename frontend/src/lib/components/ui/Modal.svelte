<script lang="ts">
    import type { Snippet } from 'svelte';

    let { open = false, title = '', onClose, children }: {
        open: boolean;
        title?: string;
        onClose: () => void;
        children: Snippet;
    } = $props();

    function handleBackdrop(e: MouseEvent) {
        if (e.target === e.currentTarget) onClose();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onClose();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
            class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            on:click={handleBackdrop}
    >
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-semibold text-gray-900">{title}</h2>
                <button
                        on:click={onClose}
                        class="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="px-6 py-4">
                {@render children()}
            </div>
        </div>
    </div>
{/if}