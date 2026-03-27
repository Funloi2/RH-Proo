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

    // Groups list
    let groups: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let search = $state('');
    let loading = $state(true);
    let error = $state('');

    // Create group modal
    let showCreateModal = $state(false);
    let createForm = $state({ name: '', description: '' });
    let createError = $state('');
    let createLoading = $state(false);

    // Edit group modal
    let showEditModal = $state(false);
    let editGroup: any = $state(null);
    let editForm = $state({ name: '', description: '' });
    let editError = $state('');
    let editLoading = $state(false);

    // Delete group confirm
    let showDeleteModal = $state(false);
    let deleteTarget: any = $state(null);

    // Group detail / members view
    let selectedGroup: any = $state(null);
    let showGroupDetail = $state(false);

    // Add member modal
    let showAddMemberModal = $state(false);
    let allUsers: any[] = $state([]);
    let addMemberForm = $state({ userId: '', role: 'MEMBER' });
    let addMemberError = $state('');
    let addMemberLoading = $state(false);

    // Change role modal
    let showRoleModal = $state(false);
    let roleTarget: any = $state(null);
    let newRole = $state('MEMBER');

    let searchTimeout: ReturnType<typeof setTimeout>;

    onMount(() => {
        fetchGroups();
    });

    async function fetchGroups(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (search) params.set('search', search);
            const data = await apiGet<{ data: any[]; meta: any }>(`/groups?${params}`);
            groups = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchGroups(1), 300);
    }

    // Create group
    async function handleCreate() {
        createError = '';
        createLoading = true;
        try {
            await apiPost('/groups', createForm);
            showCreateModal = false;
            createForm = { name: '', description: '' };
            await fetchGroups(meta.page);
        } catch (err: any) {
            createError = err.message;
        } finally {
            createLoading = false;
        }
    }

    // Edit group
    function openEdit(group: any) {
        editGroup = group;
        editForm = { name: group.name, description: group.description || '' };
        editError = '';
        showEditModal = true;
    }

    async function handleEdit() {
        editError = '';
        editLoading = true;
        try {
            await apiPatch(`/groups/${editGroup.id}`, editForm);
            showEditModal = false;
            await fetchGroups(meta.page);
            if (selectedGroup?.id === editGroup.id) {
                await openGroupDetail(editGroup.id);
            }
        } catch (err: any) {
            editError = err.message;
        } finally {
            editLoading = false;
        }
    }

    // Delete group
    function openDelete(group: any) {
        deleteTarget = group;
        showDeleteModal = true;
    }

    async function handleDelete() {
        try {
            await apiDelete(`/groups/${deleteTarget.id}`);
            showDeleteModal = false;
            if (selectedGroup?.id === deleteTarget.id) {
                showGroupDetail = false;
                selectedGroup = null;
            }
            await fetchGroups(meta.page);
        } catch (err: any) {
            error = err.message;
            showDeleteModal = false;
        }
    }

    // Group detail
    async function openGroupDetail(groupId: string) {
        try {
            selectedGroup = await apiGet(`/groups/${groupId}`);
            showGroupDetail = true;
        } catch (err: any) {
            error = err.message;
        }
    }

    // Add member
    async function openAddMember() {
        addMemberError = '';
        addMemberForm = { userId: '', role: 'MEMBER' };
        try {
            const data = await apiGet<{ data: any[] }>('/users?limit=100&isActive=true');
            // Filter out users already in the group
            const memberIds = new Set(selectedGroup.members.map((m: any) => m.user.id));
            allUsers = data.data.filter((u: any) => !memberIds.has(u.id));
        } catch {
            allUsers = [];
        }
        showAddMemberModal = true;
    }

    async function handleAddMember() {
        addMemberError = '';
        addMemberLoading = true;
        try {
            await apiPost(`/groups/${selectedGroup.id}/members`, addMemberForm);
            showAddMemberModal = false;
            await openGroupDetail(selectedGroup.id);
            await fetchGroups(meta.page);
        } catch (err: any) {
            addMemberError = err.message;
        } finally {
            addMemberLoading = false;
        }
    }

    // Remove member
    async function handleRemoveMember(membership: any) {
        try {
            await apiDelete(`/groups/${selectedGroup.id}/members/${membership.id}`);
            await openGroupDetail(selectedGroup.id);
            await fetchGroups(meta.page);
        } catch (err: any) {
            error = err.message;
        }
    }

    // Change role
    function openRoleChange(membership: any) {
        roleTarget = membership;
        newRole = membership.role === 'MEMBER' ? 'DEPARTMENT_MANAGER' : 'MEMBER';
        showRoleModal = true;
    }

    async function handleRoleChange() {
        try {
            await apiPatch(`/groups/${selectedGroup.id}/members/${roleTarget.id}`, { role: newRole });
            showRoleModal = false;
            await openGroupDetail(selectedGroup.id);
            await fetchGroups(meta.page);
        } catch (err: any) {
            error = err.message;
            showRoleModal = false;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">{$t('groups.title')}</h1>
        {#if isAdmin}
            <button
                    on:click={() => (showCreateModal = true)}
                    class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                {$t('groups.createGroup')}
            </button>
        {/if}
    </div>

    <!-- Search -->
    <div class="bg-white rounded-xl border border-gray-200 p-4">
        <input
                type="text"
                bind:value={search}
                on:input={handleSearch}
                placeholder="Search groups..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
    </div>

    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Groups list -->
        <div class="lg:col-span-{showGroupDetail ? '1' : '3'}">
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {#if loading}
                    <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
                {:else if groups.length === 0}
                    <div class="p-8 text-center text-gray-500">{$t('groups.noGroups')}</div>
                {:else}
                    <div class="divide-y divide-gray-100">
                        {#each groups as group}
                            <button
                                    on:click={() => openGroupDetail(group.id)}
                                    class="w-full text-left p-4 hover:bg-gray-50 transition-colors {selectedGroup?.id === group.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
                            >
                                <div class="flex items-center justify-between">
                                    <div>
                                        <p class="font-medium text-gray-900">{group.name}</p>
                                        {#if group.description}
                                            <p class="text-sm text-gray-500 mt-0.5">{group.description}</p>
                                        {/if}
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-500">
                    <span class="flex items-center gap-1 ">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                        {group._count?.members || group.members?.length || 0}
                    </span>
                                    </div>
                                </div>
                            </button>
                        {/each}
                    </div>

                    <div class="px-4 pb-4">
                        <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchGroups(p)} />
                    </div>
                {/if}
            </div>
        </div>

        <!-- Group detail panel -->
        {#if showGroupDetail && selectedGroup}
            <div class="lg:col-span-2">
                <div class="bg-white rounded-xl border border-gray-200">
                    <!-- Group header -->
                    <div class="p-5 border-b border-gray-200">
                        <div class="flex items-center justify-between">
                            <div>
                                <h2 class="text-lg font-semibold text-gray-900">{selectedGroup.name}</h2>
                                {#if selectedGroup.description}
                                    <p class="text-sm text-gray-500 mt-1">{selectedGroup.description}</p>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2">
                                {#if isAdmin}
                                    <button
                                            on:click={() => openEdit(selectedGroup)}
                                            class="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                                    >
                                        {$t('common.edit')}
                                    </button>
                                    <button
                                            on:click={() => openDelete(selectedGroup)}
                                            class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                                    >
                                        {$t('common.delete')}
                                    </button>
                                {/if}
                                <button
                                        on:click={() => { showGroupDetail = false; selectedGroup = null; }}
                                        class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Members header -->
                    <div class="px-5 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
                        <h3 class="text-sm font-semibold text-gray-700  p-4">
                            {$t('groups.members')} ({selectedGroup.members?.length || 0})
                        </h3>
                        {#if isAdmin}
                            <button
                                    on:click={openAddMember}
                                    class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap"
                            >
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                {$t('groups.addMember')}
                            </button>
                        {/if}
                    </div>

                    <!-- Members list -->
                    <div class="divide-y divide-gray-100">
                        {#if selectedGroup.members?.length === 0}
                            <div class="p-6 text-center text-sm text-gray-500">{$t('common.noData')}</div>
                        {:else}
                            {#each selectedGroup.members as membership}
                                <div class="px-5 py-3 flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 ml-4 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                                            {membership.user.name[0]}{membership.user.surname[0]}
                                        </div>
                                        <div>
                                            <p class="text-sm font-medium text-gray-900">
                                                {membership.user.name} {membership.user.surname}
                                            </p>
                                            <p class="text-xs text-gray-500">{membership.user.email}</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <StatusBadge
                                                label={membership.role === 'DEPARTMENT_MANAGER' ? $t('groups.departmentManager') : $t('groups.member')}
                                                color={membership.role === 'DEPARTMENT_MANAGER' ? 'purple' : 'blue'}
                                        />
                                        {#if isAdmin}
                                            <button
                                                    on:click={() => openRoleChange(membership)}
                                                    class="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Change role"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                                </svg>
                                            </button>
                                            <button
                                                    on:click={() => handleRemoveMember(membership)}
                                                    class="px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                                    title="Remove member"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Create Group Modal -->
<Modal open={showCreateModal} title={$t('groups.createGroup')} onClose={() => (showCreateModal = false)}>
    {#if createError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>
    {/if}
    <form on:submit|preventDefault={handleCreate} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('groups.name')}</label>
            <input
                    type="text"
                    bind:value={createForm.name}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('groups.description')}</label>
            <textarea
                    bind:value={createForm.description}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

<!-- Edit Group Modal -->
<Modal open={showEditModal} title={$t('common.edit')} onClose={() => (showEditModal = false)}>
    {#if editError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
    {/if}
    <form on:submit|preventDefault={handleEdit} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('groups.name')}</label>
            <input
                    type="text"
                    bind:value={editForm.name}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('groups.description')}</label>
            <textarea
                    bind:value={editForm.description}
                    rows="3"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
        </div>
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

<!-- Delete Group Confirm -->
<Modal open={showDeleteModal} title={$t('common.delete')} onClose={() => (showDeleteModal = false)}>
    <p class="text-sm text-gray-600 mb-6">{$t('groups.confirmDelete')}</p>
    {#if deleteTarget}
        <div class="p-3 bg-gray-50 rounded-lg mb-6">
            <p class="text-sm font-medium text-gray-900">{deleteTarget.name}</p>
            {#if deleteTarget.description}
                <p class="text-xs text-gray-500">{deleteTarget.description}</p>
            {/if}
        </div>
    {/if}
    <div class="flex justify-end gap-3">
        <button on:click={() => (showDeleteModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            {$t('common.cancel')}
        </button>
        <button on:click={handleDelete} class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
            {$t('common.delete')}
        </button>
    </div>
</Modal>

<!-- Add Member Modal -->
<Modal open={showAddMemberModal} title={$t('groups.addMember')} onClose={() => (showAddMemberModal = false)}>
    {#if addMemberError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{addMemberError}</div>
    {/if}
    <form on:submit|preventDefault={handleAddMember} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
                    bind:value={addMemberForm.userId}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Select a user</option>
                {#each allUsers as u}
                    <option value={u.id}>{u.name} {u.surname} ({u.email})</option>
                {/each}
            </select>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('groups.role')}</label>
            <select
                    bind:value={addMemberForm.role}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="MEMBER">{$t('groups.member')}</option>
                <option value="DEPARTMENT_MANAGER">{$t('groups.departmentManager')}</option>
            </select>
        </div>
        <div class="flex justify-end gap-3 pt-2">
            <button type="button" on:click={() => (showAddMemberModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                {$t('common.cancel')}
            </button>
            <button type="submit" disabled={addMemberLoading} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {addMemberLoading ? $t('common.loading') : $t('groups.addMember')}
            </button>
        </div>
    </form>
</Modal>

<!-- Change Role Modal -->
<Modal open={showRoleModal} title="Change Role" onClose={() => (showRoleModal = false)}>
    {#if roleTarget}
        <p class="text-sm text-gray-600 mb-4">
            Change role for <span class="font-medium">{roleTarget.user.name} {roleTarget.user.surname}</span>:
        </p>
        <div class="p-3 bg-gray-50 rounded-lg mb-4 flex items-center justify-center gap-3">
            <StatusBadge
                    label={roleTarget.role === 'DEPARTMENT_MANAGER' ? $t('groups.departmentManager') : $t('groups.member')}
                    color={roleTarget.role === 'DEPARTMENT_MANAGER' ? 'purple' : 'blue'}
            />
            <span class="text-gray-400">→</span>
            <StatusBadge
                    label={newRole === 'DEPARTMENT_MANAGER' ? $t('groups.departmentManager') : $t('groups.member')}
                    color={newRole === 'DEPARTMENT_MANAGER' ? 'purple' : 'blue'}
            />
        </div>
    {/if}
    <div class="flex justify-end gap-3">
        <button on:click={() => (showRoleModal = false)} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            {$t('common.cancel')}
        </button>
        <button on:click={handleRoleChange} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            {$t('common.confirm')}
        </button>
    </div>
</Modal>