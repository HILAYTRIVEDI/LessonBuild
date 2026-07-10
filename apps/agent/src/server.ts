import { runMigrations } from "@lessonbuild/db";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

try {
  await runMigrations();
  const databaseUrl = process.env["DATABASE_URL"];
  if (databaseUrl) {
    await PostgresSaver.fromConnString(databaseUrl).setup();
  }
} catch (e: unknown) {
  console.error("startup preparation failed", e);
  process.exit(1);
}
