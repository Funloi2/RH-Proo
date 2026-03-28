<script lang="ts">
    import { goto } from '$app/navigation';
    import { authStore } from '$lib/stores/auth';
    import { t, currentLanguage, setLanguage } from '$lib/i18n';
    import { apiGet, apiPatch } from '$lib/api/client';
    import { onMount } from 'svelte';

    let { onToggleSidebar }: { onToggleSidebar: () => void } = $props();

    let user = $derived($authStore.user);

    let showUserMenu = $state(false);
    let showNotifDropdown = $state(false);
    let unreadCount = $state(0);
    let notifications: any[] = $state([]);
    let pollInterval: ReturnType<typeof setInterval>;

    onMount(() => {
        if ($authStore.isAuthenticated) {
            fetchUnreadCount();
            pollInterval = setInterval(fetchUnreadCount, 30000);
        }

        function handleClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest('.notif-area')) {
                showNotifDropdown = false;
            }
            if (!target.closest('.user-area')) {
                showUserMenu = false;
            }
        }

        document.addEventListener('click', handleClick);

        return () => {
            if (pollInterval) clearInterval(pollInterval);
            document.removeEventListener('click', handleClick);
        };
    });

    async function fetchUnreadCount() {
        try {
            const data = await apiGet<{ count: number }>('/notifications/unread-count');
            unreadCount = data.count;
        } catch {}
    }

    async function fetchNotifications() {
        try {
            const data = await apiGet<{ data: any[] }>('/notifications?limit=10&unreadOnly=true');
            notifications = data.data;
        } catch {}
    }

    function getNotifMessage(notif: any): string {
        // typeKey is snake_case like "added_to_group"
        // Translation key is "notifications.added_to_group"
        const key = `notifications.${notif.typeKey}`;
        const translated = $t(key, notif.params || {});
        if (translated === key) {
            // Fallback: make it readable
            return notif.typeKey.replace(/_/g, ' ');
        }
        return translated;
    }

    async function toggleNotifDropdown(e: MouseEvent) {
        e.stopPropagation();
        showUserMenu = false;
        showNotifDropdown = !showNotifDropdown;
        if (showNotifDropdown) {
            await fetchNotifications();
        }
    }

    async function markAllRead() {
        try {
            await apiPatch('/notifications/read-all');
            unreadCount = 0;
            notifications = notifications.map((n) => ({ ...n, isRead: true }));
        } catch {}
    }

    function toggleUserMenu(e: MouseEvent) {
        e.stopPropagation();
        showNotifDropdown = false;
        showUserMenu = !showUserMenu;
    }

    function handleLogout() {
        authStore.logout();
        goto('/login');
    }

    function toggleLanguage() {
        setLanguage($currentLanguage === 'FR' ? 'EN' : 'FR');
    }
</script>

<header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6">
    <button
            onclick={onToggleSidebar}
            class="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Toggle menu"
    >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    </button>

    <div class="flex-1"></div>

    <div class="flex items-center gap-2">
        <button
                onclick={toggleLanguage}
                class="px-2 py-1 text-xs font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
            {$currentLanguage === 'FR' ? 'EN' : 'FR'}
        </button>

        <div class="relative notif-area">
            <button
                    onclick={toggleNotifDropdown}
                    class="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                    aria-label="Notifications"
            >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {#if unreadCount > 0}
          <span class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
                {/if}
            </button>

            {#if showNotifDropdown}
                <div class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 class="text-sm font-semibold text-gray-900">{$t('notifications.title')}</h3>
                        {#if unreadCount > 0}
                            <button
                                    onclick={markAllRead}
                                    class="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                                {$t('notifications.markAllRead')}
                            </button>
                        {/if}
                    </div>
                    <div class="max-h-80 overflow-y-auto">
                        {#if notifications.length === 0}
                            <p class="px-4 py-6 text-sm text-gray-500 text-center">
                                {$t('notifications.noNotifications')}
                            </p>
                        {:else}
                            {#each notifications as notif}
                                <div class="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 {notif.isRead ? 'opacity-60' : ''}">
                                    <p class="text-sm text-gray-800">
                                        {getNotifMessage(notif)}
                                    </p>
                                    <p class="text-xs text-gray-400 mt-1">
                                        {new Date(notif.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            {/each}
                        {/if}
                    </div>
                    <a
                            href="/notifications"
                            onclick={() => (showNotifDropdown = false)}
                            class="block px-4 py-3 text-center text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100 font-medium"
                    >
                        {$t('notifications.title')} →
                    </a>
                </div>
            {/if}
        </div>

        <div class="relative user-area">
            <button
                    onclick={toggleUserMenu}
                    class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100"
            >
                <div
                        class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold"
                >
                    {user?.name?.[0] || ''}{user?.surname?.[0] || ''}
                </div>
            </button>

            {#if showUserMenu}
                <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
                    <a
                            href="/profile"
                            onclick={() => (showUserMenu = false)}
                            class="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {$t('nav.profile')}
                    </a>
                    <button
                            onclick={handleLogout}
                            class="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {$t('nav.logout')}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</header>