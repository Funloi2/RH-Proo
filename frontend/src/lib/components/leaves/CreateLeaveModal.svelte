<script lang="ts">
    import { t } from '$lib/i18n';
    import Modal from '$lib/components/ui/Modal.svelte';

    let {
        open = false,
        leaveTypes,
        onClose,
        onSubmit,
        getLeaveLabel,
    }: {
        open: boolean;
        leaveTypes: any[];
        onClose: () => void;
        onSubmit: (form: any) => Promise<void>;
        getLeaveLabel: (lt: any) => string;
    } = $props();

    let form = $state({
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        timeSlot: 'FULL_DAY',
        notes: '',
    });
    let error = $state('');
    let loading = $state(false);

    // Today's date as YYYY-MM-DD for the min attribute
    let today = $derived(new Date().toISOString().split('T')[0]);

    // End date minimum: either the start date or today, whichever is later
    let minEndDate = $derived(form.startDate || today);

    async function handleSubmit() {
        error = '';
        loading = true;
        try {
            await onSubmit(form);
            form = { leaveTypeId: '', startDate: '', endDate: '', timeSlot: 'FULL_DAY', notes: '' };
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    // When start date changes, reset end date if it's now before the start
    function onStartDateChange() {
        if (form.endDate && form.endDate < form.startDate) {
            form.endDate = form.startDate;
        }
    }

    // Reset form when modal opens
    $effect(() => {
        if (open) {
            error = '';
        }
    });
</script>

<Modal {open} title={$t('leaves.requestLeave')} onClose={onClose}>
    {#if error}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}
    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.type')}</label>
            <select
                    bind:value={form.leaveTypeId}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Select type</option>
                {#each leaveTypes as lt}
                    <option value={lt.id}>{getLeaveLabel(lt)}</option>
                {/each}
            </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.startDate')}</label>
                <input
                        type="date"
                        bind:value={form.startDate}
                        on:change={onStartDateChange}
                        min={today}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.endDate')}</label>
                <input
                        type="date"
                        bind:value={form.endDate}
                        min={minEndDate}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.timeSlot')}</label>
            <select
                    bind:value={form.timeSlot}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="FULL_DAY">{$t('leaves.fullDay')}</option>
                <option value="MORNING">{$t('leaves.morning')}</option>
                <option value="AFTERNOON">{$t('leaves.afternoon')}</option>
            </select>
            <p class="mt-1 text-xs text-gray-400">Morning/Afternoon is only for single-day requests</p>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.notes')}</label>
            <textarea
                    bind:value={form.notes}
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
            ></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2">
            <button type="button" on:click={onClose} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {$t('common.cancel')}
            </button>
            <button type="submit" disabled={loading} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? $t('common.loading') : $t('common.create')}
            </button>
        </div>
    </form>
</Modal>