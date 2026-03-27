<script lang="ts">
    import { onMount } from 'svelte';
    import { t } from '$lib/i18n';
    import { authStore } from '$lib/stores/auth';
    import { apiGet, apiPost, apiPatch, apiDelete } from '$lib/api/client';
    import Modal from '$lib/components/ui/Modal.svelte';
    import Pagination from '$lib/components/ui/Pagination.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let user = $derived($authStore.user);
    let isAdmin = $derived(user?.globalRole === 'ADMIN');

    let manageableGroups = $derived(
        isAdmin
            ? groups
            : groups.filter((g) =>
                g.members?.some((m: any) => m.user?.id === user?.id && m.role === 'DEPARTMENT_MANAGER')
            )
    );

    // Tasks list
    let tasks: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let loading = $state(true);
    let error = $state('');

    // Filters
    let filterStatus = $state('');
    let filterGroupId = $state('');
    let groups: any[] = $state([]);

    // Create modal
    let showCreateModal = $state(false);
    let createForm = $state({ title: '', description: '', groupId: '', assignedTo: '' });
    let createError = $state('');
    let createLoading = $state(false);
    let groupMembers: any[] = $state([]);

    // Edit modal
    let showEditModal = $state(false);
    let editTask: any = $state(null);
    let editForm = $state({ title: '', description: '', assignedTo: '' });
    let editError = $state('');
    let editLoading = $state(false);
    let editGroupMembers: any[] = $state([]);

    // Status change modal
    let showStatusModal = $state(false);
    let statusTask: any = $state(null);
    let newStatus = $state('');

    // Delete confirm
    let showDeleteModal = $state(false);
    let deleteTarget: any = $state(null);

    // Detail view
    let showDetailModal = $state(false);
    let detailTask: any = $state(null);

    onMount(() => {
        fetchTasks();
        fetchGroups();
    });

    async function fetchGroups() {
        try {
            const data = await apiGet<{ data: any[] }>('/groups?limit=100');
            groups = data.data;
        } catch { /* ignore */ }
    }

    async function fetchTasks(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (filterStatus) params.set('status', filterStatus);
            if (filterGroupId) params.set('groupId', filterGroupId);
            const data = await apiGet<{ data: any[]; meta: any }>(`/tasks?${params}`);
            tasks = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    function applyFilters() {
        fetchTasks(1);
    }

    function getStatusColor(status: string): 'blue' | 'amber' | 'green' | 'gray' {
        switch (status) {
            case 'OPEN': return 'blue';
            case 'IN_PROGRESS': return 'amber';
            case 'CLOSED': return 'green';
            default: return 'gray';
        }
    }

    function getStatusLabel(status: string): string {
        switch (status) {
            case 'OPEN': return $t('tasks.open');
            case 'IN_PROGRESS': return $t('tasks.inProgress');
            case 'CLOSED': return $t('tasks.closed');
            default: return status;
        }
    }

    // Create
    async function openCreateModal() {
        createForm = { title: '', description: '', groupId: '', assignedTo: '' };
        createError = '';
        groupMembers = [];
        showCreateModal = true;
    }

    async function onCreateGroupChange() {
        groupMembers = [];
        createForm.assignedTo = '';
        if (createForm.groupId) {
            try {
                const members = await apiGet<any[]>(`/groups/${createForm.groupId}/members`);
                groupMembers = members;
            } catch { /* ignore */ }
        }
    }

    async function handleCreate() {
        createError = '';
        createLoading = true;
        try {
            const body: any = {
                title: createForm.title,
                groupId: createForm.groupId,
            };
            if (createForm.description) body.description = createForm.description;
            if (createForm.assignedTo) body.assignedTo = createForm.assignedTo;

            await apiPost('/tasks', body);
            showCreateModal = false;
            await fetchTasks(meta.page);
        } catch (err: any) {
            createError = err.message;
        } finally {
            createLoading = false;
        }
    }

    // Detail
    async function openDetail(task: any) {
        try {
            detailTask = await apiGet(`/tasks/${task.id}`);
            showDetailModal = true;
        } catch (err: any) {
            error = err.message;
        }
    }

    // Edit
    async function openEdit(task: any) {
        editTask = task;
        editForm = {
            title: task.title,
            description: task.description || '',
            assignedTo: task.assignedTo || '',
        };
        editError = '';
        editGroupMembers = [];
        try {
            const members = await apiGet<any[]>(`/groups/${task.groupId}/members`);
            editGroupMembers = members;
        } catch { /* ignore */ }
        showEditModal = true;
    }

    async function handleEdit() {
        editError = '';
        editLoading = true;
        try {
            const body: any = { title: editForm.title };
            if (editForm.description !== undefined) body.description = editForm.description;
            if (editForm.assignedTo) body.assignedTo = editForm.assignedTo;

            await apiPatch(`/tasks/${editTask.id}`, body);
            showEditModal = false;
            await fetchTasks(meta.page);
        } catch (err: any) {
            editError = err.message;
        } finally {
            editLoading = false;
        }
    }

    // Status change
    function openStatusChange(task: any) {
        statusTask = task;
        // Default to the next logical status
        if (task.status === 'OPEN') newStatus = 'IN_PROGRESS';
        else if (task.status === 'IN_PROGRESS') newStatus = 'CLOSED';
        else newStatus = 'OPEN';
        showStatusModal = true;
    }

    async function handleStatusChange() {
        try {
            await apiPatch(`/tasks/${statusTask.id}/status`, { status: newStatus });
            showStatusModal = false;
            await fetchTasks(meta.page);
        } catch (err: any) {
            error = err.message;
            showStatusModal = false;
        }
    }

    // Delete
    function openDeleteConfirm(task: any) {
        deleteTarget = task;
        showDeleteModal = true;
    }

    async function handleDelete() {
        try {
            await apiDelete(`/tasks/${deleteTarget.id}`);
            showDeleteModal = false;
            await fetchTasks(meta.page);
        } catch (err: any) {
            error = err.message;
            showDeleteModal = false;
        }
    }

    // Check if current user can manage a task (is DM in the group or admin)
    function canManage(task: any): boolean {
        if (isAdmin) return true;
        const group = groups.find((g: any) => g.id === task.groupId);
        if (!group) return false;
        const membership = group.members?.find((m: any) => m.user?.id === user?.id);
        return membership?.role === 'DEPARTMENT_MANAGER';
    }

    // Check if current user is the assignee
    function isAssignee(task: any): boolean {
        return task.assignedTo === user?.id;
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">{$t('tasks.title')}</h1>
        {#if isAdmin || groups.some((g) => g.members?.some((m) => m.user?.id === user?.id && m.role === 'DEPARTMENT_MANAGER'))}
            <button
                    on:click={openCreateModal}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
                <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                {$t('tasks.createTask')}
            </button>
        {/if}
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex flex-col sm:flex-row gap-3">
            <select
                    bind:value={filterStatus}
                    on:change={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">{$t('tasks.status')}: All</option>
                <option value="OPEN">{$t('tasks.open')}</option>
                <option value="IN_PROGRESS">{$t('tasks.inProgress')}</option>
                <option value="CLOSED">{$t('tasks.closed')}</option>
            </select>

            <select
                    bind:value={filterGroupId}
                    on:change={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">{$t('tasks.group')}: All</option>
                {#each groups as group}
                    <option value={group.id}>{group.name}</option>
                {/each}
            </select>
        </div>
    </div>

    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Tasks list -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if loading}
            <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
        {:else if tasks.length === 0}
            <div class="p-8 text-center text-gray-500">{$t('tasks.noTasks')}</div>
        {:else}
            <!-- Desktop table -->
            <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('tasks.taskTitle')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('tasks.group')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('tasks.assignedTo')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('tasks.status')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                        <th class="text-right px-4 py-3 font-medium text-gray-500">{$t('common.actions')}</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    {#each tasks as task}
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <button on:click={() => openDetail(task)} class="text-left hover:text-blue-600">
                                    <p class="font-medium text-gray-900">{task.title}</p>
                                    {#if task.description}
                                        <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                                    {/if}
                                </button>
                            </td>
                            <td class="px-4 py-3 text-gray-600">{task.group?.name || '—'}</td>
                            <td class="px-4 py-3">
                                {#if task.assignee}
                                    <div class="flex items-center gap-2">
                                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                                            {task.assignee.name[0]}{task.assignee.surname[0]}
                                        </div>
                                        <span class="text-gray-600">{task.assignee.name} {task.assignee.surname}</span>
                                    </div>
                                {:else}
                                    <span class="text-gray-400">—</span>
                                {/if}
                            </td>
                            <td class="px-4 py-3">
                                <button on:click={() => openStatusChange(task)} class="hover:opacity-80">
                                    <StatusBadge label={getStatusLabel(task.status)} color={getStatusColor(task.status)} />
                                </button>
                            </td>
                            <td class="px-4 py-3 text-gray-500 text-xs">
                                {new Date(task.createdAt).toLocaleDateString()}
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    {#if canManage(task) || isAssignee(task)}
                                        <button
                                                on:click={() => openStatusChange(task)}
                                                class="px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded"
                                                title="Change status"
                                        >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                            </svg>
                                        </button>
                                    {/if}
                                    {#if canManage(task)}
                                        <button
                                                on:click={() => openEdit(task)}
                                                class="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                            {$t('common.edit')}
                                        </button>
                                        <button
                                                on:click={() => openDeleteConfirm(task)}
                                                class="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                                        >
                                            {$t('common.delete')}
                                        </button>
                                    {/if}
                                </div>
                            </td>
                        </tr>
                    {/each}
                    </tbody>
                </table>
            </div>

            <!-- Mobile cards -->
            <div class="md:hidden divide-y divide-gray-100">
                {#each tasks as task}
                    <div class="p-4 space-y-3">
                        <div class="flex items-start justify-between">
                            <button on:click={() => openDetail(task)} class="text-left flex-1 min-w-0">
                                <p class="font-medium text-gray-900">{task.title}</p>
                                {#if task.description}
                                    <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                                {/if}
                            </button>
                            <StatusBadge label={getStatusLabel(task.status)} color={getStatusColor(task.status)} />
                        </div>

                        <div class="flex items-center justify-between text-sm">
                            <div class="flex items-center gap-3 text-gray-500">
                                <span class="text-xs bg-gray-100 px-2 py-0.5 rounded">{task.group?.name}</span>
                                {#if task.assignee}
                                    <span class="text-xs">{task.assignee.name} {task.assignee.surname}</span>
                                {/if}
                            </div>
                            <div class="flex gap-1">
                                {#if canManage(task) || isAssignee(task)}
                                    <button
                                            on:click={() => openStatusChange(task)}
                                            class="px-2 py-1 text-xs font-medium text-amber-600 border border-amber-200 rounded hover:bg-amber-50"
                                    >
                                        Status
                                    </button>
                                {/if}
                                {#if canManage(task)}
                                    <button
                                            on:click={() => openEdit(task)}
                                            class="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                                    >
                                        {$t('common.edit')}
                                    </button>
                                    <button
                                            on:click={() => openDeleteConfirm(task)}
                                            class="px-2 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50"
                                    >
                                        {$t('common.delete')}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="px-4 pb-4">
                <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchTasks(p)} />
            </div>
        {/if}
    </div>
</div>

<!-- Create Task Modal -->
<Modal open={showCreateModal} title={$t('tasks.createTask')} onClose={() => (showCreateModal = false)}>
    {#if createError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>
    {/if}
    <form on:submit|preventDefault={handleCreate} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.taskTitle')}</label>
            <input
                    type="text"
                    bind:value={createForm.title}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.description')}</label>
            <textarea
                    bind:value={createForm.description}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.group')}</label>
            <select
                    bind:value={createForm.groupId}
                    on:change={onCreateGroupChange}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Select a group</option>
                {#each manageableGroups as group}
                    <option value={group.id}>{group.name}</option>
                {/each}
            </select>
        </div>
        {#if groupMembers.length > 0}
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.assignedTo')}</label>
                <select
                        bind:value={createForm.assignedTo}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Unassigned</option>
                    {#each groupMembers as member}
                        <option value={member.user.id}>{member.user.name} {member.user.surname}</option>
                    {/each}
                </select>
            </div>
        {/if}
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

<!-- Edit Task Modal -->
<Modal open={showEditModal} title={$t('common.edit')} onClose={() => (showEditModal = false)}>
    {#if editError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
    {/if}
    <form on:submit|preventDefault={handleEdit} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.taskTitle')}</label>
            <input
                    type="text"
                    bind:value={editForm.title}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.description')}</label>
            <textarea
                    bind:value={editForm.description}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>
        {#if editGroupMembers.length > 0}
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('tasks.assignedTo')}</label>
                <select
                        bind:value={editForm.assignedTo}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Unassigned</option>
                    {#each editGroupMembers as member}
                        <option value={member.user.id}>{member.user.name} {member.user.surname}</option>
                    {/each}
                </select>
            </div>
        {/if}
        <div class="flex justify-end gap-3 pt-2">
            <button type="button" on:click={() => (showEditModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {$t('common.cancel')}
            </button>
            <button type="submit" disabled={editLoading} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editLoading ? $t('common.loading') : $t('common.save')}
            </button>
        </div>
    </form>
</Modal>

<!-- Status Change Modal -->
<Modal open={showStatusModal} title="Change Status" onClose={() => (showStatusModal = false)}>
    {#if statusTask}
        <div class="space-y-4">
            <p class="text-sm text-gray-600">
                Update status for <span class="font-medium">"{statusTask.title}"</span>
            </p>

            <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-center gap-3">
                <StatusBadge label={getStatusLabel(statusTask.status)} color={getStatusColor(statusTask.status)} />
                <span class="text-gray-400">→</span>
                <StatusBadge label={getStatusLabel(newStatus)} color={getStatusColor(newStatus)} />
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New status</label>
                <select
                        bind:value={newStatus}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="OPEN">{$t('tasks.open')}</option>
                    <option value="IN_PROGRESS">{$t('tasks.inProgress')}</option>
                    <option value="CLOSED">{$t('tasks.closed')}</option>
                </select>
            </div>

            <div class="flex justify-end gap-3 pt-2">
                <button on:click={() => (showStatusModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {$t('common.cancel')}
                </button>
                <button on:click={handleStatusChange} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                    {$t('common.confirm')}
                </button>
            </div>
        </div>
    {/if}
</Modal>

<!-- Task Detail Modal -->
<Modal open={showDetailModal} title={detailTask?.title || ''} onClose={() => (showDetailModal = false)}>
    {#if detailTask}
        <div class="space-y-4">
            <div class="flex items-center gap-2">
                <StatusBadge label={getStatusLabel(detailTask.status)} color={getStatusColor(detailTask.status)} />
                <span class="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{detailTask.group?.name}</span>
            </div>

            {#if detailTask.description}
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('tasks.description')}</p>
                    <p class="text-sm text-gray-700 whitespace-pre-wrap">{detailTask.description}</p>
                </div>
            {/if}

            <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Created by</p>
                    {#if detailTask.creator}
                        <p class="text-gray-700">{detailTask.creator.name} {detailTask.creator.surname}</p>
                    {:else}
                        <p class="text-gray-400">—</p>
                    {/if}
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">{$t('tasks.assignedTo')}</p>
                    {#if detailTask.assignee}
                        <p class="text-gray-700">{detailTask.assignee.name} {detailTask.assignee.surname}</p>
                    {:else}
                        <p class="text-gray-400">Unassigned</p>
                    {/if}
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Created</p>
                    <p class="text-gray-700">{new Date(detailTask.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                    <p class="text-xs font-medium text-gray-500 mb-1">Last updated</p>
                    <p class="text-gray-700">{new Date(detailTask.updatedAt).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    {/if}
</Modal>

<!-- Delete Task Confirm -->
<Modal open={showDeleteModal} title={$t('common.delete')} onClose={() => (showDeleteModal = false)}>
    {#if deleteTarget}
        <p class="text-sm text-gray-600 mb-4">Are you sure you want to delete this task?</p>
        <div class="p-3 bg-gray-50 rounded-lg mb-6">
            <p class="text-sm font-medium text-gray-900">{deleteTarget.title}</p>
            <p class="text-xs text-gray-500">{deleteTarget.group?.name}</p>
        </div>
        <div class="flex justify-end gap-3">
            <button on:click={() => (showDeleteModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {$t('common.cancel')}
            </button>
            <button on:click={handleDelete} class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                {$t('common.delete')}
            </button>
        </div>
    {/if}
</Modal>