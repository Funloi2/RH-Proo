<script lang="ts">
    import { goto } from '$app/navigation';
    import { authStore } from '$lib/stores/auth';
    import { t, currentLanguage, setLanguage } from '$lib/i18n';
    import { api } from '$lib/api/client';

    let email = $state('');
    let password = $state('');
    let error = $state('');
    let loading = $state(false);

    async function handleLogin(e: Event) {
        e.preventDefault();
        error = '';
        loading = true;

        try {
            const data = await api<{
                user: { id: string; email: string; name: string; surname: string; globalRole: 'USER' | 'ADMIN'; language: 'EN' | 'FR' };
                tokens: { accessToken: string; refreshToken: string };
            }>('/auth/login', {
                method: 'POST',
                body: { email, password },
                noAuth: true,
            });

            authStore.login(data.user, data.tokens.accessToken, data.tokens.refreshToken);
            setLanguage(data.user.language);
            goto('/calendar');
        } catch (err: any) {
            error = err.message || 'Login failed';
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4">
    <div class="w-full max-w-md">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">
                <span class="text-blue-600">HR</span><span class="text-gray-800">-Proo</span>
            </h1>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-6">{$t('auth.login')}</h2>

            {#if error}
                <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {error}
                </div>
            {/if}

            <form onsubmit={handleLogin} class="space-y-4">
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                        {$t('auth.email')}
                    </label>
                    <input
                            id="email"
                            type="email"
                            bind:value={email}
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                        {$t('auth.password')}
                    </label>
                    <input
                            id="password"
                            type="password"
                            bind:value={password}
                            required
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                <button
                        type="submit"
                        disabled={loading}
                        class="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? $t('common.loading') : $t('auth.loginButton')}
                </button>
            </form>

            <div class="mt-4 text-center">
                <a href="/reset-password" class="text-sm text-blue-600 hover:text-blue-700">
                    {$t('auth.forgotPassword')}
                </a>
            </div>
        </div>

        <div class="mt-4 text-center">
            <button
                    onclick={() => setLanguage($currentLanguage === 'FR' ? 'EN' : 'FR')}
                    class="text-sm text-gray-500 hover:text-gray-700"
            >
                {$currentLanguage === 'FR' ? 'English' : 'Français'}
            </button>
        </div>
    </div>
</div>