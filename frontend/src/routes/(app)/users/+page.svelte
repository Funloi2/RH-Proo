<script lang="ts">
    import { onMount } from 'svelte';
    import { t } from '$lib/i18n';
    import { apiGet, apiPost, apiPatch, apiDelete } from '$lib/api/client';
    import Modal from '$lib/components/ui/Modal.svelte';
    import Pagination from '$lib/components/ui/Pagination.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    // State
    let users: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let search = $state('');
    let loading = $state(true);
    let error = $state('');

    // Create modal
    let showCreateModal = $state(false);
    let createForm = $state({ name: '', surname: '', email: '', phone: '', globalRole: 'USER', language: 'FR' });
    let createError = $state('');
    let createLoading = $state(false);

    // Edit modal
    let showEditModal = $state(false);
    let editUser: any = $state(null);
    let editForm = $state({ name: '', surname: '', email: '', phone: '', globalRole: 'USER', isActive: true });
    let editError = $state('');
    let editLoading = $state(false);

    // Delete confirm
    let showDeleteModal = $state(false);
    let deleteTarget: any = $state(null);

    let searchTimeout: ReturnType<typeof setTimeout>;

    onMount(() => {
        fetchUsers();
    });

    async function fetchUsers(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (search) params.set('search', search);
            const data = await apiGet<{ data: any[]; meta: any }>(`/users?${params}`);
            users = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchUsers(1), 300);
    }

    // Create
    async function handleCreate() {
        createError = '';
        createLoading = true;
        try {
            await apiPost('/users', createForm);
            showCreateModal = false;
            createForm = { name: '', surname: '', email: '', phone: '', globalRole: 'USER', language: 'FR' };
            await fetchUsers(meta.page);
        } catch (err: any) {
            createError = err.message;
        } finally {
            createLoading = false;
        }
    }

    // Edit
    function openEdit(user: any) {
        editUser = user;
        editForm = {
            name: user.name,
            surname: user.surname,
            email: user.email,
            phone: user.phone || '',
            globalRole: user.globalRole,
            isActive: user.isActive,
        };
        editError = '';
        showEditModal = true;
    }

    async function handleEdit() {
        editError = '';
        editLoading = true;
        try {
            await apiPatch(`/users/${editUser.id}`, editForm);
            showEditModal = false;
            await fetchUsers(meta.page);
        } catch (err: any) {
            editError = err.message;
        } finally {
            editLoading = false;
        }
    }

    // Delete
    function openDelete(user: any) {
        deleteTarget = user;
        showDeleteModal = true;
    }

    async function handleDelete() {
        try {
            await apiDelete(`/users/${deleteTarget.id}`);
            showDeleteModal = false;
            await fetchUsers(meta.page);
        } catch (err: any) {
            error = err.message;
        }
    }

    // Restore
    async function handleRestore(user: any) {
        try {
            await apiPatch(`/users/${user.id}/restore`);
            await fetchUsers(meta.page);
        } catch (err: any) {
            error = err.message;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">{$t('users.title')}</h1>
        <button
                on:click={() => (showCreateModal = true)}
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            {$t('users.createUser')}
        </button>
    </div>

    <!-- Search -->
    <div class="bg-white rounded-xl border border-gray-200 p-4">
        <input
                type="text"
                bind:value={search}
                on:input={handleSearch}
                placeholder={$t('users.search')}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
    </div>

    <!-- Error -->
    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Users table / cards -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if loading}
            <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
        {:else if users.length === 0}
            <div class="p-8 text-center text-gray-500">{$t('users.noUsers')}</div>
        {:else}
            <!-- Desktop table -->
            <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-200">
                    <tr>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('users.name')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('users.email')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('users.role')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('users.status')}</th>
                        <th class="text-left px-4 py-3 font-medium text-gray-500">{$t('groups.title')}</th>
                        <th class="text-right px-4 py-3 font-medium text-gray-500">{$t('common.actions')}</th>
                    </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                    {#each users as user}
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold">
                                        {user.name[0]}{user.surname[0]}
                                    </div>
                                    <div>
                                        <p class="font-medium text-gray-900">{user.name} {user.surname}</p>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-600">{user.email}</td>
                            <td class="px-4 py-3">
                                <StatusBadge
                                        label={user.globalRole}
                                        color={user.globalRole === 'ADMIN' ? 'purple' : 'blue'}
                                />
                            </td>
                            <td class="px-4 py-3">
                                {#if user.isDeleted}
                                    <StatusBadge label={$t('users.deleted')} color="red" />
                                {:else if user.isActive}
                                    <StatusBadge label={$t('users.active')} color="green" />
                                {:else}
                                    <StatusBadge label={$t('users.inactive')} color="gray" />
                                {/if}
                            </td>
                            <td class="px-4 py-3 text-gray-600">
                                {#if user.groupMemberships?.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        {#each user.groupMemberships as gm}
                                            <span class="px-1.5 py-0.5 text-xs bg-gray-100 rounded">{gm.group.name}</span>
                                        {/each}
                                    </div>
                                {:else}
                                    <span class="text-gray-400">—</span>
                                {/if}
                            </td>
                            <td class="px-4 py-3 text-right">
                                <div class="flex items-center justify-end gap-1">
                                    {#if user.isDeleted}
                                        <button
                                                on:click={() => handleRestore(user)}
                                                class="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded"
                                        >
                                            {$t('users.restoreUser')}
                                        </button>
                                    {:else}
                                        <button
                                                on:click={() => openEdit(user)}
                                                class="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                        >
                                            {$t('common.edit')}
                                        </button>
                                        <button
                                                on:click={() => openDelete(user)}
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
                {#each users as user}
                    <div class="p-4 space-y-2">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                                    {user.name[0]}{user.surname[0]}
                                </div>
                                <div>
                                    <p class="font-medium text-gray-900">{user.name} {user.surname}</p>
                                    <p class="text-xs text-gray-500">{user.email}</p>
                                </div>
                            </div>
                            <StatusBadge
                                    label={user.globalRole}
                                    color={user.globalRole === 'ADMIN' ? 'purple' : 'blue'}
                            />
                        </div>
                        <div class="flex items-center justify-between pt-2">
                            <div>
                                {#if user.isDeleted}
                                    <StatusBadge label={$t('users.deleted')} color="red" />
                                {:else if user.isActive}
                                    <StatusBadge label={$t('users.active')} color="green" />
                                {:else}
                                    <StatusBadge label={$t('users.inactive')} color="gray" />
                                {/if}
                            </div>
                            <div class="flex gap-2">
                                {#if user.isDeleted}
                                    <button
                                            on:click={() => handleRestore(user)}
                                            class="px-3 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                                    >
                                        {$t('users.restoreUser')}
                                    </button>
                                {:else}
                                    <button
                                            on:click={() => openEdit(user)}
                                            class="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                                    >
                                        {$t('common.edit')}
                                    </button>
                                    <button
                                            on:click={() => openDelete(user)}
                                            class="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
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
                <Pagination
                        page={meta.page}
                        totalPages={meta.totalPages}
                        onPageChange={(p) => fetchUsers(p)}
                />
            </div>
        {/if}
    </div>
</div>

<!-- Create User Modal -->
<Modal open={showCreateModal} title={$t('users.createUser')} onClose={() => (showCreateModal = false)}>
    {#if createError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>
    {/if}

    <form on:submit|preventDefault={handleCreate} class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.name')}</label>
                <input
                        type="text"
                        bind:value={createForm.name}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.surname')}</label>
                <input
                        type="text"
                        bind:value={createForm.surname}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.email')}</label>
            <input
                    type="email"
                    bind:value={createForm.email}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.phone')}</label>
            <input
                    type="tel"
                    bind:value={createForm.phone}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.role')}</label>
                <select
                        bind:value={createForm.globalRole}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
                <select
                        bind:value={createForm.language}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="FR">Français</option>
                    <option value="EN">English</option>
                </select>
            </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <button
                    type="button"
                    on:click={() => (showCreateModal = false)}
                    class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
                {$t('common.cancel')}
            </button>
            <button
                    type="submit"
                    disabled={createLoading}
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                {createLoading ? $t('common.loading') : $t('common.create')}
            </button>
        </div>
    </form>
</Modal>

<!-- Edit User Modal -->
<Modal open={showEditModal} title={$t('users.editUser')} onClose={() => (showEditModal = false)}>
    {#if editError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
    {/if}

    <form on:submit|preventDefault={handleEdit} class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.name')}</label>
                <input
                        type="text"
                        bind:value={editForm.name}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.surname')}</label>
                <input
                        type="text"
                        bind:value={editForm.surname}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.email')}</label>
            <input
                    type="email"
                    bind:value={editForm.email}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.phone')}</label>
            <input
                    type="tel"
                    bind:value={editForm.phone}
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>

        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.role')}</label>
                <select
                        bind:value={editForm.globalRole}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                </select>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.status')}</label>
                <select
                        bind:value={editForm.isActive}
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value={true}>{$t('users.active')}</option>
                    <option value={false}>{$t('users.inactive')}</option>
                </select>
            </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
            <button
                    type="button"
                    on:click={() => (showEditModal = false)}
                    class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
                {$t('common.cancel')}
            </button>
            <button
                    type="submit"
                    disabled={editLoading}
                    class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
                {editLoading ? $t('common.loading') : $t('common.save')}
            </button>
        </div>
    </form>
</Modal>

<!-- Delete Confirmation Modal -->
<Modal open={showDeleteModal} title={$t('users.deleteUser')} onClose={() => (showDeleteModal = false)}>
    <p class="text-sm text-gray-600 mb-6">
        {$t('users.confirmDelete')}
    </p>
    {#if deleteTarget}
        <div class="p-3 bg-gray-50 rounded-lg mb-6">
            <p class="text-sm font-medium text-gray-900">{deleteTarget.name} {deleteTarget.surname}</p>
            <p class="text-xs text-gray-500">{deleteTarget.email}</p>
        </div>
    {/if}
    <div class="flex justify-end gap-3">
        <button
                on:click={() => (showDeleteModal = false)}
                class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
            {$t('common.cancel')}
        </button>
        <button
                on:click={handleDelete}
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
            {$t('common.delete')}
        </button>
    </div>
</Modal>