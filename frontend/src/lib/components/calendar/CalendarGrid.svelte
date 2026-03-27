<script lang="ts">
    import { t, currentLanguage } from '$lib/i18n';

    let {
        year,
        month,
        leaves,
        onDayClick,
    }: {
        year: number;
        month: number;
        leaves: any[];
        onDayClick: (date: string, dayLeaves: any[]) => void;
    } = $props();

    let lang = $derived($currentLanguage);

    let weekDays = $derived(
        lang === 'FR'
            ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    );

    interface CalendarDay {
        date: Date;
        dateStr: string;
        day: number;
        isCurrentMonth: boolean;
        isToday: boolean;
        isWeekend: boolean;
        leaves: any[];
    }

    let calendarDays = $derived.by(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Monday = 0 in our grid (ISO week)
        let startDayOfWeek = firstDay.getDay() - 1;
        if (startDayOfWeek < 0) startDayOfWeek = 6;

        const days: CalendarDay[] = [];
        const today = new Date();
        const todayStr = formatDateStr(today);

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthLastDay - i);
            days.push(buildDay(d, false, todayStr));
        }

        // Current month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            days.push(buildDay(d, true, todayStr));
        }

        // Next month padding (fill to 42 cells = 6 rows)
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(year, month + 1, i);
            days.push(buildDay(d, false, todayStr));
        }

        return days;
    });

    function buildDay(date: Date, isCurrentMonth: boolean, todayStr: string): CalendarDay {
        const dateStr = formatDateStr(date);
        const dayOfWeek = date.getDay();
        return {
            date,
            dateStr,
            day: date.getDate(),
            isCurrentMonth,
            isToday: dateStr === todayStr,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            leaves: getLeavesForDate(dateStr),
        };
    }

    function formatDateStr(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getLeavesForDate(dateStr: string): any[] {
        return leaves.filter((leave: any) => {
            const start = leave.startDate.split('T')[0];
            const end = leave.endDate.split('T')[0];
            return dateStr >= start && dateStr <= end;
        });
    }

    function handleDayClick(day: CalendarDay) {
        if (day.leaves.length > 0) {
            onDayClick(day.dateStr, day.leaves);
        }
    }
</script>

<!-- Week day headers -->
<div class="border-b border-gray-200" style="display: grid; grid-template-columns: repeat(7, 1fr);">
    {#each weekDays as day, i}
        <div class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider {i >= 5 ? 'text-gray-400' : 'text-gray-500'}">
            {day}
        </div>
    {/each}
</div>

<!-- Calendar grid -->
<div style="display: grid; grid-template-columns: repeat(7, 1fr);">
    {#each calendarDays as day, i}
        {@const hasLeaves = day.leaves.length > 0}
        <button
                onclick={() => handleDayClick(day)}
                disabled={!hasLeaves}
                class="relative min-h-[90px] border-b border-r border-gray-100 p-1.5 text-left transition-colors
        {day.isCurrentMonth ? '' : 'bg-gray-50/50'}
        {day.isWeekend && day.isCurrentMonth ? 'bg-gray-50/80' : ''}
        {hasLeaves ? 'cursor-pointer hover:bg-blue-50/50' : 'cursor-default'}
        {day.isToday ? 'bg-blue-50/30' : ''}
        {i % 7 === 0 ? 'border-l border-gray-100' : ''}"
        >
            <!-- Day number -->
            <span class="inline-flex items-center justify-center w-7 h-7 text-sm rounded-full
        {day.isToday ? 'bg-blue-600 text-white font-bold' : ''}
        {!day.isToday && day.isCurrentMonth ? 'text-gray-900' : ''}
        {!day.isToday && !day.isCurrentMonth ? 'text-gray-300' : ''}
        {day.isWeekend && !day.isToday && day.isCurrentMonth ? 'text-gray-400' : ''}"
            >
        {day.day}
      </span>

            <!-- Leave events -->
            {#if day.isCurrentMonth && day.leaves.length > 0}
                <div class="mt-0.5 space-y-0.5">
                    {#each day.leaves.slice(0, 3) as leave}
                        <div
                                class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight truncate"
                                style="background-color: {leave.leaveType?.color}15; color: {leave.leaveType?.color}; border-left: 2px solid {leave.leaveType?.color};"
                        >
              <span class="truncate">
                {leave.user?.name} {leave.user?.surname?.[0]}.
                  {#if leave.timeSlot !== 'FULL_DAY'}
                  <span class="opacity-70">
                    ({leave.timeSlot === 'MORNING' ? 'AM' : 'PM'})
                  </span>
                {/if}
              </span>
                        </div>
                    {/each}
                    {#if day.leaves.length > 3}
                        <div class="px-1.5 text-[10px] text-gray-400 font-medium">
                            +{day.leaves.length - 3} more
                        </div>
                    {/if}
                </div>
            {/if}
        </button>
    {/each}
</div>