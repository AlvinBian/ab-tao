/**
 * extended.ts — 保留向後相容，所有型別已合併至 status.ts
 * 請從 @/types/status 引入
 */
export type {
	CclineStatus,
	ChoiceEntry,
	DriftItem,
	ExtendedSummary as ExtendedData,
	HookDetailItem as HookItem,
	HooksDetail,
	ManagedEntry,
	McpConfig,
	McpServer,
	MemoryLayer,
	MemoryLayers,
	ProjectMemoryLayer,
	StateData,
	SyncConfig,
} from "./status";
