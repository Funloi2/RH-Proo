<script lang="ts">
    import { t, currentLanguage } from '$lib/i18n';

    let {
        leaves,
        getLeaveLabel,
        getTimeSlotLabel,
    }: {
        leaves: any[];
        getLeaveLabel: (lt: any) => string;
        getTimeSlotLabel: (slot: string) => string;
    } = $props();

    let lang = $derived($currentLanguage);

    // Group leaves by date
    let groupedLeaves = $derived.by(() => {
        const groups: Map<string, any[]> = new Map();

        for (const leave of leaves) {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const current = new Date(start);

            while (current <= end) {
                const key = formatDateKey(current);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(leave);
                current.setDate(current.getDate() + 1);
            }
        }

        // Sort by date
        return [...groups.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateStr, dayLeaves]) => ({
                dateStr,
                label: formatDateLabel(new Date(dateStr)),
                dayOfWeek: formatDayOfWeek(new Date(dateStr)),
                leaves: dayLeaves,
            }));
    });

    function formatDateKey(d: Date): string {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatDateLabel(d: Date): string {
        return d.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', {
            day: 'numeric',
            month: 'long',
        });
    }

    function formatDayOfWeek(d: Date): string {
        return d.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', {
            weekday: 'long',
        });
    }

    function isToday(dateStr: string): boolean {
        const today = new Date();
        return formatDateKey(today) === dateStr;
    }

    function isWeekend(dateStr: string): boolean {
        const d = new Date(dateStr);
        return d.getDay() === 0 || d.getDay() === 6;
    }
</script>

{#if groupedLeaves.length === 0}
    <div class="p-8 text-center text-gray-500">{$t('common.noData')}</div>
{:else}
    <div class="divide-y divide-gray-100">
        {#each groupedLeaves as group}
            <div class="flex gap-4 p-4 {isWeekend(group.dateStr) ? 'bg-gray-50/50' : ''}">
                <!-- Date column -->
                <div class="w-16 shrink-0 text-center">
                    <div class="inline-flex flex-col items-center {isToday(group.dateStr) ? 'bg-blue-600 text-white rounded-lg px-2 py-1' : ''}">
            <span class="text-2xl font-bold leading-none">
              {new Date(group.dateStr).getDate()}
            </span>
                        <span class="text-[10px] uppercase font-medium mt-0.5 {isToday(group.dateStr) ? 'text-blue-100' : 'text-gray-400'}">
              {group.dayOfWeek.slice(0, 3)}
            </span>
                    </div>
                </div>

                <!-- Events -->
                <div class="flex-1 space-y-1.5">
                    {#each group.leaves as leave}
                        <div
                                class="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style="background-color: {leave.leaveType?.color}10; border-left: 3px solid {leave.leaveType?.color};"
                        >
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-900">
                                    {leave.user?.name} {leave.user?.surname}
                                </p>
                                <p class="text-xs" style="color: {leave.leaveType?.color};">
                                    {getLeaveLabel(leave.leaveType)}
                                    {#if leave.timeSlot !== 'FULL_DAY'}
                                        · {getTimeSlotLabel(leave.timeSlot)}
                                    {/if}
                                </p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/if}