<script lang="ts">
    import { t } from '$lib/i18n';
    import Modal from '$lib/components/ui/Modal.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    const API_BASE = 'http://localhost:3001/api';

    let {
        open = false,
        leave,
        canUpload = false,
        accessToken = '',
        onClose,
        onUpload,
        getLeaveLabel,
        getStatusColor,
        getStatusLabel,
        getTimeSlotLabel,
        formatDate,
    }: {
        open: boolean;
        leave: any;
        canUpload?: boolean;
        accessToken?: string;
        onClose: () => void;
        onUpload: (leaveId: string, event: Event) => void;
        getLeaveLabel: (lt: any) => string;
        getStatusColor: (status: string) => any;
        getStatusLabel: (status: string) => string;
        getTimeSlotLabel: (slot: string) => string;
        formatDate: (d: string) => string;
    } = $props();

    function getFileIcon(mimeType: string): string {
        if (mimeType?.startsWith('image/')) return '🖼️';
        if (mimeType === 'application/pdf') return '📄';
        return '📎';
    }

    function canPreview(mimeType: string): boolean {
        return mimeType?.startsWith('image/') || mimeType === 'application/pdf';
    }

    async function downloadFile(attachment: any) {
        try {
            const res = await fetch(`${API_BASE}/leaves/attachments/${attachment.id}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            if (canPreview(attachment.mimeType)) {
                // Open in new tab for preview
                window.open(url, '_blank');
            } else {
                // Trigger download
                const a = document.createElement('a');
                a.href = url;
                a.download = attachment.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            // Clean up after a delay
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (err) {
            console.error('Download error:', err);
        }
    }
</script>

<Modal {open} title="Leave Request Detail" onClose={onClose}>
    {#if leave}
        <div class="space-y-4">
            <div class="flex items-center gap-3">
        <span class="inline-flex items-center gap-1.5 text-sm font-medium">
          <span class="w-3 h-3 rounded-full" style="background-color: {leave.leaveType?.color}"></span>
            {getLeaveLabel(leave.leaveType)}
        </span>
                <StatusBadge label={getStatusLabel(leave.status)} color={getStatusColor(leave.status)} />
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Employee</p>
                    <p class="text-gray-700">{leave.user?.name} {leave.user?.surname}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.timeSlot')}</p>
                    <p class="text-gray-700">{getTimeSlotLabel(leave.timeSlot)}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.startDate')}</p>
                    <p class="text-gray-700">{formatDate(leave.startDate)}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.endDate')}</p>
                    <p class="text-gray-700">{formatDate(leave.endDate)}</p>
                </div>
            </div>

            {#if leave.notes}
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.notes')}</p>
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">{leave.notes}</p>
                </div>
            {/if}

            {#if leave.reviewer}
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Reviewed by</p>
                    <p class="text-sm text-gray-700">{leave.reviewer.name} {leave.reviewer.surname}</p>
                </div>
            {/if}

            <!-- Attachments -->
            <div>
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-medium text-gray-500">{$t('leaves.attachments')}</p>
                    {#if canUpload}
                        <label class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {$t('leaves.uploadFile')}
                            <input type="file" multiple class="hidden" on:change={(e) => onUpload(leave.id, e)} />
                        </label>
                    {/if}
                </div>
                {#if leave.attachments?.length > 0}
                    <div class="space-y-1">
                        {#each leave.attachments as att}
                            <button
                                    on:click={() => downloadFile(att)}
                                    class="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm hover:bg-gray-100 transition-colors text-left group"
                            >
                                <span class="text-base shrink-0">{getFileIcon(att.mimeType)}</span>
                                <span class="text-gray-700 truncate flex-1 group-hover:text-blue-600">{att.fileName}</span>
                                <span class="text-xs text-gray-400 shrink-0">{(att.fileSize / 1024).toFixed(0)} KB</span>
                                <svg class="w-4 h-4 text-gray-400 shrink-0 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </button>
                        {/each}
                    </div>
                {:else}
                    <p class="text-xs text-gray-400">No attachments</p>
                {/if}
            </div>
        </div>
    {/if}
</Modal>