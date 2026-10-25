// Compares a student's result to the reference result.
//
// Lenient on purpose:
//   - column names and column order don't matter (she can alias however she likes)
//   - extra columns are fine, as long as every expected column is present
//   - row order doesn't matter, unless the question asks for a sort (then it's a note, not a failure)
//   - numbers only need to match to the reference's precision (e.g. 50.94 matches 50.9)
//   - text compares case-insensitively; midnight timestamps match plain dates; '' matches NULL
// Strict on what matters: the same number of rows, and the same values lined up row by row.

type Norm = null | { k: "n"; v: number } | { k: "s"; v: string };
type ExpCell = { n: Norm; tol: number };

export type Grade = {
  correct: boolean;
  messages: string[];
  orderNote?: string;
};

const NUM_RE = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
const MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})[ T]00:00:00(\.0+)?([+-]\d{2}(:?\d{2})?|Z)?$/;

function norm(v: unknown): Norm {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? { k: "n", v } : { k: "s", v: String(v) };
  if (typeof v === "boolean") return { k: "s", v: String(v) };
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    if (NUM_RE.test(t)) return { k: "n", v: Number(t) };
    const m = MIDNIGHT_RE.exec(t);
    if (m) return { k: "s", v: m[1] };
    return { k: "s", v: t.toLowerCase() };
  }
  return { k: "s", v: JSON.stringify(v).toLowerCase() };
}

function decimals(v: unknown): number {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!NUM_RE.test(s) || /e/i.test(s)) return 0;
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function expCell(v: unknown): ExpCell {
  const n = norm(v);
  const d = Math.min(decimals(v), 2);
  return { n, tol: d === 0 ? 1e-9 : 0.5 * 10 ** -d + 1e-9 };
}

function rank(n: Norm) {
  return n === null ? 0 : n.k === "n" ? 1 : 2;
}

function cmp(a: Norm, b: Norm): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (a === null || b === null) return 0;
  if (a.k === "n" && b.k === "n") return a.v - b.v;
  return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
}

function same(e: ExpCell, h: Norm): boolean {
  if (e.n === null || h === null) return e.n === h;
  if (e.n.k === "n" && h.k === "n") return Math.abs(e.n.v - h.v) <= e.tol;
  return e.n.k === h.k && e.n.v === h.v;
}

function columnMatches(exp: ExpCell[], her: Norm[]): boolean {
  const a = [...exp].sort((x, y) => cmp(x.n, y.n));
  const b = [...her].sort(cmp);
  return a.every((e, i) => same(e, b[i]));
}

function rowsMatch(exp: ExpCell[][], her: Norm[][]): boolean {
  const lex = <T,>(get: (c: T) => Norm) => (x: T[], y: T[]) => {
    for (let i = 0; i < x.length; i++) {
      const c = cmp(get(x[i]), get(y[i]));
      if (c !== 0) return c;
    }
    return 0;
  };
  const a = [...exp].sort(lex<ExpCell>((c) => c.n));
  const b = [...her].sort(lex<Norm>((c) => c));
  return a.every((row, i) => row.every((e, j) => same(e, b[i][j])));
}

function sortedAsAsked(rows: Norm[][], order: [number, "asc" | "desc"][]): boolean {
  for (let r = 1; r < rows.length; r++) {
    for (const [col, dir] of order) {
      const c = cmp(rows[r - 1][col], rows[r][col]);
      if (c === 0) continue;
      if ((dir === "asc" && c > 0) || (dir === "desc" && c < 0)) return false;
      break;
    }
  }
  return true;
}

export function grade(
  expected: { columns: { name: string }[]; rows: unknown[][] },
  her: { columns: { name: string }[]; rows: unknown[][]; truncated?: boolean },
  order?: [number, "asc" | "desc"][],
): Grade {
  const n = expected.rows.length;
  const k = expected.columns.length;
  const m = her.rows.length;

  if (her.columns.length === 0) {
    return { correct: false, messages: ["Your query didn't return any columns. Make sure it's a SELECT."] };
  }
  if (her.truncated || m !== n) {
    const got = her.truncated ? `more than ${m.toLocaleString()}` : m.toLocaleString();
    const hint =
      m > n || her.truncated
        ? "Too many rows usually means a filter is missing, or a join is matching rows more than once."
        : "Too few rows usually means a filter is too strict, or an INNER JOIN is dropping rows that have no match.";
    return {
      correct: false,
      messages: [`Your query returned ${got} row${m === 1 && !her.truncated ? "" : "s"}, but the answer has ${n}.`, hint],
    };
  }

  const expCols: ExpCell[][] = Array.from({ length: k }, (_, c) => expected.rows.map((r) => expCell(r[c])));
  const herCols: Norm[][] = Array.from({ length: her.columns.length }, (_, c) => her.rows.map((r) => norm(r[c])));

  // Which of her columns could be each expected column?
  const candidates = expCols.map((ec) => herCols.map((hc, i) => (columnMatches(ec, hc) ? i : -1)).filter((i) => i >= 0));
  const missing = candidates.map((c, i) => (c.length ? null : expected.columns[i].name)).filter((x): x is string => !!x);
  if (missing.length) {
    const names = missing.map((x) => `\`${x}\``).join(", ");
    return {
      correct: false,
      messages: [
        `The row count is right, but no column in your result matches the expected ${names} ${missing.length === 1 ? "column" : "columns"}.`,
        "Check what you're selecting, how it's calculated, and whether your filters match the question.",
      ],
    };
  }

  // Try assignments of her columns to expected columns until the rows line up.
  const byFewest = expCols.map((_, i) => i).sort((a, b) => candidates[a].length - candidates[b].length);
  const assign = new Array<number>(k);
  const used = new Set<number>();
  let tries = 0;
  let found: number[] | null = null;
  const expRows: ExpCell[][] = expected.rows.map((r) => r.map(expCell));

  const search = (depth: number): boolean => {
    if (tries > 20_000) return false;
    if (depth === k) {
      tries++;
      const projected = her.rows.map((_, r) => assign.map((c) => herCols[c][r]));
      if (rowsMatch(expRows, projected)) {
        found = [...assign];
        return true;
      }
      return false;
    }
    const col = byFewest[depth];
    for (const cand of candidates[col]) {
      if (used.has(cand)) continue;
      used.add(cand);
      assign[col] = cand;
      if (search(depth + 1)) return true;
      used.delete(cand);
    }
    return false;
  };

  if (!search(0) || !found) {
    return {
      correct: false,
      messages: [
        "Every expected column appears in your result, but the values are paired up differently across rows.",
        "Check your GROUP BY and your join conditions.",
      ],
    };
  }

  const messages: string[] = [];
  if (her.columns.length > k) {
    messages.push(`Your result has ${her.columns.length - k} extra column${her.columns.length - k === 1 ? "" : "s"}. That's fine.`);
  }
  let orderNote: string | undefined;
  if (order?.length) {
    const map: number[] = found;
    const projected = her.rows.map((_, r) => map.map((c) => herCols[c][r]));
    if (!sortedAsAsked(projected, order)) {
      orderNote =
        "The data is right, but it isn't sorted the way the question asked. This still counts. In a real report, the sort is part of the answer, so add an ORDER BY.";
    }
  }
  return { correct: true, messages, orderNote };
}
