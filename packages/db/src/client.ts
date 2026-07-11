import pg from "pg";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

/** Shared Postgres pool configured from DATABASE_URL for all package callers. */
export const pool = new pg.Pool({ connectionString });

/** Thin typed wrapper around `pool.query` used by repository functions. */
export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
