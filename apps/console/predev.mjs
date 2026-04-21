/**
 * 啟動前：從 10000 起找未使用端口，寫入 .env.local
 * 供 API server（process.env.API_PORT）與 Vite proxy（loadEnv）共用
 */

import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findFreePort(start = 10000) {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(start, "127.0.0.1", () => {
			const { port } = server.address();
			server.close(() => resolve(port));
		});
		server.on("error", () => {
			if (start >= 10100) reject(new Error("10000-10099 端口全部占用"));
			else
				findFreePort(start + 1)
					.then(resolve)
					.catch(reject);
		});
	});
}

const port = await findFreePort();
writeFileSync(path.join(__dirname, ".env.local"), `API_PORT=${port}\n`, "utf8");
console.log(`[predev] API server port → ${port}`);
