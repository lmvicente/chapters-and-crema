// Shared between the server and the browser.

export type Column = { name: string; type: string; numeric: boolean };

export type QueryResult = {
  columns: Column[];
  rows: unknown[][];
  rowCount: number; // rows returned to the browser
  truncated: boolean; // the query produced more rows than we fetched
  ms: number;
};

export type QueryError = {
  message: string;
  detail?: string;
  hint?: string;
  line?: number;
  column?: number;
};

export type RunResponse = { ok: true; result: QueryResult } | { ok: false; error: QueryError };

export type Verdict = {
  correct: boolean;
  messages: string[];
  orderNote?: string;
  expectedRowCount?: number;
  insight?: string;
  solution?: string;
};

export type SubmitResponse =
  | { ok: true; result: QueryResult; verdict: Verdict }
  | { ok: false; error: QueryError };

export type SchemaColumn = { name: string; type: string; pk: boolean; ref?: string };
export type SchemaTable = { name: string; rows: number; columns: SchemaColumn[] };
