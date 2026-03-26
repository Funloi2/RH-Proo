import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import en from './en.json';
import fr from './fr.json';

type Language = 'EN' | 'FR';

const translations: Record<Language, Record<string, unknown>> = { EN: en, FR: fr };

function getInitialLanguage(): Language {
    if (!browser) return 'FR';

    try {
        const stored = localStorage.getItem('hr-proo-lang');
        if (stored === 'EN' || stored === 'FR') return stored;
    } catch {
        // ignore
    }

    return 'FR';
}

export const currentLanguage = writable<Language>(getInitialLanguage());

// Persist language choice
if (browser) {
    currentLanguage.subscribe((lang) => {
        localStorage.setItem('hr-proo-lang', lang);
    });
}

/**
 * Get a nested translation value by dot-separated key.
 * Example: t('nav.dashboard') → "Tableau de bord"
 */
export const t = derived(currentLanguage, ($lang) => {
    return (key: string, params?: Record<string, string | number>): string => {
        const keys = key.split('.');
        let value: unknown = translations[$lang];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = (value as Record<string, unknown>)[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        if (typeof value !== 'string') return key;

        // Replace {{param}} placeholders
        if (params) {
            return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) =>
                String(params[paramKey] ?? `{{${paramKey}}}`),
            );
        }

        return value;
    };
});

export function setLanguage(lang: Language) {
    currentLanguage.set(lang);
}