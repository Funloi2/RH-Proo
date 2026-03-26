<script lang="ts">
    import { page } from '$app/stores';
    import { authStore } from '$lib/stores/auth';
    import { t } from '$lib/i18n';

    export let open = false;

    $: user = $authStore.user;
    $: isAdmin = user?.globalRole === 'ADMIN';
    $: currentPath = $page.url.pathname;

    interface NavItem {
        href: string;
        label: string;
        icon: string;
        adminOnly?: boolean;
    }

    const navItems: NavItem[] = [
        { href: '/dashboard', label: 'nav.dashboard', icon: '📊' },
        { href: '/calendar', label: 'nav.calendar', icon: '📅' },
        { href: '/leaves', label: 'nav.leaves', icon: '🏖️' },
        { href: '/tasks', label: 'nav.tasks', icon: '✅' },
        { href: '/groups', label: 'nav.groups', icon: '👥' },
        { href: '/users', label: 'nav.users', icon: '👤', adminOnly: true },
        { href: '/leave-types', label: 'nav.leaveTypes', icon: '🏷️', adminOnly: true },
        { href: '/activity-log', label: 'nav.activityLog', icon: '📋', adminOnly: true },
    ];

    $: visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

    function isActive(href: string): boolean {
        if (href === '/dashboard') return currentPath === '/dashboard';
        return currentPath.startsWith(href);
    }

    function handleNavClick() {
        open = false;
    }
</script>

<!-- Mobile overlay -->
{#if open}
    <button
            class="fixed inset-0 bg-black/40 z-40 lg:hidden"
            on:click={() => (open = false)}
            aria-label="Close menu"
    />
{/if}

<aside
        class="fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-50 flex flex-col
    transition-transform duration-200 ease-in-out
    w-64 lg:translate-x-0
    {open ? 'translate-x-0' : '-translate-x-full'}"
>
    <!-- Logo -->
    <div class="h-16 flex items-center px-6 border-b border-gray-200">
        <span class="text-xl font-bold text-blue-600">HR</span>
        <span class="text-xl font-bold text-gray-800">-Proo</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-4 overflow-y-auto">
        <ul class="space-y-1 px-3">
            {#each visibleItems as item}
                <li>
                    <a
                            href={item.href}
                            on:click={handleNavClick}
                            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              {isActive(item.href)
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}"
                    >
                        <span class="text-lg">{item.icon}</span>
                        <span>{$t(item.label)}</span>
                    </a>
                </li>
            {/each}
        </ul>
    </nav>

    <!-- User info at bottom -->
    {#if user}
        <div class="p-4 border-t border-gray-200">
            <div class="flex items-center gap-3">
                <div
                        class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold"
                >
                    {user.name[0]}{user.surname[0]}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">
                        {user.name} {user.surname}
                    </p>
                    <p class="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
            </div>
        </div>
    {/if}
</aside>