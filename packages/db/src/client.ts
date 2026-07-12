import pg from "pg";

let pool: pg.Pool | null = null;

/**
 * Lazily creates the shared Postgres pool from DATABASE_URL on first use.
 * Must stay lazy: Next.js build-time page-data collection imports route
 * modules that pull in this package, and DATABASE_URL is only available at
 * container runtime, not during the Docker build stage.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env["DATABASE_URL"];
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}

/** Thin typed wrapper around `pool.query` used by repository functions. */
export function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}
