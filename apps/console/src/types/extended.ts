/** collectExtendedData() 的回傳型別 */
export interface ExtendedData {
	hooks: HooksDetail;
	state: StateData;
	drift: DriftItem[];
	memory: MemoryLayers;
	ccline: CclineStatus;
	mcp: McpConfig;
}

export interface HooksDetail {
	hooks: HookItem[];
	total: number;
	healthy: number;
}

export interface HookItem {
	name: string;
	event: string;
	script: string;
	exists: boolean;
	executable: boolean;
}

export interface StateData {
	version: string;
	managed: Record<string, ManagedEntry>;
	choices: Record<string, ChoiceEntry>;
	preserve: string[];
	forbidden: string[];
	sync: SyncConfig;
}

export interface ManagedEntry {
	sha256: string;
	source: string;
	installedAt: string;
}

export interface ChoiceEntry {
	decision: string;
	lockedAt: string;
}

export interface SyncConfig {
	tool: string;
	included: string[];
	excluded: string[];
}

export interface DriftItem {
	path: string;
	localHash: string | null;
	templateHash: string;
	decision: string;
}

export interface MemoryLayers {
	global: MemoryLayer;
	projects: ProjectMemoryLayer[];
}

export interface MemoryLayer {
	memory: string[];
	plans: string[];
	tasks: string[];
}

export interface ProjectMemoryLayer extends MemoryLayer {
	encoded: string;
}

export interface CclineStatus {
	installed: boolean;
	statusLineConfigured: boolean;
	command: string | null;
	themes: string[];
}

export interface McpConfig {
	servers: McpServer[];
	enabledPlugins: string[];
}

export interface McpServer {
	name: string;
	type: string;
	command: string;
}
