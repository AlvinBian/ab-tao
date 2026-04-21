/** collectUnifiedReportData() 的完整回傳型別 */
export interface UnifiedReportData {
	overview: OverviewSummary;
	commands: ResourceItem[];
	agents: ResourceItem[];
	rules: RuleItem[];
	hooks: HookEventItem[];
	zsh: ZshStatus;
	ai: AiStatus;
	permissions: PermissionsStatus;
	claudeMd: ClaudeMdItem[];
	plugins: PluginFileItem[];
	installedPlugins: InstalledPlugin[] | null;
	backups: string[];
	diskUsage: DiskUsage;
	envHealth: EnvHealth;
	sessions: SessionsStatus;
	aiRes: AiResStatus;
	skills: SkillItem[];
	cachedRepos: CachedRepo[];
	cachedTechStacks: Record<string, string[]>;
	cachedTimestamp: string | null;
	extended: ExtendedSummary;
}

export interface OverviewSummary {
	healthPct: number;
	totalInstalled: number;
	totalUsed: number;
	commandUsageRate: number;
	agentUsageRate: number;
}

export interface ResourceItem {
	name: string;
	source: "core" | "ext" | "user" | string;
	count: number;
	lastUsed: string | null;
}

export interface RuleItem {
	name: string;
	source: "core" | "ext" | "user" | string;
	enabled: boolean;
}

export interface HookEventItem {
	event: string;
	subHooks: number;
}

export interface ZshStatus {
	installed: string[];
	available: string[];
}

export interface AiStatus {
	model: string;
	effort: string;
	repoModel: string;
}

export interface PermissionsStatus {
	allow: string[];
	deny: string[];
	templateAllow: string[];
}

export interface ClaudeMdItem {
	path: string;
	mtime: string;
}

export interface PluginFileItem {
	name: string;
	mtime: string;
}

export interface InstalledPlugin {
	name: string;
	version: string;
	repo: string;
}

export interface DiskUsage {
	cache: number;
	dist: number;
	claudeProjects: number;
}

export interface EnvHealth {
	missing: string[];
	extra: string[];
	empty: string[];
}

export interface SessionsStatus {
	total: number;
	byProject: Record<string, number>;
	dailyCounts: Record<string, number>;
}

export interface AiResStatus {
	commands: string[];
	agents: string[];
	rules: string[];
}

export interface SkillItem {
	name: string;
	source: "ab-tao" | "ecc" | "custom" | string;
	enabled: boolean;
	path: string;
}

export interface CachedRepo {
	role?: string;
	localPath?: string;
	name?: string;
	[key: string]: unknown;
}

/** collectExtendedData() 內嵌於 unified 的型別 */
export interface ExtendedSummary {
	hooks: HooksDetail;
	state: StateData;
	drift: DriftItem[];
	memory: MemoryLayers;
	ccline: CclineStatus;
	mcp: McpConfig;
}

export interface HooksDetail {
	hooks: HookDetailItem[];
	total: number;
	healthy: number;
}

export interface HookDetailItem {
	id: string | null;
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
	sha256?: string;
	source?: string;
	installedAt?: string;
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
	/** drift 年齡（天數），從 state.json 的 installedAt 計算 */
	age: number;
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
