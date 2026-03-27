import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface User {
    id: string;
    email: string;
    name: string;
    surname: string;
    globalRole: 'USER' | 'ADMIN';
    language: 'EN' | 'FR';
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
}

function getInitialState(): AuthState {
    if (!browser) {
        return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
    }

    try {
        const stored = localStorage.getItem('hr-proo-auth');
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...parsed, isAuthenticated: !!parsed.accessToken };
        }
    } catch {
        // ignore
    }

    return { user: null, accessToken: null, refreshToken: null, isAuthenticated: false };
}

function createAuthStore() {
    const { subscribe, set, update } = writable<AuthState>(getInitialState());

    function persist(state: AuthState) {
        if (browser) {
            localStorage.setItem('hr-proo-auth', JSON.stringify({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }));
        }
    }

    return {
        subscribe,

        login(user: User, accessToken: string, refreshToken: string) {
            const state: AuthState = {
                user,
                accessToken,
                refreshToken,
                isAuthenticated: true,
            };
            set(state);
            persist(state);
        },

        setTokens(accessToken: string, refreshToken: string) {
            update((state) => {
                const newState = { ...state, accessToken, refreshToken };
                persist(newState);
                return newState;
            });
        },

        updateUser(user: Partial<User>) {
            update((state) => {
                const newState = {
                    ...state,
                    user: state.user ? { ...state.user, ...user } : null,
                };
                persist(newState);
                return newState;
            });
        },

        logout() {
            const state: AuthState = {
                user: null,
                accessToken: null,
                refreshToken: null,
                isAuthenticated: false,
            };
            set(state);
            if (browser) {
                localStorage.removeItem('hr-proo-auth');
            }
        },
    };
}

export const authStore = createAuthStore();