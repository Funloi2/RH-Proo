<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage } from '$lib/i18n';
    import { authStore } from '$lib/stores/auth';
    import { apiGet, apiPost, apiPatch, apiDelete, apiUpload } from '$lib/api/client';
    import Modal from '$lib/components/ui/Modal.svelte';
    import Pagination from '$lib/components/ui/Pagination.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let user = $derived($authStore.user);
    let isAdmin = $derived(user?.globalRole === 'ADMIN');
    let lang = $derived($currentLanguage);

    // Tab state
    let activeTab = $state<'my' | 'pending' | 'all'>('my');

    // Leave requests
    let leaves: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let loading = $state(true);
    let error = $state('');

    // Pending requests (for DM/admin review)
    let pendingLeaves: any[] = $state([]);
    let pendingLoading = $state(false);

    // Balance
    let balance: any = $state(null);

    // Leave types
    let leaveTypes: any[] = $state([]);

    // Filters
    let filterStatus = $state('');
    let filterTypeId = $state('');

    // Create request modal
    let showCreateModal = $state(false);
    let createForm = $state({
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        timeSlot: 'FULL_DAY',
        notes: '',
    });
    let createError = $state('');
    let createLoading = $state(false);

    // Detail modal
    let showDetailModal = $state(false);
    let detailLeave: any = $state(null);

    // Review modal
    let showReviewModal = $state(false);
    let reviewTarget: any = $state(null);
    let reviewStatus = $state('ACCEPTED');
    let reviewNotes = $state('');

    // File upload
    let fileInput: HTMLInputElement;
    let uploadingFor = $state('');

    // Bulk review
    let selectedIds = $state<Set<string>>(new Set());

    onMount(async () => {
        await Promise.all([
            fetchLeaveTypes(),
            fetchBalance(),
        ]);
        await fetchData();
    });

    async function fetchLeaveTypes() {
        try {
            leaveTypes = await apiGet<any[]>('/leave-types');
        } catch { /* ignore */ }
    }

    async function fetchBalance() {
        try {
            balance = await apiGet('/leaves/my-balance');
        } catch { /* ignore */ }
    }

    async function fetchData() {
        if (activeTab === 'pending') {
            await fetchPending();
        } else {
            await fetchLeaves();
        }
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

    // Create leave request
    async function handleCreate() {
        createError = '';
        createLoading = true;
        try {
            const body: any = {
                leaveTypeId: createForm.leaveTypeId,
                startDate: createForm.startDate,
                endDate: createForm.endDate,
            };
            if (createForm.timeSlot !== 'FULL_DAY') body.timeSlot = createForm.timeSlot;
            if (createForm.notes) body.notes = createForm.notes;

            await apiPost('/leaves', body);
            showCreateModal = false;
            createForm = { leaveTypeId: '', startDate: '', endDate: '', timeSlot: 'FULL_DAY', notes: '' };
            await Promise.all([fetchData(), fetchBalance()]);
        } catch (err: any) {
            createError = err.message;
        } finally {
            createLoading = false;
        }
    }

    // Detail view
    async function openDetail(leave: any) {
        try {
            detailLeave = await apiGet(`/leaves/${leave.id}`);
            showDetailModal = true;
        } catch (err: any) {
            error = err.message;
        }
    }

    // Review
    function openReview(leave: any, status: string) {
        reviewTarget = leave;
        reviewStatus = status;
        reviewNotes = '';
        showReviewModal = true;
    }

    async function handleReview() {
        try {
            await apiPatch(`/leaves/${reviewTarget.id}/review`, {
                status: reviewStatus,
                notes: reviewNotes || undefined,
            });
            showReviewModal = false;
            await Promise.all([fetchData(), fetchBalance()]);
        } catch (err: any) {
            error = err.message;
            showReviewModal = false;
        }
    }

    // Cancel
    async function handleCancel(leave: any) {
        try {
            await apiDelete(`/leaves/${leave.id}`);
            await Promise.all([fetchData(), fetchBalance()]);
        } catch (err: any) {
            error = err.message;
        }
    }

    // File upload
    async function handleFileUpload(leaveId: string, event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        uploadingFor = leaveId;
        const formData = new FormData();
        for (const file of input.files) {
            formData.append('files', file);
        }

        try {
            await apiUpload(`/leaves/${leaveId}/attachments`, formData);
            // Refresh detail if open
            if (detailLeave?.id === leaveId) {
                detailLeave = await apiGet(`/leaves/${leaveId}`);
            }
        } catch (err: any) {
            error = err.message;
        } finally {
            uploadingFor = '';
            input.value = '';
        }
    }

    // Bulk review
    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        selectedIds = next;
    }

    function toggleSelectAll() {
        if (selectedIds.size === pendingLeaves.length) {
            selectedIds = new Set();
        } else {
            selectedIds = new Set(pendingLeaves.map((l) => l.id));
        }
    }

    async function bulkReview(status: string) {
        if (selectedIds.size === 0) return;
        try {
            await apiPost('/leaves/bulk-review', {
                leaveRequestIds: Array.from(selectedIds),
                status,
            });
            selectedIds = new Set();
            await Promise.all([fetchData(), fetchBalance()]);
        } catch (err: any) {
            error = err.message;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header + Balance -->
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">{$t('leaves.title')}</h1>
        </div>
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

    <!-- Balance cards -->
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

    <!-- Tabs -->
    <div class="bg-white rounded-xl border border-gray-200">
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

        <!-- Filters (for my/all tabs) -->
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

        <!-- Bulk actions for pending tab -->
        {#if activeTab === 'pending' && selectedIds.size > 0}
            <div class="p-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
                <span class="text-sm text-blue-700 font-medium">{selectedIds.size} selected</span>
                <button
                        on:click={() => bulkReview('ACCEPTED')}
                        class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200"
                >
                    {$t('leaves.approve')} all
                </button>
                <button
                        on:click={() => bulkReview('REFUSED')}
                        class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200"
                >
                    {$t('leaves.refuse')} all
                </button>
            </div>
        {/if}

        {#if error}
            <div class="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        {/if}

        <!-- PENDING TAB -->
        {#if activeTab === 'pending'}
            {#if pendingLoading}
                <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
            {:else if pendingLeaves.length === 0}
                <div class="p-8 text-center text-gray-500">{$t('leaves.noLeaves')}</div>
            {:else}
                <!-- Desktop -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="text-left px-4 py-3 w-8">
                                <input type="checkbox" checked={selectedIds.size === pendingLeaves.length} on:change={toggleSelectAll} class="w-4 h-4 rounded border-gray-300" />
                            </th>
                            <th class="text-left px-4 py-3 font-medium text-gray-500">Employee</th>
                            <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.type')}</th>
                            <th class="text-left px-4 py-3 font-medium text-gray-500">Dates</th>
                            <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('leaves.timeSlot')}</th>
                            <th class="text-right px-4 py-3 font-medium text-gray-500">{$t('common.actions')}</th>
                        </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                        {#each pendingLeaves as leave}
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-3">
                                    <input type="checkbox" checked={selectedIds.has(leave.id)} on:change={() => toggleSelect(leave.id)} class="w-4 h-4 rounded border-gray-300" />
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
                                        <button on:click={() => openDetail(leave)} class="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Detail</button>
                                        <button on:click={() => openReview(leave, 'ACCEPTED')} class="px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded">
                                            {$t('leaves.approve')}
                                        </button>
                                        <button on:click={() => openReview(leave, 'REFUSED')} class="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
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
                    {#each pendingLeaves as leave}
                        <div class="p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <input type="checkbox" checked={selectedIds.has(leave.id)} on:change={() => toggleSelect(leave.id)} class="w-4 h-4 rounded border-gray-300" />
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
                                <button on:click={() => openReview(leave, 'ACCEPTED')} class="flex-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100">
                                    {$t('leaves.approve')}
                                </button>
                                <button on:click={() => openReview(leave, 'REFUSED')} class="flex-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                                    {$t('leaves.refuse')}
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- MY / ALL TAB -->
        {:else}
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
                            {#if activeTab === 'all'}<th class="text-left px-4 py-3 font-medium text-gray-500">Employee</th>{/if}
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
                                {#if activeTab === 'all'}
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
                                        <button on:click={() => openDetail(leave)} class="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded">Detail</button>
                                        {#if leave.status === 'PENDING' && leave.userId === user?.id}
                                            <button on:click={() => handleCancel(leave)} class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
                                                {$t('leaves.cancel')}
                                            </button>
                                        {/if}
                                        {#if leave.status === 'PENDING' && leave.userId !== user?.id && (isAdmin || activeTab === 'all')}
                                            <button on:click={() => openReview(leave, 'ACCEPTED')} class="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded">
                                                {$t('leaves.approve')}
                                            </button>
                                            <button on:click={() => openReview(leave, 'REFUSED')} class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">
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
                            {#if activeTab === 'all'}
                                <p class="text-xs text-gray-500">{leave.user?.name} {leave.user?.surname}</p>
                            {/if}
                            <p class="text-xs text-gray-500">
                                {formatDate(leave.startDate)} — {formatDate(leave.endDate)} · {getTimeSlotLabel(leave.timeSlot)}
                            </p>
                            <div class="flex gap-2 pt-1">
                                <button on:click={() => openDetail(leave)} class="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Detail</button>
                                {#if leave.status === 'PENDING' && leave.userId === user?.id}
                                    <button on:click={() => handleCancel(leave)} class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                                        {$t('leaves.cancel')}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="px-4 pb-4">
                    <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchLeaves(p)} />
                </div>
            {/if}
        {/if}
    </div>
</div>

<!-- Create Leave Request Modal -->
<Modal open={showCreateModal} title={$t('leaves.requestLeave')} onClose={() => (showCreateModal = false)}>
    {#if createError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>
    {/if}
    <form on:submit|preventDefault={handleCreate} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.type')}</label>
            <select
                    bind:value={createForm.leaveTypeId}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Select type</option>
                {#each leaveTypes as lt}
                    <option value={lt.id}>
                        <span class="inline-block w-2 h-2 rounded-full mr-1" style="background:{lt.color}"></span>
                        {getLeaveLabel(lt)}
                    </option>
                {/each}
            </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.startDate')}</label>
                <input
                        type="date"
                        bind:value={createForm.startDate}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.endDate')}</label>
                <input
                        type="date"
                        bind:value={createForm.endDate}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.timeSlot')}</label>
            <select
                    bind:value={createForm.timeSlot}
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
                    bind:value={createForm.notes}
                    rows="2"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
            ></textarea>
        </div>
        <div class="flex justify-end gap-3 pt-2">
            <button type="button" on:click={() => (showCreateModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {$t('common.cancel')}
            </button>
            <button type="submit" disabled={createLoading} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {createLoading ? $t('common.loading') : $t('common.create')}
            </button>
        </div>
    </form>
</Modal>

<!-- Leave Detail Modal -->
<Modal open={showDetailModal} title="Leave Request Detail" onClose={() => (showDetailModal = false)}>
    {#if detailLeave}
        <div class="space-y-4">
            <div class="flex items-center gap-3">
        <span class="inline-flex items-center gap-1.5 text-sm font-medium">
          <span class="w-3 h-3 rounded-full" style="background-color: {detailLeave.leaveType?.color}"></span>
            {getLeaveLabel(detailLeave.leaveType)}
        </span>
                <StatusBadge label={getStatusLabel(detailLeave.status)} color={getStatusColor(detailLeave.status)} />
            </div>

            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Employee</p>
                    <p class="text-gray-700">{detailLeave.user?.name} {detailLeave.user?.surname}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.timeSlot')}</p>
                    <p class="text-gray-700">{getTimeSlotLabel(detailLeave.timeSlot)}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.startDate')}</p>
                    <p class="text-gray-700">{formatDate(detailLeave.startDate)}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.endDate')}</p>
                    <p class="text-gray-700">{formatDate(detailLeave.endDate)}</p>
                </div>
            </div>

            {#if detailLeave.notes}
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('leaves.notes')}</p>
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">{detailLeave.notes}</p>
                </div>
            {/if}

            {#if detailLeave.reviewer}
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Reviewed by</p>
                    <p class="text-sm text-gray-700">{detailLeave.reviewer.name} {detailLeave.reviewer.surname}</p>
                </div>
            {/if}

            <!-- Attachments -->
            <div>
                <div class="flex items-center justify-between mb-2">
                    <p class="text-xs font-medium text-gray-500">{$t('leaves.attachments')}</p>
                    {#if detailLeave.userId === user?.id}
                        <label class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {$t('leaves.uploadFile')}
                            <input type="file" multiple class="hidden" on:change={(e) => handleFileUpload(detailLeave.id, e)} />
                        </label>
                    {/if}
                </div>
                {#if detailLeave.attachments?.length > 0}
                    <div class="space-y-1">
                        {#each detailLeave.attachments as att}
                            <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                                <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span class="text-gray-700 truncate">{att.fileName}</span>
                                <span class="text-xs text-gray-400 shrink-0">{(att.fileSize / 1024).toFixed(0)} KB</span>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-xs text-gray-400">No attachments</p>
                {/if}
            </div>
        </div>
    {/if}
</Modal>

<!-- Review Modal -->
<Modal open={showReviewModal} title={reviewStatus === 'ACCEPTED' ? $t('leaves.approve') : $t('leaves.refuse')} onClose={() => (showReviewModal = false)}>
    {#if reviewTarget}
        <div class="space-y-4">
            <div class="p-3 bg-gray-50 rounded-lg">
                <p class="text-sm font-medium text-gray-900">{reviewTarget.user?.name} {reviewTarget.user?.surname}</p>
                <p class="text-xs text-gray-500 mt-1">
                    {getLeaveLabel(reviewTarget.leaveType)} · {formatDate(reviewTarget.startDate)} — {formatDate(reviewTarget.endDate)} · {getTimeSlotLabel(reviewTarget.timeSlot)}
                </p>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('leaves.notes')} (optional)</label>
                <textarea
                        bind:value={reviewNotes}
                        rows="2"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Reason for decision..."
                ></textarea>
            </div>

            <div class="flex justify-end gap-3">
                <button on:click={() => (showReviewModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {$t('common.cancel')}
                </button>
                <button
                        on:click={handleReview}
                        class="px-4 py-2 text-sm font-medium text-white rounded-lg {reviewStatus === 'ACCEPTED'
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-red-600 hover:bg-red-700'}"
                >
                    {reviewStatus === 'ACCEPTED' ? $t('leaves.approve') : $t('leaves.refuse')}
                </button>
            </div>
        </div>
    {/if}
</Modal>