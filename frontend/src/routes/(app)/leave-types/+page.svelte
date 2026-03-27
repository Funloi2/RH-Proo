<script lang="ts">
    import { onMount } from 'svelte';
    import { t } from '$lib/i18n';
    import { apiGet, apiPost, apiPatch } from '$lib/api/client';
    import Modal from '$lib/components/ui/Modal.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let leaveTypes: any[] = $state([]);
    let loading = $state(true);
    let error = $state('');

    // Create modal
    let showCreateModal = $state(false);
    let createForm = $state({
        name: '',
        labelEn: '',
        labelFr: '',
        color: '#3B82F6',
        isDeductible: true,
    });
    let createError = $state('');
    let createLoading = $state(false);

    // Edit modal
    let showEditModal = $state(false);
    let editTarget: any = $state(null);
    let editForm = $state({
        name: '',
        labelEn: '',
        labelFr: '',
        color: '#3B82F6',
        isDeductible: true,
    });
    let editError = $state('');
    let editLoading = $state(false);

    onMount(() => {
        fetchLeaveTypes();
    });

    async function fetchLeaveTypes() {
        loading = true;
        error = '';
        try {
            leaveTypes = await apiGet<any[]>('/leave-types?includeInactive=true');
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    // Create
    async function handleCreate() {
        createError = '';
        createLoading = true;
        try {
            await apiPost('/leave-types', createForm);
            showCreateModal = false;
            createForm = { name: '', labelEn: '', labelFr: '', color: '#3B82F6', isDeductible: true };
            await fetchLeaveTypes();
        } catch (err: any) {
            createError = err.message;
        } finally {
            createLoading = false;
        }
    }

    // Edit
    function openEdit(lt: any) {
        editTarget = lt;
        editForm = {
            name: lt.name,
            labelEn: lt.labelEn,
            labelFr: lt.labelFr,
            color: lt.color,
            isDeductible: lt.isDeductible,
        };
        editError = '';
        showEditModal = true;
    }

    async function handleEdit() {
        editError = '';
        editLoading = true;
        try {
            await apiPatch(`/leave-types/${editTarget.id}`, editForm);
            showEditModal = false;
            await fetchLeaveTypes();
        } catch (err: any) {
            editError = err.message;
        } finally {
            editLoading = false;
        }
    }

    // Toggle active state
    async function toggleActive(lt: any) {
        try {
            if (lt.isActive) {
                await apiPatch(`/leave-types/${lt.id}/deactivate`);
            } else {
                await apiPatch(`/leave-types/${lt.id}/reactivate`);
            }
            await fetchLeaveTypes();
        } catch (err: any) {
            error = err.message;
        }
    }

    // Reorder — move up
    async function moveUp(index: number) {
        if (index === 0) return;
        const ids = leaveTypes.map((lt) => lt.id);
        [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
        try {
            await apiPost('/leave-types/reorder', { orderedIds: ids });
            await fetchLeaveTypes();
        } catch (err: any) {
            error = err.message;
        }
    }

    // Reorder — move down
    async function moveDown(index: number) {
        if (index === leaveTypes.length - 1) return;
        const ids = leaveTypes.map((lt) => lt.id);
        [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
        try {
            await apiPost('/leave-types/reorder', { orderedIds: ids });
            await fetchLeaveTypes();
        } catch (err: any) {
            error = err.message;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">{$t('nav.leaveTypes')}</h1>
            <p class="text-sm text-gray-500 mt-1">Manage the types of leave available to employees</p>
        </div>
        <button
                on:click={() => (showCreateModal = true)}
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Leave Type
        </button>
    </div>

    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Leave types list -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if loading}
            <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
        {:else if leaveTypes.length === 0}
            <div class="p-8 text-center text-gray-500">{$t('common.noData')}</div>
        {:else}
            <div class="divide-y divide-gray-100">
                {#each leaveTypes as lt, index}
                    <div class="p-4 flex flex-col sm:flex-row sm:items-center gap-4 {lt.isActive ? '' : 'opacity-50'}">
                        <!-- Color + labels -->
                        <div class="flex items-center gap-4 flex-1 min-w-0">
                            <!-- Color swatch -->
                            <div
                                    class="w-10 h-10 rounded-lg shrink-0 border border-gray-200"
                                    style="background-color: {lt.color}"
                            ></div>

                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="font-medium text-gray-900">{lt.labelEn}</p>
                                    {#if !lt.isActive}
                                        <StatusBadge label="Inactive" color="gray" />
                                    {/if}
                                </div>
                                <p class="text-sm text-gray-500">{lt.labelFr}</p>
                                <div class="flex items-center gap-3 mt-1">
                                    <span class="text-xs text-gray-400">Key: {lt.name}</span>
                                    <span class="text-xs {lt.isDeductible ? 'text-amber-600' : 'text-gray-400'}">
                    {lt.isDeductible ? 'Deductible' : 'Non-deductible'}
                  </span>
                                </div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex items-center gap-1 shrink-0">
                            <!-- Reorder buttons -->
                            <button
                                    on:click={() => moveUp(index)}
                                    disabled={index === 0}
                                    class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move up"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                            <button
                                    on:click={() => moveDown(index)}
                                    disabled={index === leaveTypes.length - 1}
                                    class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Move down"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div class="w-px h-6 bg-gray-200 mx-1"></div>

                            <!-- Edit -->
                            <button
                                    on:click={() => openEdit(lt)}
                                    class="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                                {$t('common.edit')}
                            </button>

                            <!-- Toggle active -->
                            <button
                                    on:click={() => toggleActive(lt)}
                                    class="px-2.5 py-1.5 text-xs font-medium rounded-lg {lt.isActive
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-green-600 hover:bg-green-50'}"
                            >
                                {lt.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Create Leave Type Modal -->
<Modal open={showCreateModal} title="Add Leave Type" onClose={() => (showCreateModal = false)}>
    {#if createError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{createError}</div>
    {/if}
    <form on:submit|preventDefault={handleCreate} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Internal key</label>
            <input
                    type="text"
                    bind:value={createForm.name}
                    required
                    placeholder="e.g. parental_leave"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-400">Lowercase with underscores, used internally</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">English label</label>
                <input
                        type="text"
                        bind:value={createForm.labelEn}
                        required
                        placeholder="Parental Leave"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">French label</label>
                <input
                        type="text"
                        bind:value={createForm.labelFr}
                        required
                        placeholder="Congé Parental"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div class="flex items-center gap-3">
                    <input
                            type="color"
                            bind:value={createForm.color}
                            class="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                            type="text"
                            bind:value={createForm.color}
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deductible?</label>
                <div class="flex items-center gap-3 h-10">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={createForm.isDeductible} class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span class="text-sm text-gray-600">Counts against leave balance</span>
                    </label>
                </div>
            </div>
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

<!-- Edit Leave Type Modal -->
<Modal open={showEditModal} title="Edit Leave Type" onClose={() => (showEditModal = false)}>
    {#if editError}
        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
    {/if}
    <form on:submit|preventDefault={handleEdit} class="space-y-4">
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Internal key</label>
            <input
                    type="text"
                    bind:value={editForm.name}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">English label</label>
                <input
                        type="text"
                        bind:value={editForm.labelEn}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">French label</label>
                <input
                        type="text"
                        bind:value={editForm.labelFr}
                        required
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div class="flex items-center gap-3">
                    <input
                            type="color"
                            bind:value={editForm.color}
                            class="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                            type="text"
                            bind:value={editForm.color}
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                </div>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deductible?</label>
                <div class="flex items-center gap-3 h-10">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" bind:checked={editForm.isDeductible} class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span class="text-sm text-gray-600">Counts against leave balance</span>
                    </label>
                </div>
            </div>
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