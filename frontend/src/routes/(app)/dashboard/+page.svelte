<script lang="ts">
    import { authStore } from '$lib/stores/auth';
    import { t } from '$lib/i18n';
    import { apiGet } from '$lib/api/client';
    import { onMount } from 'svelte';

    $: user = $authStore.user;
    $: isAdmin = user?.globalRole === 'ADMIN';

    let balance: any = null;
    let pendingLeaves: any[] = [];
    let openTasks: any[] = [];

    onMount(async () => {
        try {
            balance = await apiGet('/leaves/my-balance');
        } catch { /* ignore */ }

        try {
            const taskData = await apiGet<{ data: any[] }>('/tasks?status=OPEN&limit=5');
            openTasks = taskData.data;
        } catch { /* ignore */ }

        if (isAdmin || user) {
            try {
                const leaveData = await apiGet<any[]>('/leaves/pending');
                pendingLeaves = Array.isArray(leaveData) ? leaveData : [];
            } catch { /* ignore */ }
        }
    });
</script>

<div class="space-y-6">
    <!-- Welcome -->
    <div>
        <h1 class="text-2xl font-bold text-gray-900">
            {$t('dashboard.welcome')} {user?.name} 👋
        </h1>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {#if balance}
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-sm text-gray-500">{$t('dashboard.totalAllowance')}</p>
                <p class="text-2xl font-bold text-gray-900 mt-1">
                    {balance.totalAllowance + balance.additionalDays}
                    <span class="text-sm font-normal text-gray-500">{$t('common.days')}</span>
                </p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-sm text-gray-500">{$t('dashboard.used')}</p>
                <p class="text-2xl font-bold text-blue-600 mt-1">
                    {balance.usedDays}
                    <span class="text-sm font-normal text-gray-500">{$t('common.days')}</span>
                </p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-sm text-gray-500">{$t('dashboard.pending')}</p>
                <p class="text-2xl font-bold text-amber-500 mt-1">
                    {balance.pendingDays}
                    <span class="text-sm font-normal text-gray-500">{$t('common.days')}</span>
                </p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <p class="text-sm text-gray-500">{$t('dashboard.available')}</p>
                <p class="text-2xl font-bold text-green-600 mt-1">
                    {balance.availableDays}
                    <span class="text-sm font-normal text-gray-500">{$t('common.days')}</span>
                </p>
            </div>
        {/if}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Pending leaves to review -->
        {#if pendingLeaves.length > 0}
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">{$t('dashboard.pendingLeaves')}</h2>
                <div class="space-y-3">
                    {#each pendingLeaves.slice(0, 5) as leave}
                        <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div>
                                <p class="text-sm font-medium text-gray-900">
                                    {leave.user?.name} {leave.user?.surname}
                                </p>
                                <p class="text-xs text-gray-500">
                                    {new Date(leave.startDate).toLocaleDateString()} — {new Date(leave.endDate).toLocaleDateString()}
                                </p>
                            </div>
                            <span
                                    class="px-2 py-1 text-xs font-medium rounded-full"
                                    style="background-color: {leave.leaveType?.color}20; color: {leave.leaveType?.color}"
                            >
                {leave.leaveType?.labelEn || leave.leaveType?.name}
              </span>
                        </div>
                    {/each}
                </div>
                <a href="/leaves" class="block mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    {$t('leaves.pendingReview')} →
                </a>
            </div>
        {/if}

        <!-- Open tasks -->
        {#if openTasks.length > 0}
            <div class="bg-white rounded-xl border border-gray-200 p-5">
                <h2 class="text-lg font-semibold text-gray-900 mb-4">{$t('dashboard.openTasks')}</h2>
                <div class="space-y-3">
                    {#each openTasks as task}
                        <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div>
                                <p class="text-sm font-medium text-gray-900">{task.title}</p>
                                <p class="text-xs text-gray-500">{task.group?.name}</p>
                            </div>
                            <span class="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
                {task.status}
              </span>
                        </div>
                    {/each}
                </div>
                <a href="/tasks" class="block mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                    {$t('tasks.title')} →
                </a>
            </div>
        {/if}
    </div>
</div>