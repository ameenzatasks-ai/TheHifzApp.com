# The Hifz App

A private web application for tracking Quran Hifz (memorisation). Students log their daily tasks — Dawr, Sabaq, and Sabaq Para — and their Ustadh reviews and scores each submission.

---

## Features

### Students
- **Date-aware task submission** — pick the date before logging (submit the night before for the following day)
- **Dawr** — log full-Juz revision; select Juz and quarter (1/4 · 2/4 · 3/4 · 4/4); add multiple Juz per session
- **Sabaq** — log new memorisation with Surah, starting verse, and line count
- **Sabaq Para** — log a 10-page para review with starting page number
- **Dawr Log** — 30 Juz × 4 quarter grid; re-reading the same cell on a new date adds a second cycle row instead of overwriting the first
- **SP & Sabaq Log** — view scored history with colour-coded marks
- **History** — cross-class timeline of all past tasks and Ustadh scores

### Ustadhs
- **Class management** — create classes, share join codes, manage enrolments
- **Student review** — score each student's Dawr cycles (and specific historical cycles), Sabaq, Sabaq Para, Tajwīd, and Adab on a 1–7 scale
- **Hifz History** — per-student breakdown of all submissions including lines memorised
- **Today view** — see which students have submitted tasks for the current day

### General
- Sign in with Google — no passwords
- Progressive Web App (PWA) — installable on mobile and desktop
- Dark UI with Amiri Arabic calligraphy accents

---

## Score Scale (1–7)

| Score | Label | Colour |
|---|---|---|
| 7 | Excellent | Green |
| 6 | Very Good | Light Green |
| 5 | Average | Blue |
| 4 | Below Average | Yellow |
| 3 | Fail | Amber |
| 2 | Bad Fail | Red |
| 1 | Abysmal | Dark Red |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| Backend | Express 4, TypeScript, better-sqlite3 |
| Auth | Google OAuth 2.0 (Passport.js) + JWT (httpOnly cookie, 30-day) |
| Database | SQLite with WAL mode, foreign-key constraints enforced |
| PWA | vite-plugin-pwa |
| Monorepo | npm workspaces (packages hoisted to root `node_modules`) |

---

## Project Structure

```
/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── api/             # Typed fetch wrappers (dawr, hifzTasks, …)
│       ├── components/      # Shared components (nav, spinner, modals)
│       ├── contexts/        # AuthContext (current user + role)
│       └── pages/
│           ├── hifz/        # HifzHome, DawrLog, StudentDawrLog
│           └── class/       # StudentDetail, HifzHistoryPage
├── server/                  # Express backend
│   └── src/
│       ├── auth/            # Google OAuth flow + JWT middleware
│       ├── classes/         # Class CRUD, enrolments
│       ├── dawr/            # Dawr log grid, cycle management, scoring
│       └── hifz-tasks/      # Daily task submission + SP/Sabaq scoring
└── .env.example
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials — [create here](https://console.cloud.google.com/apis/credentials)

### 1 — Install dependencies

```bash
npm install
```

Run once at the repo root. npm workspaces hoist everything automatically.

### 2 — Configure environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Long random string — keep secret in production |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` (dev) |
| `CLIENT_ORIGIN` | `http://localhost:5173` (dev) |
| `SMTP_HOST/PORT/USER/PASS` | Optional. Gmail + App Password for account-deletion OTP. Leave blank to print codes to the server console. |

In Google Cloud Console, add `http://localhost:3001/api/auth/google/callback` as an **Authorised redirect URI**.

### 3 — Run in development

```bash
# Terminal 1 — backend on :3001
npm run dev --workspace=server

# Terminal 2 — frontend on :5173
npm run dev --workspace=client
```

Vite proxies all `/api/*` requests to `http://127.0.0.1:3001` in development.

---

## Production Build

```bash
npm run build --workspace=client   # outputs to client/dist/
npm run build --workspace=server   # outputs to dist/
npm run start --workspace=server
```

Serve `client/dist` via a CDN or static host, set `CLIENT_ORIGIN` to that URL, and point your domain at the backend.

---

## User Roles

| Role | How to assign |
|---|---|
| **Student** | Default role after Google sign-in |
| **Ustadh** | Set manually: `UPDATE users SET role = 'ustadh' WHERE email = 'you@example.com'` |

Students who access the Hifz module are redirected to their class list first; they cannot access the module without joining a class.

---

## Database

SQLite is created automatically at `server/nazirah.db` on first run. Migrations execute on every startup — no manual steps required.

**Core tables**

| Table | Purpose |
|---|---|
| `users` | Accounts (Google sub, name, email, role) |
| `classes` | Classes owned by an Ustadh |
| `enrolments` | Student ↔ class membership |
| `class_invitations` | Invitations sent before 2.3.2 (no longer created) |
| `hifz_daily_tasks` | Student task submissions (Dawr, Sabaq, SP) |
| `hifz_task_scores` | Ustadh scores per date (SP, Sabaq, Tajwīd, Adab) |
| `hifz_dawr_log` | Dawr grid cells — one row per (student, class, juz, quarter, date) |

---

## API Overview

All routes are prefixed `/api`. Protected routes require a valid `nazirah_token` cookie.

```
POST   /api/auth/google            Start Google OAuth flow
GET    /api/auth/google/callback   OAuth redirect handler
GET    /api/auth/me                Current user

GET    /api/classes                My classes
POST   /api/classes                Create class (Ustadh)
DELETE /api/classes/:id            Delete class (Ustadh, owner)

POST   /api/hifz-tasks             Submit tasks for a date (Student)
GET    /api/hifz-tasks             Own task history
PATCH  /api/hifz-tasks/student/:id/score   Score a student's date (Ustadh)

GET    /api/dawr/:studentId        Dawr log grid for a student
PATCH  /api/dawr/:juz              Score a Dawr cell / cycle (Ustadh)
```

---

## License

Private — all rights reserved.
