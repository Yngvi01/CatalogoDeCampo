import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";
import { professionalAuth, requireIdentity } from "../workspace/context";
import { cloud } from "./config";
export { dataDir, cloud } from "./config";

type Executor = (
  statement: string,
  values?: unknown[],
) => Promise<Record<string, unknown>[]>;
const context = new AsyncLocalStorage<Executor>();
let connection: ReturnType<typeof postgres> | undefined;
function pg() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL não configurada.");
  return (connection ??= postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15,
    ssl: process.env.CAMPO_TEST_POSTGRES === "1" ? false : "require",
  }));
}
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn);
  queue = result.catch(() => {});
  return result;
}
const localExecute: Executor = async (statement, values = []) => {
  const { sqlite } = await import("./local");
  const bindings: unknown[] = [];
  const sql = statement.replace(/\$(\d+)/g, (_, index) => {
    bindings.push(values[Number(index) - 1]);
    return "?";
  });
  const query = sqlite.prepare(sql);
  return query.reader
    ? (query.all(...bindings) as Record<string, unknown>[])
    : (query.run(...bindings), []);
};
export async function query<T = Record<string, unknown>>(
  statement: string,
  values: unknown[] = [],
): Promise<T[]> {
  if (professionalAuth() && !cloud) throw new Error("Contas profissionais exigem CAMPO_STORAGE=supabase.");
  const active = context.getStore();
  if (active) return (await active(statement, values)) as T[];
  if (!cloud)
    return exclusive(
      async () => (await localExecute(statement, values)) as T[],
    );
  if (professionalAuth()) {
    return await scopedPostgres(async () => query<T>(statement, values));
  }
  await requireCompatibleSchema();
  return (await pg().unsafe(statement, values as never[])) as unknown as T[];
}
export async function requireCompatibleSchema() {
  const [schema] = await pg()`SELECT to_regclass('public.organizations') IS NOT NULL AS professional`;
  if (schema.professional) throw new Error("Este banco exige CAMPO_AUTH=supabase. A senha compartilhada não pode acessar organizações.");
}
async function scopedPostgres<T>(fn: () => Promise<T>): Promise<T> {
  const identity = professionalAuth() ? requireIdentity() : undefined;
  if (!identity) await requireCompatibleSchema();
  return (await pg().begin(async (sql) => {
    if (identity) {
      await sql.unsafe("SET LOCAL ROLE authenticated");
      await sql`select set_config('request.jwt.claim.sub', ${identity.userId}, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claims', ${JSON.stringify({ sub: identity.userId, role: "authenticated" })}, true), set_config('campo.organization_id', ${identity.organizationId || ""}, true)`;
    }
    const execute: Executor = async (statement, values = []) =>
      (await sql.unsafe(statement, values as never[])) as unknown as Record<string, unknown>[];
    return context.run(execute, fn);
  })) as T;
}
/** All mutations use the same transaction lock; numbering and read-modify-write stay atomic. */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (professionalAuth() && !cloud) throw new Error("Contas profissionais exigem CAMPO_STORAGE=supabase.");
  if (context.getStore()) return fn();
  if (cloud) {
    return await scopedPostgres(async () => {
      // The lock is per organization; separate organizations can work concurrently.
      const identity = professionalAuth() ? requireIdentity() : undefined;
      await query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [identity?.organizationId || "campo-local"]);
      return fn();
    });
  }
  return exclusive(async () => {
    const { sqlite } = await import("./local");
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await context.run(localExecute, fn);
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  });
}
export async function closeDatabase() {
  if (connection) await connection.end();
  else if (!cloud) (await import("./local")).sqlite.close();
}
