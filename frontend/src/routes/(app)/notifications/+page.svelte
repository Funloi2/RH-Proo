<script lang="ts">
    import { onMount } from 'svelte';
    import { t, currentLanguage } from '$lib/i18n';
    import { apiGet, apiPatch, apiDelete } from '$lib/api/client';
    import Pagination from '$lib/components/ui/Pagination.svelte';

    let lang = $derived($currentLanguage);

    let notifications: any[] = $state([]);
    let meta = $state({ total: 0, page: 1, limit: 20, totalPages: 0 });
    let loading = $state(true);
    let error = $state('');

    // Filter
    let showUnreadOnly = $state(false);

    onMount(() => {
        fetchNotifications();
    });

    async function fetchNotifications(page = 1) {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (showUnreadOnly) params.set('unreadOnly', 'true');
            const data = await apiGet<{ data: any[]; meta: any }>(`/notifications?${params}`);
            notifications = data.data;
            meta = data.meta;
        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    }

    async function markAsRead(id: string) {
        try {
            await apiPatch(`/notifications/${id}/read`);
            notifications = notifications.map((n) =>
                n.id === id ? { ...n, isRead: true } : n
            );
        } catch (err: any) {
            error = err.message;
        }
    }

    async function markAllAsRead() {
        try {
            await apiPatch('/notifications/read-all');
            notifications = notifications.map((n) => ({ ...n, isRead: true }));
        } catch (err: any) {
            error = err.message;
        }
    }

    async function deleteNotification(id: string) {
        try {
            await apiDelete(`/notifications/${id}`);
            notifications = notifications.filter((n) => n.id !== id);
            meta = { ...meta, total: meta.total - 1 };
        } catch (err: any) {
            error = err.message;
        }
    }

    async function clearAllRead() {
        try {
            await apiDelete('/notifications/clear-read');
            if (showUnreadOnly) {
                await fetchNotifications(1);
            } else {
                notifications = notifications.filter((n) => !n.isRead);
                meta = { ...meta, total: notifications.length };
            }
        } catch (err: any) {
            error = err.message;
        }
    }

    function toggleFilter() {
        showUnreadOnly = !showUnreadOnly;
        fetchNotifications(1);
    }

    function getNotificationMessage(notif: any): string {
        const key = `notifications.${notif.typeKey}`;
        const translated = $t(key, notif.params || {});
        // If translation key not found, return a readable fallback
        if (translated === key) {
            return notif.typeKey.replace(/_/g, ' ');
        }
        return translated;
    }

    function getNotificationIcon(typeKey: string): { icon: string; bgColor: string; textColor: string } {
        if (typeKey.includes('approved') || typeKey.includes('accepted')) {
            return { icon: '✓', bgColor: 'bg-green-100', textColor: 'text-green-600' };
        }
        if (typeKey.includes('refused')) {
            return { icon: '✕', bgColor: 'bg-red-100', textColor: 'text-red-600' };
        }
        if (typeKey.includes('assigned')) {
            return { icon: '→', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
        }
        if (typeKey.includes('added') || typeKey.includes('created')) {
            return { icon: '+', bgColor: 'bg-green-100', textColor: 'text-green-600' };
        }
        if (typeKey.includes('removed')) {
            return { icon: '−', bgColor: 'bg-red-100', textColor: 'text-red-600' };
        }
        if (typeKey.includes('closed')) {
            return { icon: '●', bgColor: 'bg-purple-100', textColor: 'text-purple-600' };
        }
        if (typeKey.includes('balance') || typeKey.includes('adjusted')) {
            return { icon: '◆', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };
        }
        if (typeKey.includes('role')) {
            return { icon: '⇆', bgColor: 'bg-blue-100', textColor: 'text-blue-600' };
        }
        if (typeKey.includes('submitted') || typeKey.includes('requested')) {
            return { icon: '◎', bgColor: 'bg-amber-100', textColor: 'text-amber-600' };
        }
        return { icon: '•', bgColor: 'bg-gray-100', textColor: 'text-gray-500' };
    }

    function getRelativeTime(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return lang === 'FR' ? "à l'instant" : 'just now';
        if (diffMin < 60) return lang === 'FR' ? `il y a ${diffMin}m` : `${diffMin}m ago`;
        if (diffHours < 24) return lang === 'FR' ? `il y a ${diffHours}h` : `${diffHours}h ago`;
        if (diffDays < 7) return lang === 'FR' ? `il y a ${diffDays}j` : `${diffDays}d ago`;
        return date.toLocaleDateString(lang === 'FR' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
    }

    let unreadCount = $derived(notifications.filter((n) => !n.isRead).length);
    let hasReadNotifications = $derived(notifications.some((n) => n.isRead));
</script>

<div class="max-w-3xl mx-auto space-y-4">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900">{$t('notifications.title')}</h1>
            {#if meta.total > 0}
                <p class="text-sm text-gray-500 mt-1">
                    {unreadCount} {lang === 'FR' ? 'non lue(s)' : 'unread'} · {meta.total} {lang === 'FR' ? 'au total' : 'total'}
                </p>
            {/if}
        </div>
        <div class="flex items-center gap-2">
            {#if unreadCount > 0}
                <button
                        onclick={markAllAsRead}
                        class="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 whitespace-nowrap"
                >
                    {$t('notifications.markAllRead')}
                </button>
            {/if}
            {#if hasReadNotifications}
                <button
                        onclick={clearAllRead}
                        class="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"
                >
                    {$t('notifications.clearRead')}
                </button>
            {/if}
        </div>
    </div>

    <!-- Filter toggle -->
    <div class="flex items-center gap-3">
        <button
                onclick={toggleFilter}
                class="px-3 py-1.5 text-sm rounded-lg transition-colors {showUnreadOnly
        ? 'bg-blue-100 text-blue-700 font-medium'
        : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}"
        >
            {lang === 'FR' ? 'Non lues uniquement' : 'Unread only'}
        </button>
    </div>

    {#if error}
        <div class="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
    {/if}

    <!-- Notifications list -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {#if loading}
            <div class="p-8 text-center text-gray-500">{$t('common.loading')}</div>
        {:else if notifications.length === 0}
            <div class="p-12 text-center">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <p class="text-gray-500">{$t('notifications.noNotifications')}</p>
            </div>
        {:else}
            <div class="divide-y divide-gray-100">
                {#each notifications as notif}
                    {@const iconInfo = getNotificationIcon(notif.typeKey)}
                    <div
                            class="px-4 sm:px-5 py-4 flex items-start gap-3 transition-colors
              {notif.isRead ? 'bg-white' : 'bg-blue-50/30'}"
                    >
                        <!-- Icon -->
                        <div class="shrink-0 mt-0.5">
                            <div class="w-9 h-9 rounded-full {iconInfo.bgColor} {iconInfo.textColor} flex items-center justify-center text-sm font-bold">
                                {iconInfo.icon}
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm {notif.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}">
                                        {getNotificationMessage(notif)}
                                    </p>
                                    {#if notif.params?.groupName}
                                        <p class="text-xs text-gray-400 mt-0.5">{notif.params.groupName}</p>
                                    {/if}
                                    {#if notif.params?.taskTitle}
                                        <p class="text-xs text-gray-400 mt-0.5">"{notif.params.taskTitle}"</p>
                                    {/if}
                                    {#if notif.params?.startDate}
                                        <p class="text-xs text-gray-400 mt-0.5">
                                            {new Date(notif.params.startDate).toLocaleDateString()}
                                            {#if notif.params.endDate && notif.params.endDate !== notif.params.startDate}
                                                — {new Date(notif.params.endDate).toLocaleDateString()}
                                            {/if}
                                        </p>
                                    {/if}
                                    {#if notif.params?.reason}
                                        <p class="text-xs text-gray-400 mt-0.5">"{notif.params.reason}"</p>
                                    {/if}
                                </div>

                                <!-- Timestamp -->
                                <span class="text-xs text-gray-400 shrink-0 whitespace-nowrap" title={new Date(notif.createdAt).toLocaleString()}>
                  {getRelativeTime(notif.createdAt)}
                </span>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-2 mt-2">
                                {#if !notif.isRead}
                                    <button
                                            onclick={() => markAsRead(notif.id)}
                                            class="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        {lang === 'FR' ? 'Marquer comme lu' : 'Mark as read'}
                                    </button>
                                {/if}
                                <button
                                        onclick={() => deleteNotification(notif.id)}
                                        class="text-xs text-gray-400 hover:text-red-600"
                                >
                                    {$t('common.delete')}
                                </button>
                            </div>
                        </div>

                        <!-- Unread indicator dot -->
                        {#if !notif.isRead}
                            <div class="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></div>
                        {/if}
                    </div>
                {/each}
            </div>

            <div class="px-4 pb-4">
                <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={(p) => fetchNotifications(p)} />
            </div>
        {/if}
    </div>
</div>