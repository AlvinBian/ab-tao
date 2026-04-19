import pc from "picocolors";

export const t = {
	step: (n, label) => `${pc.dim(`[${n}]`)} ${pc.bold(pc.cyan(label))}`,
	ok: (msg, detail) =>
		`${pc.bold(pc.green("✅"))} ${msg}${detail ? pc.dim(` · ${detail}`) : ""}`,
	warn: (msg) => `${pc.bold(pc.yellow("⚠️"))} ${msg}`,
	info: (msg) => `${pc.dim("ℹ️")}  ${msg}`,
	count: (n) => pc.bold(pc.white(String(n))),
	path: (p) => pc.bold(pc.blue(p)),
	val: (v) => pc.bold(String(v)),
};
