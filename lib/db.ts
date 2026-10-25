import 'server-only';
import { Pool, types, type PoolClient, type FieldDef } from 'pg';
import Cursor from 'pg-cursor';
import type { Column, QueryError, QueryResult, SchemaTable } from './types';

// Every query from the browser goes through runQuery(). Layers of protection:
//  1. The connection uses sql_student, a login that can only SELECT from chapter_crema.
//  2. Each query runs inside a READ ONLY transaction that is always rolled back.
//  3. A per-query statement timeout stops runaway queries.
//  4. The extended query protocol (pg-cursor) rejects multiple statements, so
//     "SELECT 1; COMMIT; ..." can't escape the read-only transaction.
//  5. Rows are fetched through a cursor with a hard cap, so a huge CROSS JOIN
//     can't exhaust the server's memory.
//  6. Credentials only exist in server environment variables.

const STATEMENT_TIMEOUT_MS = 8000;
const MAX_SQL_LENGTH = 20000;

// Return dates and timestamps as the strings Postgres sends, not JS Date objects.
for (const oid of [1082, 1114, 1184]) types.setTypeParser(oid, (v) => v);

const TYPE_NAMES: Record<number, string> = {
  16: 'boolean', 20: 'bigint', 21: 'smallint', 23: 'integer', 25: 'text', 700: 'real', 701: 'double',
  1043: 'varchar', 1082: 'date', 1114: 'timestamp', 1184: 'timestamptz', 1186: 'interval', 1700: 'numeric',
};
const NUMERIC_OIDS = new Set([20, 21, 23, 700, 701, 1700]);

export class ConfigError extends Error {}

// A query problem worth showing to the person who wrote it.
export class SqlError extends Error {
  detail?: string;
  hint?: string;
  line?: number;
  column?: number;
  constructor(e: QueryError) {
    super(e.message);
    Object.assign(this, { detail: e.detail, hint: e.hint, line: e.line, column: e.column });
  }
  toJSON(): QueryError {
    return { message: this.message, detail: this.detail, hint: this.hint, line: this.line, column: this.column };
  }
}

export type { QueryResult };

function poolConfig() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new ConfigError('DATABASE_URL is not set on the server.');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ConfigError('DATABASE_URL is not a valid connection string.');
  }
  const ca = process.env.DATABASE_CA_CERT?.trim().replace(/\\n/g, '\n');
  const ssl =
    process.env.DATABASE_SSL === 'disable'
      ? false
      : ca
        ? { ca, rejectUnauthorized: true }
        : { rejectUnauthorized: false };
  if (ssl && !ca) {
    console.warn('DATABASE_CA_CERT is not set: the connection is encrypted but the server certificate is not verified.');
  }
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'postgres'),
    ssl,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'chapter-crema-sql-lab',
  };
}

const g = globalThis as unknown as { __labPool?: Pool };
function pool(): Pool {
  if (!g.__labPool) {
    g.__labPool = new Pool(poolConfig());
    g.__labPool.on('error', (err) => console.error('Idle database connection error:', err.message));
  }
  return g.__labPool;
}

function lineCol(sql: string, position: number) {
  const before = sql.slice(0, Math.max(0, position - 1));
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

type PgError = Error & { code?: string; position?: string; detail?: string; hint?: string };

export function toQueryError(err: unknown, sql: string): QueryError {
  if (err instanceof ConfigError) return { message: err.message };
  const e = err as PgError;
  const msg = e?.message ?? String(err);
  const pos = e?.position ? lineCol(sql, Number(e.position)) : {};

  if (/cannot insert multiple commands/i.test(msg)) {
    return { message: 'Run one query at a time. Delete everything after the first query\'s semicolon, or comment it out with --.' };
  }
  if (e?.code === '57014') {
    return {
      message: `Your query ran longer than ${STATEMENT_TIMEOUT_MS / 1000} seconds and was stopped.`,
      hint: 'Check for a missing join condition or a CROSS JOIN on a big table like orders. Those multiply rows fast.',
    };
  }
  if (e?.code === '25006' || e?.code === '42501') {
    return { message: 'This lab is read-only. Use SELECT queries to answer the questions.' };
  }
  if (e?.code === 'ECONNREFUSED' || e?.code === 'ENOTFOUND' || /timeout expired|Connection terminated/i.test(msg)) {
    return {
      message: 'Couldn\'t reach the database.',
      hint: 'Free Supabase projects pause after a week without activity. Check the Supabase dashboard and restore the project.',
    };
  }
  if (/password authentication failed|Tenant or user not found/i.test(msg)) {
    return { message: 'The server\'s database login was rejected. Check DATABASE_URL in the Vercel settings.' };
  }
  return { message: msg, detail: e?.detail, hint: e?.hint, ...pos };
}

function columnsFrom(fields: FieldDef[]): Column[] {
  return fields.map((f) => ({
    name: f.name,
    type: TYPE_NAMES[f.dataTypeID] ?? 'other',
    numeric: NUMERIC_OIDS.has(f.dataTypeID),
  }));
}

async function inReadOnlyTxn<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  let broken = false;
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    await client.query('SET LOCAL search_path = chapter_crema');
    return await fn(client);
  } finally {
    try {
      await client.query('ROLLBACK');
    } catch {
      broken = true;
    }
    client.release(broken);
  }
}

