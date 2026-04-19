import { defineStore } from "pinia";
import { ref } from "vue";

export interface SettingsData {
	model?: string;
	effortLevel?: string;
	statusLine?: { type: string; command: string };
	permissions?: { allow: string[]; deny: string[]; defaultMode?: string };
	enabledPlugins?: Record<string, boolean>;
	hooks?: Record<string, HookEntry[]>;
	env?: Record<string, string>;
	[key: string]: unknown;
}

export interface HookEntry {
	id: string;
	description: string;
	matcher?: string;
	hooks: { type: string; command: string; timeout?: number }[];
}

export interface PrefsData {
	prefs: Record<string, unknown>;
	defaults: Record<string, unknown>;
}

const TTL_MS = 30_000;

export const useSettingsStore = defineStore("settings", () => {
	const settings = ref<SettingsData | null>(null);
	const prefs = ref<PrefsData | null>(null);
	const loading = ref(false);
	const error = ref<string | null>(null);
	const lastFetchedAt = ref(0);
	const saving = ref(false);

	const isStale = () => Date.now() - lastFetchedAt.value > TTL_MS;

	async function fetchSettings(force = false) {
		if (!force && !isStale() && settings.value) return;
		loading.value = true;
		error.value = null;
		try {
			const res = await fetch("/api/settings");
			const json = await res.json();
			if (json.code === 0) {
				settings.value = json.data;
				lastFetchedAt.value = Date.now();
			} else {
				error.value = json.message;
			}
		} catch (e) {
			error.value = e instanceof Error ? e.message : "連線失敗";
		} finally {
			loading.value = false;
		}
	}

	async function fetchPrefs() {
		try {
			const res = await fetch("/api/preferences");
			const json = await res.json();
			if (json.code === 0) prefs.value = json.data;
		} catch {
			// 靜默失敗
		}
	}

	async function patchPermissions(allow: string[], deny: string[]) {
		saving.value = true;
		try {
			const res = await fetch("/api/settings/permissions", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ allow, deny }),
			});
			const json = await res.json();
			if (json.code === 0 && settings.value?.permissions) {
				settings.value.permissions.allow = allow;
				settings.value.permissions.deny = deny;
			} else {
				throw new Error(json.message);
			}
		} finally {
			saving.value = false;
		}
	}

	async function patchAi(model: string, effortLevel: string) {
		saving.value = true;
		try {
			const res = await fetch("/api/settings/ai", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model, effortLevel }),
			});
			const json = await res.json();
			if (json.code === 0 && settings.value) {
				settings.value.model = model;
				settings.value.effortLevel = effortLevel;
			} else {
				throw new Error(json.message);
			}
		} finally {
			saving.value = false;
		}
	}

	async function patchPluginEnabled(name: string, enabled: boolean) {
		saving.value = true;
		try {
			const res = await fetch(
				`/api/settings/plugins/${encodeURIComponent(name)}/enabled`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ enabled }),
				},
			);
			const json = await res.json();
			if (json.code === 0 && settings.value) {
				if (!settings.value.enabledPlugins) settings.value.enabledPlugins = {};
				settings.value.enabledPlugins[name] = enabled;
			} else {
				throw new Error(json.message);
			}
		} finally {
			saving.value = false;
		}
	}

	async function savePrefs(prefs: Record<string, unknown>) {
		saving.value = true;
		try {
			const res = await fetch("/api/preferences", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(prefs),
			});
			const json = await res.json();
			if (json.code !== 0) throw new Error(json.message);
		} finally {
			saving.value = false;
		}
	}

	return {
		settings,
		prefs,
		loading,
		error,
		saving,
		fetchSettings,
		fetchPrefs,
		patchPermissions,
		patchAi,
		patchPluginEnabled,
		savePrefs,
	};
});
