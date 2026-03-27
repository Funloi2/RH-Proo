<script lang="ts">
    import { t, currentLanguage } from '$lib/i18n';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let {
        date,
        leaves,
        onClose,
        getLeaveLabel,
        getTimeSlotLabel,
    }: {
        date: string;
        leaves: any[];
        onClose: () => void;
        getLeaveLabel: (lt: any) => string;
        getTimeSlotLabel: (slot: string) => string;
    } = $props();

    let lang = $derived($currentLanguage);

    let formattedDate = $derived(
        new Date(date).toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
    );
</script>

<div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
            <h3 class="text-sm font-semibold text-gray-900 capitalize">{formattedDate}</h3>
            <p class="text-xs text-gray-500 mt-0.5">{leaves.length} {leaves.length === 1 ? 'person' : 'people'} off</p>
        </div>
        <button
                onclick={onClose}
                class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div>

    <div class="divide-y divide-gray-100">
        {#each leaves as leave}
            <div class="px-5 py-3 flex items-center gap-3">
                <div
                        class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                        style="background-color: {leave.leaveType?.color}15; color: {leave.leaveType?.color};"
                >
                    {leave.user?.name?.[0]}{leave.user?.surname?.[0]}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">{leave.user?.name} {leave.user?.surname}</p>
                    <p class="text-xs text-gray-500">
                        {getLeaveLabel(leave.leaveType)}
                        {#if leave.timeSlot !== 'FULL_DAY'}
                            · {getTimeSlotLabel(leave.timeSlot)}
                        {/if}
                    </p>
                </div>
            </div>
        {/each}
    </div>
</div>