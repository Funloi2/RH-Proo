<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { authStore } from '$lib/stores/auth';
    import { t, setLanguage } from '$lib/i18n';
    import { api } from '$lib/api/client';

    // If there's a token in the URL, show the reset form. Otherwise, show the "enter email" form.
    let token = $derived($page.url.searchParams.get('token') || '');

    let email = $state('');
    let password = $state('');
    let confirmPassword = $state('');
    let error = $state('');
    let success = $state('');
    let loading = $state(false);

    async function handleForgot(e: Event) {
        e.preventDefault();
        error = '';
        success = '';
        loading = true;

        try {
            const data = await api<{ message: string }>('/auth/forgot-password', {
                method: 'POST',
                body: { email },
                noAuth: true,
            });
            success = data.message;
        } catch (err: any) {
            error = err.message || 'An error occurred';
        } finally {
            loading = false;
        }
    }

    async function handleReset(e: Event) {
        e.preventDefault();
        error = '';

        if (password !== confirmPassword) {
            error = 'Passwords do not match';
            return;
        }

        if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            error = $t('auth.passwordRequirements');
            return;
        }

        loading = true;

        try {
            const data = await api<{
                user: { id: string; email: string; name: string; surname: string; globalRole: 'USER' | 'ADMIN'; language: 'EN' | 'FR' };
                tokens: { accessToken: string; refreshToken: string };
            }>('/auth/reset-password', {
                method: 'POST',
                body: { token, password },
                noAuth: true,
            });

            authStore.login(data.user, data.tokens.accessToken, data.tokens.refreshToken);
            setLanguage(data.user.language);
            goto('/dashboard');
        } catch (err: any) {
            error = err.message || 'An error occurred';
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
            {#if token}
                <!-- Reset form (user clicked link in email) -->
                <h2 class="text-xl font-semibold text-gray-900 mb-6">{$t('auth.resetPassword')}</h2>

                {#if error}
                    <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                {/if}

                <form on:submit={handleReset} class="space-y-4">
                    <div>
                        <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                            {$t('auth.newPassword')}
                        </label>
                        <input
                                id="password"
                                type="password"
                                bind:value={password}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p class="mt-1 text-xs text-gray-500">{$t('auth.passwordRequirements')}</p>
                    </div>

                    <div>
                        <label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
                            Confirm password
                        </label>
                        <input
                                id="confirmPassword"
                                type="password"
                                bind:value={confirmPassword}
                                required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <button
                            type="submit"
                            disabled={loading}
                            class="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? $t('common.loading') : $t('auth.confirmButton')}
                    </button>
                </form>
            {:else}
                <!-- Forgot password form -->
                <h2 class="text-xl font-semibold text-gray-900 mb-6">{$t('auth.forgotPassword')}</h2>

                {#if error}
                    <div class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                {/if}

                {#if success}
                    <div class="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
                {/if}

                <form on:submit={handleForgot} class="space-y-4">
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

                    <button
                            type="submit"
                            disabled={loading}
                            class="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? $t('common.loading') : $t('auth.confirmButton')}
                    </button>
                </form>
            {/if}

            <div class="mt-4 text-center">
                <a href="/login" class="text-sm text-blue-600 hover:text-blue-700">
                    {$t('auth.backToLogin')}
                </a>
            </div>
        </div>
    </div>
</div>