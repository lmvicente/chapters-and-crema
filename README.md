# Chapter & Crema SQL Lab

A practice app for the Chapter & Crema database: 46 business questions, a SQL editor,
3 hints per question, unlimited attempts, and automatic grading.

## How it stays secure

- **No database credentials in the browser.** Queries go to the app's server (Vercel
  functions), which connects to Supabase with the `sql_student` login. Its password
  only exists in Vercel's environment variables.
- **`sql_student` can only read `chapter_crema`.** On top of that, every query runs in a
  read-only transaction that is always rolled back, so nothing can be changed through the app.
- **One statement per run.** `SELECT 1; DELETE …` and `COMMIT; …` tricks are rejected.
- **Runaway queries are stopped** after 8 seconds, and at most 1,000 rows are sent back.
- **The app is behind a passcode.** The login cookie is signed, HTTP-only, and lasts
  30 days. Wrong passcodes are rate-limited.
- **Answers stay on the server** until a question is solved or she chooses
  "Show the answer" after using all 3 hints.

The Supabase publishable key isn't used. It's for Supabase's REST API, which can't run
free-form SQL, so the app connects to Postgres directly instead.

## Setup

### 1. The read-only login (Supabase SQL editor)

If you already ran `02_student_access.sql`, the `sql_student` login exists. Just give it
a new password:

```sql
ALTER ROLE sql_student WITH PASSWORD 'paste-a-long-random-password';
```

Otherwise run `02_student_access.sql` with your password in it. Use letters and
numbers only (no `@ : / ? #`), so it can go in a connection string without encoding.

### 2. Connection string

In Supabase, click **Connect** and copy the **Session pooler** connection string. It looks like:

```
postgresql://postgres.jmrpnfrwwirfucvdnjsv:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Change the user from `postgres.` to `sql_student.` and put in sql_student's password:

```
postgresql://sql_student.jmrpnfrwwirfucvdnjsv:<sql_student password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Keep the host and region exactly as Supabase shows them.

### 3. Deploy to Vercel

1. Push this folder to a new GitHub repository (private is fine).
2. In Vercel: **Add New → Project**, import the repository. The defaults are correct
   (Next.js is detected automatically).
3. Before deploying, add these **Environment Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | The connection string from step 2 |
| `APP_PASSCODE` | The passcode she'll type to get in |
| `SESSION_SECRET` | A random string, 32+ characters (`openssl rand -base64 32`) |
| `DATABASE_CA_CERT` | Optional, recommended. See below |

4. Deploy, open the URL, and enter the passcode.

**`DATABASE_CA_CERT`:** in Supabase, go to **Database settings → SSL Configuration →
Download certificate**, open the file in a text editor, and paste the whole thing
(including the `BEGIN`/`END` lines) as the value. With it set, the server's certificate
is fully verified. Without it, the connection is still encrypted but not verified. If
the app can't connect after you add it, remove it and redeploy, then let me know.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

`npm run test:grader` checks that every reference answer grades as correct, that
known-wrong answers fail, that alternate correct answers pass, and that the safety
limits hold. It needs `DATABASE_URL` set.

## Troubleshooting

- **"Couldn't reach the database"**: free Supabase projects pause after about a week
  of inactivity. Open the dashboard and click **Restore**.
- **"The server's database login was rejected"**: check the user in `DATABASE_URL` is
  `sql_student.<project-ref>` and the password matches.
- **The app says it isn't configured**: `APP_PASSCODE` or `SESSION_SECRET` is
  missing, or the secret is shorter than 16 characters. Redeploy after adding them.
- **Progress is saved in her browser.** Switching browsers or clearing site data
  starts her over.

## Changing the questions

- Prompts and hints: `lib/questions.ts`
- Reference answers and the insight shown after solving: `lib/solutions.ts`

Each solution should return only the columns its question asks for. Grading ignores
column names, column order, extra columns, and row order (unless the question asks
for a sort, which only adds a note). Numbers only need to match to the precision the
reference answer shows.
