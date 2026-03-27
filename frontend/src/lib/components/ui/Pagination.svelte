<script lang="ts">
    import { t } from '$lib/i18n';

    let { page = 1, totalPages = 1, onPageChange }: {
        page: number;
        totalPages: number;
        onPageChange: (page: number) => void;
    } = $props();
</script>

{#if totalPages > 1}
    <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <p class="text-sm text-gray-500">
            {$t('common.page')} {page} {$t('common.of')} {totalPages}
        </p>
        <div class="flex gap-2">
            <button
                    on:click={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                {$t('common.previous')}
            </button>
            <button
                    on:click={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
                {$t('common.next')}
            </button>
        </div>
    </div>
{/if}