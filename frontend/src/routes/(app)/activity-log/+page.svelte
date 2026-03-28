<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage } from '$lib/i18n';
    import { apiGet, apiPost } from '$lib/api/client';
    import Pagination from '$lib/components/ui/Pagination.svelte';
    import StatusBadge from '$lib/components/ui/StatusBadge.svelte';

    let lang = $derived($currentLanguage);

    // Data
    let logs: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 30, totalPages: 0 });
    let loading = $state(true);
    let error = $state('');

    // Action types for filter dropdown
    let actionTypes: string[] = $state([]);

    // Summary
    let summary: any = $state(null);
    let summaryDays = $state(30);

    // Filters
    let filterAction = $state('');
    let filterTargetType = $state('');
    let filterStartDate = $state('');
    let filterEndDate = $state('');

    // Archive
    let archiving = $state(false);
    let archiveResult = $state('');

    const targetTypes = ['user', 'group', 'group_membership', 'leave_request', 'leave_balance', 'leave_type', 'task'];

    onMount(async () => {
        await Promise.all([
            fetchLogs(),
            fetchActionTypes(),
            fetchSummary(),
        ]);
    });

    async function fetchLogs(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '30' });
            if (filterAction) params.set('action', filterAction);
            if (filterTargetType) params.set('targetType', filterTargetType);
            if (filterStartDate) params.set('startDate', filterStartDate);
            if (filterEndDate) params.set('endDate', filterEndDate);

            const data = await apiGet<{ data: any[]; meta: any }>(`/activity-log?${params}`);
            logs = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    async function fetchActionTypes() {
        try {
            actionTypes = await apiGet<string[]>('/activity-log/actions');
        } catch {}
    }

    async function fetchSummary() {
        try {
            summary = await apiGet(`/activity-log/summary?days=${summaryDays}`);
        } catch {}
    }

    function applyFilters() {
        fetchLogs(1);
    }

    function clearFilters() {
        filterAction = '';
        filterTargetType = '';
        filterStartDate = '';
        filterEndDate = '';
        fetchLogs(1);
    }

    async function handleArchive() {
        archiving = true;
        archiveResult = '';
        try {
            const data = await apiPost<{ archived: number; fileName: string | null }>('/activity-log/archive');
            if (data.archived === 0) {
                archiveResult = lang === 'FR' ? 'Aucune entrée à archiver.' : 'No entries to archive.';
            } else {
                archiveResult = lang === 'FR'
                    ? `${data.archived} entrées archivées dans ${data.fileName}`
                    : `${data.archived} entries archived to ${data.fileName}`;
            }
            await fetchLogs(1);
            await fetchSummary();
        } catch (err: any) {
            archiveResult = err.message;
        } finally {
            archiving = false;
        }
    }

    function getActionColor(action: string): 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray' {
        if (action.includes('created') || action.includes('added') || action.includes('restored') || action.includes('reactivated')) return 'green';
        if (action.includes('deleted') || action.includes('removed') || action.includes('refused') || action.includes('deactivated')) return 'red';
        if (action.includes('approved') || action.includes('accepted')) return 'green';
        if (action.includes('updated') || action.includes('reordered') || action.includes('adjusted')) return 'blue';
        if (action.includes('requested') || action.includes('submitted')) return 'amber';
        if (action.includes('closed') || action.includes('setup') || action.includes('reset')) return 'purple';
        return 'gray';
    }

    function formatAction(action: string): string {
        return action.replace(/_/g, ' ');
    }

    function formatTargetType(type: string | null): string {
        if (!type) return '—';
        return type.replace(/_/g, ' ');
    }

    function timeAgo(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return lang === 'FR' ? "à l'instant" : 'just now';
        if (diffMin < 60) return `${diffMin}m ${lang === 'FR' ? 'il y a' : 'ago'}`;
        if (diffHours < 24) return `${diffHours}h ${lang === 'FR' ? 'il y a' : 'ago'}`;
        if (diffDays < 7) return `${diffDays}d ${lang === 'FR' ? 'il y a' : 'ago'}`;
        return date.toLocaleDateString();
    }

    let hasActiveFilters = $derived(!!filterAction || !!filterTargetType || !!filterStartDate || !!filterEndDate);
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">{$t('nav.activityLog')}</h1>
            {#if summary}
                <p class="text-sm text-gray-500 mt-1">
                    {summary.totalActivities} {lang === 'FR' ? 'activités ces' : 'activities in the last'} {summaryDays} {lang === 'FR' ? 'derniers jours' : 'days'}
                </p>
            {/if}
        </div>
        <button
                onclick={handleArchive}
                disabled={archiving}
                class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
        >
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            {archiving ? (lang === 'FR' ? 'Archivage...' : 'Archiving...') : (lang === 'FR' ? 'Archiver (+1 an)' : 'Archive (1yr+)')}
        </button>
    </div>

    {#if archiveResult}
        <div class="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
            {archiveResult}
        </div>
    {/if}

    <!-- Summary cards -->
    {#if summary?.byAction?.length > 0}
        <div class="bg-white rounded-xl border border-gray-200 p-4">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-700">
                    {lang === 'FR' ? 'Résumé' : 'Summary'} — {summaryDays} {$t('common.days')}
                </h3>
                <div class="flex gap-1">
                    {#each [7, 30, 90] as days}
                        <button
                                onclick={() => { summaryDays = days; fetchSummary(); }}
                                class="px-2 py-1 text-xs rounded {summaryDays === days ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}"
                        >
                            {days}d
                        </button>
                    {/each}
                </div>
            </div>
            <div class="flex flex-wrap gap-2">
                {#each summary.byAction.slice(0, 10) as item}
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg">
                        <StatusBadge label={formatAction(item.action)} color={getActionColor(item.action)} />
                        <span class="text-xs font-bold text-gray-700">{item.count}</span>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <!-- Filters -->
    <div class="bg-white rounded-xl border border-gray-200 p-4">
        <div class="flex flex-col sm:flex-row gap-3">
            <select
                    bind:value={filterAction}
                    onchange={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Action: {lang === 'FR' ? 'Toutes' : 'All'}</option>
                {#each actionTypes as action}
                    <option value={action}>{formatAction(action)}</option>
                {/each}
            </select>

            <select
                    bind:value={filterTargetType}
                    onchange={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Target: {lang === 'FR' ? 'Tous' : 'All'}</option>
                {#each targetTypes as tt}
                    <option value={tt}>{formatTargetType(tt)}</option>
                {/each}
            </select>

            <input
                    type="date"
                    bind:value={filterStartDate}
                    onchange={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="From"
            />

            <input
                    type="date"
                    bind:value={filterEndDate}
                    onchange={applyFilters}
                    class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="To"
            />

            {#if hasActiveFilters}
                <button
                        onclick={clearFilters}
                        class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg whitespace-nowrap"
                >
                    {lang === 'FR' ? 'Effacer' : 'Clear'}
                </button>
            {/if}
        </div>
    </div>

    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Activity log list -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if loading}
            <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
        {:else if logs.length === 0}
            <div class="p-8 text-center text-gray-500">{$t('common.noData')}</div>
        {:else}
            <div class="divide-y divide-gray-100">
                {#each logs as log}
                    <div class="px-4 sm:px-5 py-3 flex items-start gap-3 hover:bg-gray-50/50 transition-colors">
                        <!-- Action icon -->
                        <div class="mt-0.5 shrink-0">
                            {#if log.action.includes('created') || log.action.includes('added')}
                                <div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                            {:else if log.action.includes('deleted') || log.action.includes('removed')}
                                <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </div>
                            {:else if log.action.includes('approved') || log.action.includes('accepted')}
                                <div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            {:else if log.action.includes('refused')}
                                <div class="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </div>
                            {:else if log.action.includes('updated') || log.action.includes('adjusted')}
                                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                            {:else}
                                <div class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            {/if}
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium text-gray-900">
                  {log.actor?.name || 'System'} {log.actor?.surname || ''}
                </span>
                                <StatusBadge label={formatAction(log.action)} color={getActionColor(log.action)} />
                            </div>
                            <div class="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                {#if log.targetType}
                                    <span class="capitalize">{formatTargetType(log.targetType)}</span>
                                    {#if log.targetId}
                                        <span class="text-gray-300">·</span>
                                        <span class="font-mono text-gray-400">{log.targetId.slice(0, 8)}</span>
                                    {/if}
                                {/if}
                            </div>
                            {#if log.metadata}
                                <div class="mt-1 text-xs text-gray-400">
                                    {#if log.metadata.email}
                                        {log.metadata.email}
                                    {/if}
                                    {#if log.metadata.name && log.metadata.surname}
                                        {log.metadata.name} {log.metadata.surname}
                                    {/if}
                                    {#if log.metadata.groupName}
                                        — {log.metadata.groupName}
                                    {/if}
                                    {#if log.metadata.reason}
                                        — "{log.metadata.reason}"
                                    {/if}
                                    {#if log.metadata.fields}
                                        — fields: {log.metadata.fields.join(', ')}
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <!-- Timestamp -->
                        <div class="text-xs text-gray-400 shrink-0 text-right">
              <span title={new Date(log.createdAt).toLocaleString()}>
                {timeAgo(log.createdAt)}
              </span>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="px-4 pb-4">
                <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchLogs(p)} />
            </div>
        {/if}
    </div>
</div>