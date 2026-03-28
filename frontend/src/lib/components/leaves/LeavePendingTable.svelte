<script lang="ts">
    import { t } from '$lib/i18n';

    let {
        leaves,
        loading = false,
        selectedIds,
        onToggleSelect,
        onToggleSelectAll,
        onDetail,
        onReview,
        onBulkReview,
        getLeaveLabel,
        getTimeSlotLabel,
        formatDate,
    }: {
        leaves: any[];
        loading?: boolean;
        selectedIds: Set<string>;
        onToggleSelect: (id: string) => void;
        onToggleSelectAll: () => void;
        onDetail: (leave: any) => void;
        onReview: (leave: any, status: string) => void;
        onBulkReview: (status: string) => void;
        getLeaveLabel: (lt: any) => string;
        getTimeSlotLabel: (slot: string) => string;
        formatDate: (d: string) => string;
    } = $props();
</script>

<!-- Bulk actions bar -->
{#if selectedIds.size > 0}
    <div class="p-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
        <span class="text-sm text-blue-700 font-medium">{selectedIds.size} {$t('leaves.selected')}</span>
        <button
                onclick={() => onBulkReview('ACCEPTED')}
                class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
        >
            {$t('leaves.approveAll')}
        </button>
        <button
                onclick={() => onBulkReview('REFUSED')}
                class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
        >
            {$t('leaves.refuseAll')}
        </button>
    </div>
{/if}

{#if loading}
    <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
{:else if leaves.length === 0}
    <div class="p-8 text-center text-gray-500">{$t('leaves.noLeaves')}</div>
{:else}
    <!-- Desktop -->
    <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
                <th class="text-left px-4 py-3 w-8">
                    <input type="checkbox" checked={selectedIds.size === leaves.length && leaves.length > 0} onchange={onToggleSelectAll} class="w-4 h-4 rounded border-gray-300" />
                </th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">Employee</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.type')}</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">Dates</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.timeSlot')}</th>
                <th class="text-right px-4 py-3 font-medium text-gray-500">{$t('common.actions')}</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
            {#each leaves as leave}
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(leave.id)} onchange={() => onToggleSelect(leave.id)} class="w-4 h-4 rounded border-gray-300" />
                    </td>
                    <td class="px-4 py-3">
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                                {leave.user?.name[0]}{leave.user?.surname[0]}
                            </div>
                            <span class="font-medium text-gray-900">{leave.user?.name} {leave.user?.surname}</span>
                        </div>
                    </td>
                    <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {leave.leaveType?.color}"></span>
                  {getLeaveLabel(leave.leaveType)}
              </span>
                    </td>
                    <td class="px-4 py-3 text-gray-600">{formatDate(leave.startDate)} — {formatDate(leave.endDate)}</td>
                    <td class="px-4 py-3 text-gray-600">{getTimeSlotLabel(leave.timeSlot)}</td>
                    <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <button onclick={() => onDetail(leave)} class="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Detail</button>
                            <button onclick={() => onReview(leave, 'ACCEPTED')} class="px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded">
                                {$t('leaves.approve')}
                            </button>
                            <button onclick={() => onReview(leave, 'REFUSED')} class="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                                {$t('leaves.refuse')}
                            </button>
                        </div>
                    </td>
                </tr>
            {/each}
            </tbody>
        </table>
    </div>

    <!-- Mobile -->
    <div class="md:hidden divide-y divide-gray-100">
        {#each leaves as leave}
            <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.has(leave.id)} onchange={() => onToggleSelect(leave.id)} class="w-4 h-4 rounded border-gray-300" />
                        <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                            {leave.user?.name[0]}{leave.user?.surname[0]}
                        </div>
                        <span class="font-medium text-gray-900 text-sm">{leave.user?.name} {leave.user?.surname}</span>
                    </div>
                    <span class="inline-flex items-center gap-1.5 text-xs">
            <span class="w-2 h-2 rounded-full" style="background-color: {leave.leaveType?.color}"></span>
                        {getLeaveLabel(leave.leaveType)}
          </span>
                </div>
                <div class="text-xs text-gray-500">
                    {formatDate(leave.startDate)} — {formatDate(leave.endDate)} · {getTimeSlotLabel(leave.timeSlot)}
                </div>
                <div class="flex gap-2">
                    <button onclick={() => onReview(leave, 'ACCEPTED')} class="flex-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
                        {$t('leaves.approve')}
                    </button>
                    <button onclick={() => onReview(leave, 'REFUSED')} class="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                        {$t('leaves.refuse')}
                    </button>
                </div>
            </div>
        {/each}
    </div>
{/if}