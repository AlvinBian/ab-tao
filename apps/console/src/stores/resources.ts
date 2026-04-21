import { defineStore } from "pinia";
import { ref } from "vue";
import type { ResourceEntry, ResourceKind } from "@/types/resources";

const TTL_MS = 30_000;

function makeKindStore(kind: ResourceKind) {
	return defineStore(`resources-${kind}`, () => {
		const items = ref<ResourceEntry[]>([]);
		const loading = ref(false);
		const error = ref<string | null>(null);
		const lastFetchedAt = ref(0);
		const toggling = ref<Set<string>>(new Set());

		async function fetchItems(force = false) {
			if (
				!force &&
				items.value.length &&
				Date.now() - lastFetchedAt.value < TTL_MS
			)
				return;
			loading.value = true;
			error.value = null;
			try {
				const res = await fetch(`/api/resources/${kind}`);
				const json = await res.json();
				if (json.code === 0) {
					items.value = json.data;
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

		async function toggleEnabled(
			name: string,
			enabled: boolean,
		): Promise<void> {
			toggling.value = new Set(toggling.value).add(name);
			try {
				const res = await fetch(
					`/api/resources/${kind}/${encodeURIComponent(name)}/enabled`,
					{
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ enabled }),
					},
				);
				const json = await res.json();
				if (json.code === 0) {
					items.value = json.data;
					lastFetchedAt.value = Date.now();
				} else {
					throw new Error(json.message);
				}
			} finally {
				const next = new Set(toggling.value);
				next.delete(name);
				toggling.value = next;
			}
		}

		return { items, loading, error, toggling, fetchItems, toggleEnabled };
	});
}

export const useSkillsStore = makeKindStore("skills");
export const useCommandsStore = makeKindStore("commands");
export const useAgentsStore = makeKindStore("agents");
export const useRulesStore = makeKindStore("rules");
