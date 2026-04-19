/** collectUnifiedReportData() 的回傳型別 */
export interface OverviewData {
	commands: ResourceList;
	agents: ResourceList;
	rules: ResourceList;
	skills: SkillList;
	hooks: HooksStatus;
	zsh: ZshStatus;
	ai: AiStatus;
	permissions: PermissionsStatus;
	plugins: PluginsStatus;
	sessions: SessionsStatus;
	diskUsage: DiskUsage;
	envHealth: EnvHealth;
	healthPct: number;
}

export interface ResourceList {
	core: string[];
	ext: string[];
	user: string[];
	disabled: string[];
}

export interface SkillList {
	installed: SkillItem[];
	available: string[];
}

export interface SkillItem {
	name: string;
	source: "ab-tao" | "ecc" | "custom" | string;
	enabled: boolean;
	path: string;
}

export interface HooksStatus {
	installed: boolean;
	events: Record<string, number>;
}

export interface ZshStatus {
	installed: string[];
	available: string[];
}

export interface AiStatus {
	model: string;
	effort: string;
	repoModel: string;
	activeProfile: string;
}

export interface PermissionsStatus {
	allow: string[];
	deny: string[];
}

export interface PluginsStatus {
	official: string[];
	local: string[];
	failed: string[];
	enabled: string[];
}

export interface SessionsStatus {
	total: number;
	byProject: Record<string, number>;
	dailyCounts: Record<string, number>;
}

export interface DiskUsage {
	cache: string;
	dist: string;
	projects: string;
}

export interface EnvHealth {
	missing: string[];
	extra: string[];
	empty: string[];
}

/** scanUsageStats() 的回傳型別 */
export interface UsageStats {
	items: UsageStatItem[];
}

export interface UsageStatItem {
	name: string;
	type: "command" | "agent" | "skill";
	callCount: number;
	firstUsed: string;
	lastUsed: string;
	stale: boolean;
}
