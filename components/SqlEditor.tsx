'use client';

import CodeMirror from '@uiw/react-codemirror';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useMemo, useRef } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun: () => void;
  onSubmit?: () => void;
  schema: Record<string, string[]>;
};

const theme = EditorView.theme({
  '&': { fontSize: '14px', backgroundColor: 'var(--surface)' },
  '.cm-content': { fontFamily: 'var(--mono)', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--faint)', border: 'none', fontFamily: 'var(--mono)' },
  '.cm-activeLine': { backgroundColor: 'var(--green-wash)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-tooltip-autocomplete': { fontFamily: 'var(--mono)' },
});

export default function SqlEditor({ value, onChange, onRun, onSubmit, schema }: Props) {
  // Keep the latest callbacks without rebuilding the editor's extensions on every render.
  const run = useRef(onRun);
  const submit = useRef(onSubmit);
  run.current = onRun;
  submit.current = onSubmit;

  const extensions = useMemo(
    () => [
      sql({ dialect: PostgreSQL, schema, upperCaseKeywords: true }),
      theme,
      EditorView.lineWrapping,
      Prec.highest(
        keymap.of([
          { key: 'Mod-Enter', run: () => (run.current(), true) },
          { key: 'Shift-Mod-Enter', run: () => (submit.current?.(), true) },
        ]),
      ),
    ],
    [schema],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      minHeight="200px"
      maxHeight="420px"
      basicSetup={{ foldGutter: false, highlightActiveLineGutter: true }}
      aria-label="SQL editor"
      placeholder="-- Write your query here"
    />
  );
}
