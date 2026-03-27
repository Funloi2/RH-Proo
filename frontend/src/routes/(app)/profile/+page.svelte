<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage, setLanguage } from '$lib/i18n';
    import { authStore } from '$lib/stores/auth';
    import { apiGet, apiPatch } from '$lib/api/client';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let user = $derived($authStore.user);

    let profile: any = $state(null);
    let loading = $state(true);
    let error = $state('');

    let editing = $state(false);
    let editForm = $state({
        name: '',
        surname: '',
        phone: '',
        birthday: '',
        city: '',
        address: '',
        postalCode: '',
        language: 'FR' as 'EN' | 'FR',
    });
    let editError = $state('');
    let editLoading = $state(false);
    let editSuccess = $state(false);

    onMount(() => {
        fetchProfile();
    });

    async function fetchProfile() {
        loading = true;
        error = '';
        try {
            profile = await apiGet('/users/me');
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    function startEditing() {
        editForm = {
            name: profile.name || '',
            surname: profile.surname || '',
            phone: profile.phone || '',
            birthday: profile.birthday ? profile.birthday.split('T')[0] : '',
            city: profile.city || '',
            address: profile.address || '',
            postalCode: profile.postalCode || '',
            language: profile.language || 'FR',
        };
        editError = '';
        editSuccess = false;
        editing = true;
    }

    function cancelEditing() {
        editing = false;
        editError = '';
        editSuccess = false;
    }

    async function handleSave() {
        editError = '';
        editLoading = true;
        editSuccess = false;
        try {
            const body: any = {};
            if (editForm.name !== profile.name) body.name = editForm.name;
            if (editForm.surname !== profile.surname) body.surname = editForm.surname;
            if (editForm.phone !== (profile.phone || '')) body.phone = editForm.phone;
            if (editForm.birthday !== (profile.birthday?.split('T')[0] || '')) body.birthday = editForm.birthday || undefined;
            if (editForm.city !== (profile.city || '')) body.city = editForm.city;
            if (editForm.address !== (profile.address || '')) body.address = editForm.address;
            if (editForm.postalCode !== (profile.postalCode || '')) body.postalCode = editForm.postalCode;
            if (editForm.language !== profile.language) body.language = editForm.language;

            if (Object.keys(body).length === 0) {
                editing = false;
                return;
            }

            await apiPatch('/users/me', body);

            authStore.updateUser({
                name: editForm.name,
                surname: editForm.surname,
                language: editForm.language,
            });

            if (editForm.language !== profile.language) {
                setLanguage(editForm.language);
            }

            editSuccess = true;
            editing = false;
            await fetchProfile();
        } catch (err: any) {
            editError = err.message;
        } finally {
            editLoading = false;
        }
    }

    function formatDate(d: string | null): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString();
    }
</script>

<div class="max-w-3xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">{$t('nav.profile')}</h1>

    {#if loading}
        <div class="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            {$t('common.loading')}
        </div>
    {:else if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {:else if profile}

        {#if editSuccess}
            <div class="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                {$t('common.success')} — Profile updated
            </div>
        {/if}

        <!-- Profile card -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Header with avatar -->
            <div class="px-6 py-8" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600" style="background: rgba(255,255,255,0.9);">
                        {profile.name[0]}{profile.surname[0]}
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">{profile.name} {profile.surname}</h2>
                        <p class="text-sm" style="color: rgba(255,255,255,0.8);">{profile.email}</p>
                        <div class="mt-2">
                            <StatusBadge
                                    label={profile.globalRole}
                                    color={profile.globalRole === 'ADMIN' ? 'purple' : 'blue'}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Info / Edit form -->
            <div class="p-6">
                {#if editing}
                    {#if editError}
                        <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{editError}</div>
                    {/if}

                    <form on:submit|preventDefault={handleSave} class="space-y-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.name')}</label>
                                <input type="text" bind:value={editForm.name} required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.surname')}</label>
                                <input type="text" bind:value={editForm.surname} required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">{$t('users.phone')}</label>
                                <input type="tel" bind:value={editForm.phone} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                                <input type="date" bind:value={editForm.birthday} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <input type="text" bind:value={editForm.city} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                                <input type="text" bind:value={editForm.postalCode} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div class="sm:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                <input type="text" bind:value={editForm.address} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Language</label>
                                <select bind:value={editForm.language} class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="FR">Français</option>
                                    <option value="EN">English</option>
                                </select>
                            </div>
                        </div>
                        <div class="flex justify-end gap-3 pt-2">
                            <button type="button" onclick={cancelEditing} class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                                {$t('common.cancel')}
                            </button>
                            <button type="submit" disabled={editLoading} class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {editLoading ? $t('common.loading') : $t('common.save')}
                            </button>
                        </div>
                    </form>
                {:else}
                    <div class="flex justify-end mb-4">
                        <button
                                onclick={startEditing}
                                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {$t('common.edit')}
                        </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                            <p class="text-xs font-medium text-gray-500">{$t('users.phone')}</p>
                            <p class="text-sm text-gray-900 mt-0.5">{profile.phone || '—'}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium text-gray-500">Birthday</p>
                            <p class="text-sm text-gray-900 mt-0.5">{formatDate(profile.birthday)}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium text-gray-500">City</p>
                            <p class="text-sm text-gray-900 mt-0.5">{profile.city || '—'}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium text-gray-500">Postal Code</p>
                            <p class="text-sm text-gray-900 mt-0.5">{profile.postalCode || '—'}</p>
                        </div>
                        <div class="sm:col-span-2">
                            <p class="text-xs font-medium text-gray-500">Address</p>
                            <p class="text-sm text-gray-900 mt-0.5">{profile.address || '—'}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium text-gray-500">Language</p>
                            <p class="text-sm text-gray-900 mt-0.5">{profile.language === 'FR' ? 'Français' : 'English'}</p>
                        </div>
                        <div>
                            <p class="text-xs font-medium text-gray-500">Member since</p>
                            <p class="text-sm text-gray-900 mt-0.5">{formatDate(profile.createdAt)}</p>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Groups -->
        {#if profile.groupMemberships?.length > 0}
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-900">{$t('groups.title')}</h3>
                </div>
                <div class="divide-y divide-gray-100">
                    {#each profile.groupMemberships as gm}
                        <div class="px-6 py-3 flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-900">{gm.group.name}</p>
                                <p class="text-xs text-gray-500">Joined {formatDate(gm.joinedAt)}</p>
                            </div>
                            <StatusBadge
                                    label={gm.role === 'DEPARTMENT_MANAGER' ? $t('groups.departmentManager') : $t('groups.member')}
                                    color={gm.role === 'DEPARTMENT_MANAGER' ? 'purple' : 'blue'}
                            />
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Leave balance -->
        {#if profile.leaveBalances?.length > 0}
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-sm font-semibold text-gray-900">{$t('leaves.balance')}</h3>
                </div>
                <div class="p-6">
                    {#each profile.leaveBalances as bal}
                        <div class="flex items-center gap-6 text-sm">
                            <div>
                                <p class="text-xs text-gray-500">{$t('dashboard.totalAllowance')}</p>
                                <p class="text-lg font-bold text-gray-900">{bal.totalAllowance + bal.additionalDays}</p>
                            </div>
                            {#if bal.additionalDays > 0}
                                <div>
                                    <p class="text-xs text-gray-500">Additional</p>
                                    <p class="text-lg font-bold text-green-600">+{bal.additionalDays}</p>
                                </div>
                            {/if}
                            <div class="text-xs text-gray-400">{bal.year}</div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    {/if}
</div>