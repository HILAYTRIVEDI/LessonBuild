import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const sql = readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf8");
  await pool.query(sql);
}

// Allow `pnpm --filter @lessonbuild/db migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().then(() => pool.end());
}
