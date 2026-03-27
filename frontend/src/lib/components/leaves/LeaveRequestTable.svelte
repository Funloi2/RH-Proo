<script lang="ts">
    import { t } from '$lib/i18n';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';
    import Pagination from '$lib/components/ui/Pagination.svelte';

    let {
        leaves,
        meta,
        showEmployee = false,
        userId,
        isAdmin = false,
        onDetail,
        onCancel,
        onReview,
        onPageChange,
        getLeaveLabel,
        getStatusColor,
        getStatusLabel,
        getTimeSlotLabel,
        formatDate,
    }: {
        leaves: any[];
        meta: any;
        showEmployee?: boolean;
        userId?: string;
        isAdmin?: boolean;
        onDetail: (leave: any) => void;
        onCancel: (leave: any) => void;
        onReview: (leave: any, status: string) => void;
        onPageChange: (page: number) => void;
        getLeaveLabel: (lt: any) => string;
        getStatusColor: (status: string) => any;
        getStatusLabel: (status: string) => string;
        getTimeSlotLabel: (slot: string) => string;
        formatDate: (d: string) => string;
    } = $props();
</script>

{#if leaves.length === 0}
    <div class="p-8 text-center text-gray-500">{$t('leaves.noLeaves')}</div>
{:else}
    <!-- Desktop -->
    <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
                {#if showEmployee}<th class="text-left px-4 py-3 font-medium text-gray-500">Employee</th>{/if}
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.type')}</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">Dates</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.timeSlot')}</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.status')}</th>
                <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.notes')}</th>
                <th class="text-right px-4 py-3 font-medium text-gray-500">{$t('common.actions')}</th>
            </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
            {#each leaves as leave}
                <tr class="hover:bg-gray-50">
                    {#if showEmployee}
                        <td class="px-4 py-3">
                            <span class="font-medium text-gray-900">{leave.user?.name} {leave.user?.surname}</span>
                        </td>
                    {/if}
                    <td class="px-4 py-3">
              <span class="inline-flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {leave.leaveType?.color}"></span>
                  {getLeaveLabel(leave.leaveType)}
              </span>
                    </td>
                    <td class="px-4 py-3 text-gray-600">{formatDate(leave.startDate)} — {formatDate(leave.endDate)}</td>
                    <td class="px-4 py-3 text-gray-600">{getTimeSlotLabel(leave.timeSlot)}</td>
                    <td class="px-4 py-3">
                        <StatusBadge label={getStatusLabel(leave.status)} color={getStatusColor(leave.status)} />
                    </td>
                    <td class="px-4 py-3 text-gray-500 text-xs max-w-[150px] truncate">{leave.notes || '—'}</td>
                    <td class="px-4 py-3 text-right">
                        <div class="flex items-center justify-end gap-1">
                            <button on:click={() => onDetail(leave)} class="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Detail</button>
                            {#if leave.status === 'PENDING' && leave.userId === userId}
                                <button on:click={() => onCancel(leave)} class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                                    {$t('leaves.cancel')}
                                </button>
                            {/if}
                            {#if leave.status === 'PENDING' && leave.userId !== userId && isAdmin}
                                <button on:click={() => onReview(leave, 'ACCEPTED')} class="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded">
                                    {$t('leaves.approve')}
                                </button>
                                <button on:click={() => onReview(leave, 'REFUSED')} class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                                    {$t('leaves.refuse')}
                                </button>
                            {/if}
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
            <div class="p-4 space-y-2">
                <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5 text-sm">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {leave.leaveType?.color}"></span>
            <span class="font-medium text-gray-900">{getLeaveLabel(leave.leaveType)}</span>
          </span>
                    <StatusBadge label={getStatusLabel(leave.status)} color={getStatusColor(leave.status)} />
                </div>
                {#if showEmployee}
                    <p class="text-xs text-gray-500">{leave.user?.name} {leave.user?.surname}</p>
                {/if}
                <p class="text-xs text-gray-500">
                    {formatDate(leave.startDate)} — {formatDate(leave.endDate)} · {getTimeSlotLabel(leave.timeSlot)}
                </p>
                <div class="flex gap-2 pt-1">
                    <button on:click={() => onDetail(leave)} class="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Detail</button>
                    {#if leave.status === 'PENDING' && leave.userId === userId}
                        <button on:click={() => onCancel(leave)} class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                            {$t('leaves.cancel')}
                        </button>
                    {/if}
                </div>
            </div>
        {/each}
    </div>

    <div class="px-4 pb-4">
        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={onPageChange} />
    </div>
{/if}