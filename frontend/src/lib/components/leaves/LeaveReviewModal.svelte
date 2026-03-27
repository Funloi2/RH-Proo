<script lang="ts">
    import { t } from '$lib/i18n';
    import Modal from '$lib/components/ui/Modal.svelte';

    let {
        open = false,
        leave,
        status = 'ACCEPTED',
        onClose,
        onSubmit,
        getLeaveLabel,
        getTimeSlotLabel,
        formatDate,
    }: {
        open: boolean;
        leave: any;
        status?: string;
        onClose: () => void;
        onSubmit: (status: string, notes: string) => void;
        getLeaveLabel: (lt: any) => string;
        getTimeSlotLabel: (slot: string) => string;
        formatDate: (d: string) => string;
    } = $props();

    let notes = $state('');

    let title = $derived(status === 'ACCEPTED' ? $t('leaves.approve') : $t('leaves.refuse'));

    $effect(() => {
        if (open) {
            notes = '';
        }
    });
</script>

<Modal {open} {title} onClose={onClose}>
    {#if leave}
        <div class="space-y-4">
            <div class="p-3 bg-gray-50 rounded-lg">
                <p class="text-sm font-medium text-gray-900">{leave.user?.name} {leave.user?.surname}</p>
                <p class="text-xs text-gray-500 mt-1">
                    {getLeaveLabel(leave.leaveType)} · {formatDate(leave.startDate)} — {formatDate(leave.endDate)} · {getTimeSlotLabel(leave.timeSlot)}
                </p>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.notes')} (optional)</label>
                <textarea
                        bind:value={notes}
                        rows="2"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Reason for decision..."
                ></textarea>
            </div>

            <div class="flex justify-end gap-3">
                <button on:click={onClose} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {$t('common.cancel')}
                </button>
                <button
                        on:click={() => onSubmit(status, notes)}
                        class="px-4 py-2 text-sm font-medium text-white rounded-lg {status === 'ACCEPTED'
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-red-600 hover:bg-red-700'}"
                >
                    {status === 'ACCEPTED' ? $t('leaves.approve') : $t('leaves.refuse')}
                </button>
            </div>
        </div>
    {/if}
</Modal>