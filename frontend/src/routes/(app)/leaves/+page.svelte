<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage } from '$lib/i18n';
    import { authStore } from '$lib/stores/auth';
    import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '$lib/api/client';

    import LeaveBalanceCards from '$lib/components/leaves/LeaveBalanceCards.svelte';
    import LeaveRequestTable from '$lib/components/leaves/LeaveRequestTable.svelte';
    import LeavePendingTable from '$lib/components/leaves/LeavePendingTable.svelte';
    import CreateLeaveModal from '$lib/components/leaves/CreateLeaveModal.svelte';
    import LeaveDetailModal from '$lib/components/leaves/LeaveDetailModal.svelte';
    import LeaveReviewModal from '$lib/components/leaves/LeaveReviewModal.svelte';

    let user = $derived($authStore.user);
    let isAdmin = $derived(user?.globalRole === 'ADMIN');
    let lang = $derived($currentLanguage);
    let accessToken = $derived($authStore.accessToken || '');

    // Tab
    let activeTab = $state<'my' | 'pending' | 'all'>('my');

    // Data
    let leaves: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let pendingLeaves: any[] = $state([]);
    let balance: any = $state(null);
    let leaveTypes: any[] = $state([]);
    let loading = $state(true);
    let pendingLoading = $state(false);
    let error = $state('');

    // Filters
    let filterStatus = $state('');
    let filterTypeId = $state('');

    // Modals
    let showCreateModal = $state(false);
    let showDetailModal = $state(false);
    let showReviewModal = $state(false);
    let detailLeave: any = $state(null);
    let reviewTarget: any = $state(null);
    let reviewStatus = $state('ACCEPTED');

    // Bulk selection
    let selectedIds = $state<Set<string>>(new Set());

    // ---- Helpers ----

    function getLeaveLabel(lt: any): string {
        if (!lt) return '—';
        return lang === 'FR' ? lt.labelFr : lt.labelEn;
    }

    function getStatusColor(status: string): 'amber' | 'green' | 'red' | 'gray' {
        switch (status) {
            case 'PENDING': return 'amber';
            case 'ACCEPTED': return 'green';
            case 'REFUSED': return 'red';
            default: return 'gray';
        }
    }

    function getStatusLabel(status: string): string {
        switch (status) {
            case 'PENDING': return $t('leaves.pending');
            case 'ACCEPTED': return $t('leaves.accepted');
            case 'REFUSED': return $t('leaves.refused');
            default: return status;
        }
    }

    function getTimeSlotLabel(slot: string): string {
        switch (slot) {
            case 'MORNING': return $t('leaves.morning');
            case 'AFTERNOON': return $t('leaves.afternoon');
            case 'FULL_DAY': return $t('leaves.fullDay');
            default: return slot;
        }
    }

    function formatDate(d: string): string {
        return new Date(d).toLocaleDateString();
    }

    // ---- Data fetching ----

    onMount(async () => {
        await Promise.all([fetchLeaveTypes(), fetchBalance()]);
        await fetchData();
    });

    async function fetchLeaveTypes() {
        try { leaveTypes = await apiGet<any[]>('/leave-types'); } catch {}
    }

    async function fetchBalance() {
        try { balance = await apiGet('/leaves/my-balance'); } catch {}
    }

    async function fetchData() {
        if (activeTab === 'pending') await fetchPending();
        else await fetchLeaves();
    }

    async function fetchLeaves(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (activeTab === 'my') params.set('userId', user?.id || '');
            if (filterStatus) params.set('status', filterStatus);
            if (filterTypeId) params.set('leaveTypeId', filterTypeId);
            const data = await apiGet<{ data: any[]; meta: any }>(`/leaves?${params}`);
            leaves = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    async function fetchPending() {
        pendingLoading = true;
        error = '';
        try {
            const data = await apiGet<any[]>('/leaves/pending');
            pendingLeaves = Array.isArray(data) ? data : [];
        } catch (err: any) {
            error = err.message;
        } finally {
            pendingLoading = false;
        }
    }

    function switchTab(tab: 'my' | 'pending' | 'all') {
        activeTab = tab;
        selectedIds = new Set();
        fetchData();
    }

    async function refreshAll() {
        await Promise.all([fetchData(), fetchBalance()]);
    }

    // ---- Actions ----

    async function handleCreateSubmit(form: any) {
        const body: any = {
            leaveTypeId: form.leaveTypeId,
            startDate: form.startDate,
            endDate: form.endDate,
        };
        if (form.timeSlot !== 'FULL_DAY') body.timeSlot = form.timeSlot;
        if (form.notes) body.notes = form.notes;

        await apiPost('/leaves', body);
        showCreateModal = false;
        await refreshAll();
    }

    async function openDetail(leave: any) {
        try {
            detailLeave = await apiGet(`/leaves/${leave.id}`);
            showDetailModal = true;
        } catch (err: any) {
            error = err.message;
        }
    }

    function openReview(leave: any, status: string) {
        reviewTarget = leave;
        reviewStatus = status;
        showReviewModal = true;
    }

    async function handleReview(status: string, notes: string) {
        try {
            await apiPatch(`/leaves/${reviewTarget.id}/review`, {
                status,
                notes: notes || undefined,
            });
            showReviewModal = false;
            await refreshAll();
        } catch (err: any) {
            error = err.message;
            showReviewModal = false;
        }
    }

    async function handleCancel(leave: any) {
        try {
            await apiDelete(`/leaves/${leave.id}`);
            await refreshAll();
        } catch (err: any) {
            error = err.message;
        }
    }

    async function handleFileUpload(leaveId: string, event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const formData = new FormData();
        for (const file of input.files) {
            formData.append('files', file);
        }

        try {
            await apiUpload(`/leaves/${leaveId}/attachments`, formData);
            if (detailLeave?.id === leaveId) {
                detailLeave = await apiGet(`/leaves/${leaveId}`);
            }
        } catch (err: any) {
            error = err.message;
        } finally {
            input.value = '';
        }
    }

    // Bulk
    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        selectedIds = next;
    }

    function toggleSelectAll() {
        selectedIds = selectedIds.size === pendingLeaves.length
            ? new Set()
            : new Set(pendingLeaves.map((l) => l.id));
    }

    async function bulkReview(status: string) {
        if (selectedIds.size === 0) return;
        try {
            await apiPost('/leaves/bulk-review', {
                leaveRequestIds: Array.from(selectedIds),
                status,
            });
            selectedIds = new Set();
            await refreshAll();
        } catch (err: any) {
            error = err.message;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">{$t('leaves.title')}</h1>
        <button
                on:click={() => (showCreateModal = true)}
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {$t('leaves.requestLeave')}
        </button>
    </div>

    <!-- Balance -->
    <LeaveBalanceCards {balance} />

    <!-- Tabs + Content -->
    <div class="bg-white rounded-xl border border-gray-200">
        <!-- Tab bar -->
        <div class="flex border-b border-gray-200">
            <button
                    on:click={() => switchTab('my')}
                    class="px-5 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'my'
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'}"
            >
                {$t('leaves.title')}
            </button>
            <button
                    on:click={() => switchTab('pending')}
                    class="px-5 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'pending'
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'}"
            >
                {$t('leaves.pendingReview')}
                {#if pendingLeaves.length > 0}
                    <span class="ml-1.5 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{pendingLeaves.length}</span>
                {/if}
            </button>
            {#if isAdmin}
                <button
                        on:click={() => switchTab('all')}
                        class="px-5 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === 'all'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
                >
                    All Requests
                </button>
            {/if}
        </div>

        <!-- Filters for my/all -->
        {#if activeTab !== 'pending'}
            <div class="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
                <select
                        bind:value={filterStatus}
                        on:change={() => fetchLeaves(1)}
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">{$t('leaves.status')}: All</option>
                    <option value="PENDING">{$t('leaves.pending')}</option>
                    <option value="ACCEPTED">{$t('leaves.accepted')}</option>
                    <option value="REFUSED">{$t('leaves.refused')}</option>
                </select>
                <select
                        bind:value={filterTypeId}
                        on:change={() => fetchLeaves(1)}
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">{$t('leaves.type')}: All</option>
                    {#each leaveTypes as lt}
                        <option value={lt.id}>{getLeaveLabel(lt)}</option>
                    {/each}
                </select>
            </div>
        {/if}

        {#if error}
            <div class="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        {/if}

        <!-- Tab content -->
        {#if activeTab === 'pending'}
            <LeavePendingTable
                    leaves={pendingLeaves}
                    loading={pendingLoading}
                    {selectedIds}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    onDetail={openDetail}
                    onReview={openReview}
                    onBulkReview={bulkReview}
                    {getLeaveLabel}
                    {getTimeSlotLabel}
                    {formatDate}
            />
        {:else}
            {#if loading}
                <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
            {:else}
                <LeaveRequestTable
                        {leaves}
                        {meta}
                        showEmployee={activeTab === 'all'}
                        userId={user?.id}
                        {isAdmin}
                        onDetail={openDetail}
                        onCancel={handleCancel}
                        onReview={openReview}
                        onPageChange={(p) => fetchLeaves(p)}
                        {getLeaveLabel}
                        {getStatusColor}
                        {getStatusLabel}
                        {getTimeSlotLabel}
                        {formatDate}
                />
            {/if}
        {/if}
    </div>
</div>

<!-- Modals -->
<CreateLeaveModal
        open={showCreateModal}
        {leaveTypes}
        onClose={() => (showCreateModal = false)}
        onSubmit={handleCreateSubmit}
        {getLeaveLabel}
/>

<LeaveDetailModal
        open={showDetailModal}
        leave={detailLeave}
        canUpload={detailLeave?.userId === user?.id}
        {accessToken}
        onClose={() => (showDetailModal = false)}
        onUpload={handleFileUpload}
        {getLeaveLabel}
        {getStatusColor}
        {getStatusLabel}
        {getTimeSlotLabel}
        {formatDate}
/>

<LeaveReviewModal
        open={showReviewModal}
        leave={reviewTarget}
        status={reviewStatus}
        onClose={() => (showReviewModal = false)}
        onSubmit={handleReview}
        {getLeaveLabel}
        {getTimeSlotLabel}
        {formatDate}
/>