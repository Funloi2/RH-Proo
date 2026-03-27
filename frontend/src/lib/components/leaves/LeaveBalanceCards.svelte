<script lang="ts">
    import { t } from '$lib/i18n';

    let { balance }: { balance: any } = $props();
</script>

{#if balance}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-500">{$t('dashboard.totalAllowance')}</p>
            <p class="text-xl font-bold text-gray-900 mt-1">{balance.totalAllowance + balance.additionalDays}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-500">{$t('dashboard.used')}</p>
            <p class="text-xl font-bold text-blue-600 mt-1">{balance.usedDays}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-500">{$t('dashboard.pending')}</p>
            <p class="text-xl font-bold text-amber-500 mt-1">{balance.pendingDays}</p>
        </div>
        <div class="bg-white rounded-xl border border-gray-200 p-4">
            <p class="text-xs text-gray-500">{$t('dashboard.available')}</p>
            <p class="text-xl font-bold text-green-600 mt-1">{balance.availableDays}</p>
        </div>
    </div>
{/if}