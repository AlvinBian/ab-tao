import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFileContent } from "./security-validator.mjs";
import { detectTechStack } from "./tech-detection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_PATH = path.resolve(__dirname, "../resources/ai/sources");

export class ResourceLoader {
	constructor(config) {
		this.config = config;
		this.resourcesPath = RESOURCES_PATH;
	}

	async loadResources() {
		const neededSources = await this.determineNeededSources();
		const resources = {};

		for (const source of neededSources) {
			const sourcePath = path.join(this.resourcesPath, source);
			if (fs.existsSync(sourcePath)) {
				resources[source] = this.loadSourceFromPath(sourcePath, source);
			}
		}

		return resources;
	}

	async determineNeededSources() {
		const techDetectionContext = {
			githubRepos: this.config.githubRepos || [],
			localPaths: this.config.localPaths || ["."],
		};

		const techStackResult = await detectTechStack(techDetectionContext);
		const detectedTechStack = techStackResult.technologies.map((t) => t.name);

		const sources = ["ecc"];

		if (
			detectedTechStack.some((tech) =>
				["typescript", "javascript", "react", "vue"].includes(
					tech.toLowerCase(),
				),
			)
		) {
			sources.push("superpowers", "anthropic");
		}

		if (
			detectedTechStack.some((tech) =>
				["testing", "jest", "vitest"].includes(tech.toLowerCase()),
			)
		) {
			sources.push("letta");
		}

		return sources;
	}

	loadSourceFromPath(sourcePath, sourceType) {
		switch (sourceType) {
			case "ecc":
				return {
					commands: this.loadDirectory(path.join(sourcePath, "commands")),
					agents: this.loadDirectory(path.join(sourcePath, "agents")),
					rules: this.loadDirectory(path.join(sourcePath, "rules")),
				};
			default:
				return this.loadAgentSkills(sourcePath);
		}
	}

	loadDirectory(dirPath) {
		if (!fs.existsSync(dirPath)) return [];

		return fs
			.readdirSync(dirPath)
			.filter((file) => file.endsWith(".md"))
			.map((file) => {
				const filePath = path.join(dirPath, file);
				const content = fs.readFileSync(filePath, "utf8");
				const relativePath = path.relative(this.resourcesPath, filePath);

				const validation = validateFileContent(relativePath, content);
				if (!validation.valid) {
					console.warn(
						`Skipping ${relativePath}: ${validation.errors.map((e) => e.message).join(", ")}`,
					);
					return null;
				}

				return {
					name: file.replace(".md", ""),
					content,
					checksum: validation.checksum,
				};
			})
			.filter(Boolean);
	}

	loadAgentSkills(basePath) {
		const skills = [];
		const items = fs.readdirSync(basePath);

		for (const item of items) {
			const itemPath = path.join(basePath, item);
			if (!fs.statSync(itemPath).isDirectory()) continue;

			const skillFile = path.join(itemPath, "SKILL.md");
			if (!fs.existsSync(skillFile)) continue;

			const content = fs.readFileSync(skillFile, "utf8");
			const relativePath = path.relative(this.resourcesPath, skillFile);

			const validation = validateFileContent(relativePath, content);
			if (!validation.valid) {
				console.warn(
					`Skipping skill ${item}: ${validation.errors.map((e) => e.message).join(", ")}`,
				);
				continue;
			}

			skills.push({
				name: item,
				content,
				checksum: validation.checksum,
			});
		}

		return skills;
	}
}

export { validateContent, validateFileContent } from "./security-validator.mjs";
export { syncIfNeeded } from "./sync-manager.mjs";
