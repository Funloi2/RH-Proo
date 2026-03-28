<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage } from '$lib/i18n';
    import { authStore } from '$lib/stores/auth';
    import { apiGet } from '$lib/api/client';
    import CalendarGrid from '$lib/components/calendar/CalendarGrid.svelte';
    import CalendarAgenda from '$lib/components/calendar/CalendarAgenda.svelte';
    import DayDetailPanel from '$lib/components/calendar/DayDetailPanel.svelte';

    let user = $derived($authStore.user);
    let isAdmin = $derived(user?.globalRole === 'ADMIN');
    let lang = $derived($currentLanguage);

    // Current month
    let currentYear = $state(new Date().getFullYear());
    let currentMonth = $state(new Date().getMonth()); // 0-indexed

    // Data
    let leaves: any[] = $state([]);
    let groups: any[] = $state([]);
    let loading = $state(true);
    let error = $state('');

    // Filters
    let filterGroupId = $state('');

    // Day detail
    let selectedDate = $state('');
    let selectedDayLeaves: any[] = $state([]);
    let showDayDetail = $state(false);

    // Legend (unique leave types from current data)
    let leaveTypeLegend = $derived.by(() => {
        const seen = new Map<string, any>();
        for (const leave of leaves) {
            if (leave.leaveType && !seen.has(leave.leaveType.name)) {
                seen.set(leave.leaveType.name, leave.leaveType);
            }
        }
        return [...seen.values()];
    });

    let monthLabel = $derived(
        new Date(currentYear, currentMonth).toLocaleDateString(
            lang === 'FR' ? 'fr-FR' : 'en-US',
            { month: 'long', year: 'numeric' }
        )
    );

    onMount(async () => {
        await fetchGroups();
        await fetchCalendarData();
    });

    async function fetchGroups() {
        try {
            const data = await apiGet<{ data: any[] }>('/groups?limit=100');
            groups = data.data;
        } catch {}
    }

    async function fetchCalendarData() {
        loading = true;
        error = '';
        try {
            const startDate = new Date(currentYear, currentMonth, 1);
            const endDate = new Date(currentYear, currentMonth + 1, 0);

            const params = new URLSearchParams({
                startDate: formatDateParam(startDate),
                endDate: formatDateParam(endDate),
            });

            if (filterGroupId) params.set('groupId', filterGroupId);

            leaves = await apiGet<any[]>(`/leaves/calendar?${params}`);
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    function formatDateParam(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function prevMonth() {
        if (currentMonth === 0) {
            currentMonth = 11;
            currentYear--;
        } else {
            currentMonth--;
        }
        showDayDetail = false;
        fetchCalendarData();
    }

    function nextMonth() {
        if (currentMonth === 11) {
            currentMonth = 0;
            currentYear++;
        } else {
            currentMonth++;
        }
        showDayDetail = false;
        fetchCalendarData();
    }

    function goToToday() {
        currentYear = new Date().getFullYear();
        currentMonth = new Date().getMonth();
        showDayDetail = false;
        fetchCalendarData();
    }

    function handleGroupFilter() {
        showDayDetail = false;
        fetchCalendarData();
    }

    function handleDayClick(date: string, dayLeaves: any[]) {
        selectedDate = date;
        selectedDayLeaves = dayLeaves;
        showDayDetail = true;
    }

    function getLeaveLabel(lt: any): string {
        if (!lt) return '—';
        return lang === 'FR' ? lt.labelFr : lt.labelEn;
    }

    function getTimeSlotLabel(slot: string): string {
        switch (slot) {
            case 'MORNING': return lang === 'FR' ? 'Matin' : 'Morning';
            case 'AFTERNOON': return lang === 'FR' ? 'Après-midi' : 'Afternoon';
            case 'FULL_DAY': return lang === 'FR' ? 'Journée' : 'Full Day';
            default: return slot;
        }
    }
</script>

<div class="space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 class="text-2xl font-bold text-gray-900">{$t('nav.calendar')}</h1>

        <!-- Group filter -->
        <select
                bind:value={filterGroupId}
                onchange={handleGroupFilter}
                class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
            <option value="">{$t('groups.title')}: {lang === 'FR' ? 'Tous' : 'All'}</option>
            {#each groups as group}
                <option value={group.id}>{group.name}</option>
            {/each}
        </select>
    </div>

    <!-- Month navigation -->
    <div class="bg-white rounded-xl border border-gray-200">
        <div class="px-4 sm:px-6 py-4 flex items-center justify-between border-b border-gray-200">
            <div class="flex items-center gap-2">
                <button
                        onclick={prevMonth}
                        class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        aria-label="Previous month"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button
                        onclick={nextMonth}
                        class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        aria-label="Next month"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                <h2 class="text-lg font-semibold text-gray-900 capitalize ml-2">{monthLabel}</h2>
            </div>
            <button
                    onclick={goToToday}
                    class="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
                {lang === 'FR' ? "Aujourd'hui" : 'Today'}
            </button>
        </div>

        {#if error}
            <div class="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        {/if}

        {#if loading}
            <div class="p-12 text-center text-gray-500">{$t('common.loading')}</div>
        {:else}
            <!-- Desktop: Grid -->
            <div class="hidden md:block">
                <CalendarGrid
                        year={currentYear}
                        month={currentMonth}
                        {leaves}
                        onDayClick={handleDayClick}
                />
            </div>

            <!-- Mobile: Agenda -->
            <div class="md:hidden">
                <CalendarAgenda
                        {leaves}
                        {getLeaveLabel}
                        {getTimeSlotLabel}
                />
            </div>
        {/if}

        <!-- Legend -->
        {#if leaveTypeLegend.length > 0}
            <div class="px-4 sm:px-6 py-3 border-t border-gray-200 flex flex-wrap items-center gap-4">
        <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {lang === 'FR' ? 'Légende' : 'Legend'}
        </span>
                {#each leaveTypeLegend as lt}
                    <div class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {lt.color};"></span>
                        <span class="text-xs text-gray-600">{getLeaveLabel(lt)}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Day detail panel (appears below calendar when a day is clicked) -->
    {#if showDayDetail}
        <DayDetailPanel
                date={selectedDate}
                leaves={selectedDayLeaves}
                onClose={() => (showDayDetail = false)}
                {getLeaveLabel}
                {getTimeSlotLabel}
        />
    {/if}
</div>