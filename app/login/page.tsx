'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Sign-in failed. Try again.');
    } catch {
      setError('Couldn’t reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand brand-lg">
          <img src="/icon.svg" alt="" width={36} height={36} />
          <span>
            Chapter &amp; Crema <em>SQL Lab</em>
          </span>
        </div>
        <p className="login-copy">
          You’re the new data analyst for a coffee shop and bookstore. Nearly four years of sales are waiting.
        </p>
        <label htmlFor="passcode">Passcode</label>
        <input
          id="passcode"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
          required
        />
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy || !passcode}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
