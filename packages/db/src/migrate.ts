import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getPool } from "./client";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Applies the idempotent database schema required by the LessonBuild demo. */
export async function runMigrations(): Promise<void> {
  const sql = readFileSync(join(__dirname, "../migrations/001_init.sql"), "utf8");
  await getPool().query(sql);
}

// Allow `pnpm --filter @lessonbuild/db migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().then(() => getPool().end());
}