// Runs one statement read-only and returns at most maxRows rows. Throws SqlError for
// anything the user should see (syntax errors, timeouts, blocked writes) and ConfigError
// for server setup problems.
export async function runReadOnly(sql: string, maxRows: number): Promise<QueryResult> {
  if (sql.length > MAX_SQL_LENGTH) throw new SqlError({ message: `Queries are limited to ${MAX_SQL_LENGTH.toLocaleString()} characters.` });
  if (!sql.trim()) throw new SqlError({ message: 'Write a query first.' });
  try {
    return await fetchRows(sql, maxRows);
  } catch (err) {
    if (err instanceof ConfigError || err instanceof SqlError) throw err;
    throw new SqlError(toQueryError(err, sql));
  }
}

async function fetchRows(sql: string, maxRows: number): Promise<QueryResult> {
  return inReadOnlyTxn(async (client) => {
    const started = performance.now();
    const cursor = client.query(new Cursor(sql, [], { rowMode: 'array' }));
    // On error the cursor syncs the connection itself, so it is only closed after a successful read.
    const { rows, fields } = await new Promise<{ rows: unknown[][]; fields: FieldDef[] }>((resolve, reject) => {
      cursor.read(maxRows + 1, (err, rows, result) => {
        if (err) reject(err);
        else resolve({ rows: rows as unknown[][], fields: result?.fields ?? [] });
      });
    });
    await cursor.close();
    const truncated = rows.length > maxRows;
    const kept = truncated ? rows.slice(0, maxRows) : rows;
    return {
      columns: columnsFrom(fields),
      rows: kept,
      rowCount: kept.length,
      truncated,
      ms: Math.round(performance.now() - started),
    };
  });
}

export async function loadSchema(): Promise<SchemaTable[]> {
  return inReadOnlyTxn(async (client) => {
    const cols = await client.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT c.relname AS table_name, a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'chapter_crema' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY c.relname, a.attnum`,
    );
    const keys = await client.query<{ tbl: string; col: string; kind: string; ref_tbl: string | null; ref_col: string | null }>(
      `SELECT c.relname AS tbl, a.attname AS col, k.contype AS kind, rc.relname AS ref_tbl, ra.attname AS ref_col
       FROM (SELECT con.conrelid, con.confrelid, con.contype, u.attnum, u.fattnum
             FROM pg_constraint con
             JOIN pg_namespace n ON n.oid = con.connamespace
             CROSS JOIN LATERAL unnest(con.conkey, COALESCE(con.confkey, con.conkey)) AS u(attnum, fattnum)
             WHERE n.nspname = 'chapter_crema' AND con.contype IN ('p', 'f')) k
       JOIN pg_class c ON c.oid = k.conrelid
       JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.attnum
       LEFT JOIN pg_class rc ON rc.oid = k.confrelid
       LEFT JOIN pg_attribute ra ON ra.attrelid = k.confrelid AND ra.attnum = k.fattnum`,
    );
    const counts = await client.query<{ relname: string; n: string }>(
      `SELECT 'stores' AS relname, COUNT(*) AS n FROM stores UNION ALL SELECT 'employees', COUNT(*) FROM employees
       UNION ALL SELECT 'customers', COUNT(*) FROM customers UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
       UNION ALL SELECT 'inventory_items', COUNT(*) FROM inventory_items
       UNION ALL SELECT 'ingredient_cost_history', COUNT(*) FROM ingredient_cost_history
       UNION ALL SELECT 'menu_items', COUNT(*) FROM menu_items UNION ALL SELECT 'menu_price_history', COUNT(*) FROM menu_price_history
       UNION ALL SELECT 'recipe_ingredients', COUNT(*) FROM recipe_ingredients UNION ALL SELECT 'recipe_steps', COUNT(*) FROM recipe_steps
       UNION ALL SELECT 'inventory_purchases', COUNT(*) FROM inventory_purchases UNION ALL SELECT 'genres', COUNT(*) FROM genres
       UNION ALL SELECT 'authors', COUNT(*) FROM authors UNION ALL SELECT 'books', COUNT(*) FROM books
       UNION ALL SELECT 'promotions', COUNT(*) FROM promotions UNION ALL SELECT 'orders', COUNT(*) FROM orders
       UNION ALL SELECT 'order_coffee_items', COUNT(*) FROM order_coffee_items
       UNION ALL SELECT 'order_book_items', COUNT(*) FROM order_book_items`,
    );
    const rowCounts = new Map(counts.rows.map((r) => [r.relname, Number(r.n)]));
    const pk = new Set(keys.rows.filter((k) => k.kind === 'p').map((k) => `${k.tbl}.${k.col}`));
    const fk = new Map(keys.rows.filter((k) => k.kind === 'f').map((k) => [`${k.tbl}.${k.col}`, `${k.ref_tbl}.${k.ref_col}`]));
    const tables = new Map<string, SchemaTable>();
    for (const r of cols.rows) {
      if (!tables.has(r.table_name)) tables.set(r.table_name, { name: r.table_name, rows: rowCounts.get(r.table_name) ?? 0, columns: [] });
      const key = `${r.table_name}.${r.column_name}`;
      tables.get(r.table_name)!.columns.push({ name: r.column_name, type: r.data_type, pk: pk.has(key), ref: fk.get(key) });
    }
    return [...tables.values()];
  });
}
