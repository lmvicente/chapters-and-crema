'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Part, Question } from '@/lib/questions';
import type { QueryError, QueryResult, RunResponse, SchemaTable, SubmitResponse, Verdict } from '@/lib/types';
import ResultGrid from './ResultGrid';
import Guide from './Guide';

const SqlEditor = dynamic(() => import('./SqlEditor'), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading editor…</div>,
});

// ---------------------------------------------------------------- progress (this browser only)

type QState = { solved?: boolean; revealed?: boolean; hints: number; attempts: number; draft: string };
type Progress = Record<string, QState>;
const STORE_KEY = 'cc-lab-progress-v1';
const CURRENT_KEY = 'cc-lab-current-v1';
const SCRATCH = 'scratch';
const blank = (): QState => ({ hints: 0, attempts: 0, draft: '' });

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage full: progress just won't persist */
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Signed out');
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`The server returned an error (${res.status}). Try again.`);
  return data as T;
}

type Output =
  | { kind: 'result'; result: QueryResult }
  | { kind: 'error'; error: QueryError }
  | null;

type Reveal = { solution: string; insight: string };

// Grader messages wrap column names in backticks; show those as code.
function rich(text: string) {
  return text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
}

// ---------------------------------------------------------------- component

export default function Lab({ parts, questions }: { parts: Part[]; questions: Question[] }) {
  const [progress, setProgress] = useState<Progress>({});
  const [currentId, setCurrentId] = useState<string>(questions[0].id);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'questions' | 'tables' | 'guide'>('questions');
  const [navOpen, setNavOpen] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[] | null>(null);
  const [schemaError, setSchemaError] = useState('');
  const [output, setOutput] = useState<Output>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState<'run' | 'submit' | 'reveal' | null>(null);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setProgress(load<Progress>(STORE_KEY, {}));
    const saved = load<string>(CURRENT_KEY, questions[0].id);
    if (saved === SCRATCH || questions.some((q) => q.id === saved)) setCurrentId(saved);
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
    setLoaded(true);
  }, [questions]);

  useEffect(() => {
    if (loaded) save(STORE_KEY, progress);
  }, [progress, loaded]);

  useEffect(() => {
    if (loaded) save(CURRENT_KEY, currentId);
  }, [currentId, loaded]);

  useEffect(() => {
    fetch('/api/schema')
      .then(async (r) => {
        if (r.status === 401) window.location.href = '/login';
        const d = await r.json();
        if (d.ok) setSchema(d.tables);
        else setSchemaError(d.error?.message ?? 'Couldn’t load the tables.');
      })
      .catch(() => setSchemaError('Couldn’t load the tables.'));
  }, []);

  const completion = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const t of schema ?? []) out[t.name] = t.columns.map((c) => c.name);
    return out;
  }, [schema]);

  const isScratch = currentId === SCRATCH;
  const index = questions.findIndex((q) => q.id === currentId);
  const question = index >= 0 ? questions[index] : null;
  const part = question ? parts.find((p) => p.id === question.part) : null;
  const qs: QState = progress[currentId] ?? blank();
  const solvedCount = questions.filter((q) => progress[q.id]?.solved).length;

  const update = useCallback((id: string, fn: (s: QState) => QState) => {
    setProgress((p) => ({ ...p, [id]: fn(p[id] ?? blank()) }));
  }, []);

  function open(id: string) {
    setCurrentId(id);
    setOutput(null);
    setVerdict(null);
    setReveal(null);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  }

  async function run() {
    if (busy || !qs.draft.trim()) return;
    setBusy('run');
    setVerdict(null);
    try {
      const r = await post<RunResponse>('/api/run', { sql: qs.draft });
      setOutput(r.ok ? { kind: 'result', result: r.result } : { kind: 'error', error: r.error });
    } catch (e) {
      setOutput({ kind: 'error', error: { message: (e as Error).message } });
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (busy || !question || !qs.draft.trim()) return;
    setBusy('submit');
    try {
      const r = await post<SubmitResponse>('/api/submit', { id: question.id, sql: qs.draft });
      if (!r.ok) {
        setOutput({ kind: 'error', error: r.error });
        setVerdict(null);
        return;
      }
      setOutput({ kind: 'result', result: r.result });
      setVerdict(r.verdict);
      update(question.id, (s) => ({ ...s, attempts: s.attempts + 1, solved: s.solved || r.verdict.correct }));
    } catch (e) {
      setOutput({ kind: 'error', error: { message: (e as Error).message } });
    } finally {
      setBusy(null);
    }
  }

  async function showAnswer() {
    if (!question || busy) return;
    setBusy('reveal');
    try {
      const r = await post<{ ok: boolean; solution?: string; insight?: string; error?: QueryError }>('/api/reveal', {
        id: question.id,
      });
      if (r.ok && r.solution) {
        setReveal({ solution: r.solution, insight: r.insight ?? '' });
        update(question.id, (s) => ({ ...s, revealed: true }));
      }
    } finally {
      setBusy(null);
    }
  }

  const next = index >= 0 && index < questions.length - 1 ? questions[index + 1] : null;

  return (
    <div className="app">
      <header className="topbar">
        <button className="nav-toggle" onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen} aria-controls="sidebar">
          {navOpen ? 'Close' : 'Questions'}
        </button>
        <div className="brand">
          <img src="/icon.svg" alt="" width={28} height={28} />
          <span>
            Chapter &amp; Crema <em>SQL Lab</em>
          </span>
        </div>
        <div className="progress" aria-label={`${solvedCount} of ${questions.length} questions solved`}>
          <div className="progress-bar">
            <div style={{ width: `${(solvedCount / questions.length) * 100}%` }} />
          </div>
          <span>
            {solvedCount} of {questions.length} solved
          </span>
        </div>
        <button
          className="btn btn-quiet"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
        >
          Sign out
        </button>
      </header>

      <div className="body">
        <aside id="sidebar" className={`sidebar ${navOpen ? 'open' : ''}`}>
          <div className="tabs" role="tablist">
            {(['questions', 'tables', 'guide'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'questions' ? 'Questions' : t === 'tables' ? 'Tables' : 'Cheat sheet'}
              </button>
            ))}
          </div>
          <div className="sidebar-scroll">
            {tab === 'questions' && (
              <QuestionList parts={parts} questions={questions} progress={progress} currentId={currentId} onOpen={open} />
            )}
            {tab === 'tables' && <TableBrowser tables={schema} error={schemaError} />}
            {tab === 'guide' && <Guide />}
          </div>
        </aside>

        <main className="main">
          {isScratch ? (
            <section className="question">
              <h1>Scratchpad</h1>
              <p className="prompt">Explore the data however you like. Nothing here is graded.</p>
            </section>
          ) : (
            question && (
              <section className="question">
                <div className="q-meta">
                  <span className="q-part">{part?.title}</span>
                  <span>
                    Question {index + 1} of {questions.length}
                  </span>
                  {qs.attempts > 0 && <span>{qs.attempts === 1 ? '1 attempt' : `${qs.attempts} attempts`}</span>}
                  {qs.solved && <span className="tag tag-solved">Solved</span>}
                  {!qs.solved && qs.revealed && <span className="tag">Answer shown</span>}
                </div>
                <h1>{question.title}</h1>
                <p className="prompt">{question.prompt}</p>

                <Hints
                  hints={question.hints}
                  used={qs.hints}
                  onShow={() => update(question.id, (s) => ({ ...s, hints: Math.min(3, s.hints + 1) }))}
                  onReveal={showAnswer}
                  revealBusy={busy === 'reveal'}
                  solved={!!qs.solved}
                />
                {reveal && (
                  <div className="answer-box">
                    <h2>Reference answer</h2>
                    <pre>{reveal.solution}</pre>
                    <p>
                      Try retyping it yourself and running it. Then change something and predict what will happen before you run
                      it again.
                    </p>
                  </div>
                )}
              </section>
            )
          )}

          <section className="editor-card">
            <SqlEditor
              value={qs.draft}
              onChange={(v) => update(currentId, (s) => ({ ...s, draft: v }))}
              onRun={run}
              onSubmit={isScratch ? undefined : submit}
              schema={completion}
            />
            <div className="editor-actions">
              <button className="btn btn-secondary" onClick={run} disabled={!!busy || !qs.draft.trim()}>
                {busy === 'run' ? 'Running…' : 'Run query'}
                <kbd>{mac ? '⌘↵' : 'Ctrl+Enter'}</kbd>
              </button>
              {!isScratch && (
                <button className="btn btn-primary" onClick={submit} disabled={!!busy || !qs.draft.trim()}>
                  {busy === 'submit' ? 'Checking…' : 'Submit answer'}
                  <kbd>{mac ? '⇧⌘↵' : 'Ctrl+Shift+Enter'}</kbd>
                </button>
              )}
              <span className="editor-tip">Run as often as you like. Submit when you think it’s right.</span>
            </div>
          </section>

          {verdict && question && (
            <VerdictPanel
              verdict={verdict}
              question={question}
              number={index + 1}
              state={qs}
              next={next}
              onNext={() => next && open(next.id)}
            />
          )}

          <section className="output" aria-live="polite">
            {output?.kind === 'error' && (
              <div className="error-box" role="alert">
                <p className="error-title">
                  {output.error.line ? `Error on line ${output.error.line}, column ${output.error.column}` : 'The query didn’t run'}
                </p>
                <p>{output.error.message}</p>
                {output.error.detail && <p className="error-sub">{output.error.detail}</p>}
                {output.error.hint && <p className="error-sub">{output.error.hint}</p>}
              </div>
            )}
            {output?.kind === 'result' && (
              <>
                <p className="result-status">
                  <strong>
                    {output.result.truncated
                      ? `First ${output.result.rowCount.toLocaleString()} rows`
                      : `${output.result.rowCount.toLocaleString()} ${output.result.rowCount === 1 ? 'row' : 'rows'}`}
                  </strong>{' '}
                  in {output.result.ms} ms
                  {output.result.truncated && <span> (the query returned more; only these are shown)</span>}
                </p>
                <ResultGrid result={output.result} />
              </>
            )}
            {!output && (
              <p className="empty-note">
                Results show up here. Open the Tables tab to see every column, or start with{' '}
                <code>SELECT * FROM menu_items LIMIT 10;</code>
              </p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function QuestionList({
  parts,
  questions,
  progress,
  currentId,
  onOpen,
}: {
  parts: Part[];
  questions: Question[];
  progress: Progress;
  currentId: string;
  onOpen: (id: string) => void;
}) {
  return (
    <nav aria-label="Questions">
      <button className={`q-item scratch ${currentId === SCRATCH ? 'current' : ''}`} onClick={() => onOpen(SCRATCH)}>
        <span className="mark mark-scratch" aria-hidden />
        <span className="q-title">Scratchpad</span>
      </button>
      {parts.map((p) => {
        const items = questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => q.part === p.id);
        const done = items.filter(({ q }) => progress[q.id]?.solved).length;
        return (
          <div key={p.id} className="part">
            <div className="part-head">
              <h2>{p.title}</h2>
              <span>
                {done}/{items.length}
              </span>
            </div>
            <p className="part-intro">{p.intro}</p>
            <ol>
              {items.map(({ q, n }) => {
                const s = progress[q.id];
                const status = s?.solved ? 'solved' : s?.revealed ? 'revealed' : s?.attempts ? 'tried' : 'new';
                const label = { solved: 'solved', revealed: 'answer shown', tried: 'attempted', new: 'not started' }[status];
                return (
                  <li key={q.id}>
                    <button
                      className={`q-item ${currentId === q.id ? 'current' : ''}`}
                      onClick={() => onOpen(q.id)}
                      aria-current={currentId === q.id ? 'page' : undefined}
                    >
                      <span className={`mark mark-${status}`} aria-label={label} />
                      <span className="q-num">{n}</span>
                      <span className="q-title">{q.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </nav>
  );
}

function TableBrowser({ tables, error }: { tables: SchemaTable[] | null; error: string }) {
  const [filter, setFilter] = useState('');
  const [openT, setOpenT] = useState<Record<string, boolean>>({});
  if (error) return <p className="side-note">{error}</p>;
  if (!tables) return <p className="side-note">Loading tables…</p>;
  const f = filter.trim().toLowerCase();
  const shown = tables.filter((t) => !f || t.name.includes(f) || t.columns.some((c) => c.name.includes(f)));
  return (
    <div className="tables">
      <input
        className="search"
        type="search"
        placeholder="Find a table or column"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Find a table or column"
      />
      <p className="side-note">
        A <span className="key">key</span> uniquely identifies each row. An arrow shows which table a column points to, which
        is what you join on.
      </p>
      <ul>
        {shown.map((t) => {
          const isOpen = !!f || !!openT[t.name];
          return (
            <li key={t.name}>
              <button className="table-row" aria-expanded={isOpen} onClick={() => setOpenT((o) => ({ ...o, [t.name]: !o[t.name] }))}>
                <span className="caret" aria-hidden>
                  {isOpen ? '▾' : '▸'}
                </span>
                <span className="table-name">{t.name}</span>
                <span className="table-count">{t.rows.toLocaleString()} rows</span>
              </button>
              {isOpen && (
                <ul className="cols">
                  {t.columns.map((c) => (
                    <li key={c.name} className={f && c.name.includes(f) ? 'hit' : undefined}>
                      <span className="col">{c.name}</span>
                      {c.pk && <span className="key">key</span>}
                      {c.ref && <span className="ref">→ {c.ref.split('.')[0]}</span>}
                      <span className="type">{c.type.replace('timestamp without time zone', 'timestamp')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Hints({
  hints,
  used,
  onShow,
  onReveal,
  revealBusy,
  solved,
}: {
  hints: string[];
  used: number;
  onShow: () => void;
  onReveal: () => void;
  revealBusy: boolean;
  solved: boolean;
}) {
  return (
    <div className="hints">
      {used > 0 && (
        <ol className="hint-list">
          {hints.slice(0, used).map((h, i) => (
            <li key={i}>
              <span className="hint-n">Hint {i + 1}</span>
              <p>{h}</p>
            </li>
          ))}
        </ol>
      )}
      <div className="hint-actions">
        {used < 3 ? (
          <button className="btn btn-hint" onClick={onShow}>
            Show hint {used + 1}
            <span className="hint-left">{3 - used} left</span>
          </button>
        ) : (
          !solved && (
            <button className="btn btn-quiet" onClick={onReveal} disabled={revealBusy}>
              {revealBusy ? 'Loading…' : 'Show the answer'}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function VerdictPanel({
  verdict,
  question,
  number,
  state,
  next,
  onNext,
}: {
  verdict: Verdict;
  question: Question;
  number: number;
  state: QState;
  next: Question | null;
  onNext: () => void;
}) {
  if (!verdict.correct) {
    return (
      <section className="not-yet" role="status">
        <h2>Not quite yet</h2>
        <ul>
          {verdict.messages.map((m, i) => (
            <li key={i}>{rich(m)}</li>
          ))}
        </ul>
        <p className="not-yet-foot">Your result is below. Adjust the query and submit again. There’s no limit on attempts.</p>
      </section>
    );
  }
  return (
    <section className="receipt" role="status">
      <div className="receipt-paper">
        <p className="receipt-shop">Chapter &amp; Crema</p>
        <p className="receipt-sub">Analyst ticket</p>
        <div className="receipt-rule" />
        <dl className="receipt-lines">
          <div>
            <dt>
              #{number} {question.title}
            </dt>
            <dd>Solved</dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd>{state.attempts}</dd>
          </div>
          <div>
            <dt>Hints used</dt>
            <dd>{state.hints} of 3</dd>
          </div>
          {verdict.expectedRowCount !== undefined && (
            <div>
              <dt>Rows returned</dt>
              <dd>{verdict.expectedRowCount}</dd>
            </div>
          )}
        </dl>
        <div className="receipt-rule" />
        {verdict.orderNote && <p className="receipt-note">{verdict.orderNote}</p>}
        {verdict.messages.map((m, i) => (
          <p key={i} className="receipt-note">
            {m}
          </p>
        ))}
        {verdict.insight && (
          <div className="receipt-insight">
            <h3>What this tells the owner</h3>
            <p>{verdict.insight}</p>
          </div>
        )}
        {verdict.solution && (
          <details className="receipt-solution">
            <summary>Compare with the reference answer</summary>
            <pre>{verdict.solution}</pre>
          </details>
        )}
        {next && (
          <button className="btn btn-primary receipt-next" onClick={onNext}>
            Next: {next.title}
          </button>
        )}
      </div>
    </section>
  );
}
