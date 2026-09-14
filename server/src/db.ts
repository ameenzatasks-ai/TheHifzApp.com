import path from 'path';
import fs from 'fs';
import { createSqliteClient } from './sqlite';

/**
 * DATABASE_URL points at Turso in production (libsql://…, with an auth token).
 * Without it we fall back to a local file, so development and the existing
 * DATABASE_PATH setups carry on unchanged.
 *
 * The database has to live off the container: App Platform and Render both
 * give you an ephemeral filesystem, so a SQLite file beside the app is erased
 * on every deploy and restart — precisely how accounts kept disappearing.
 */
const IS_REMOTE = Boolean(process.env.DATABASE_URL);
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../nazirah.db');
const DB_URL = process.env.DATABASE_URL ?? `file:${DB_PATH}`;

if (!IS_REMOTE) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = createSqliteClient(DB_URL, process.env.DATABASE_AUTH_TOKEN);

export async function runMigrations(): Promise<void> {
  // WAL is a local-file concern; Turso manages its own storage, so asking a
  // remote database to change journal mode is meaningless.
  if (!IS_REMOTE) {
    await db.pragma('journal_mode = WAL');
  }
  await db.pragma('foreign_keys = ON');

  // ── Legacy schema detection ──────────────────────────────────
  // v1 (password-auth era) → drop everything.
  try {
    // MUST be awaited. This probe is meant to THROW on any schema that is not
    // v1, and the catch below is what says "not v1, leave the data alone".
    // Un-awaited, the rejection escapes the try/catch entirely, the guard
    // inverts, and every start-up concludes it is v1 and drops every table —
    // destroying all accounts, classes and progress on a healthy database.
    await db.prepare('SELECT password FROM users LIMIT 1').get();
    console.log('Detected v1 schema — dropping all tables for v2 migration...');
    await db.exec(`
      DROP TABLE IF EXISTS announcements;
      DROP TABLE IF EXISTS page_reads;
      DROP TABLE IF EXISTS enrolments;
      DROP TABLE IF EXISTS classes;
      DROP TABLE IF EXISTS users;
    `);
  } catch {
    /* not v1 */
  }

  // ── Core schema (idempotent) ─────────────────────────────────
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id     TEXT    UNIQUE,
      name          TEXT    NOT NULL,
      email         TEXT    UNIQUE,
      username      TEXT    UNIQUE,
      password_hash TEXT,
      avatar_url    TEXT,
      role          TEXT    CHECK(role IN ('ustadh', 'student')),
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS classes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      ustadh_id   INTEGER NOT NULL REFERENCES users(id),
      join_code   TEXT    UNIQUE NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS enrolments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id    INTEGER NOT NULL REFERENCES classes(id),
      student_id  INTEGER NOT NULL REFERENCES users(id),
      joined_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS page_reads (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id     INTEGER NOT NULL REFERENCES users(id),
      page_number    INTEGER NOT NULL CHECK(page_number BETWEEN 1 AND 604),
      read_count     INTEGER NOT NULL DEFAULT 0 CHECK(read_count >= 0),
      last_read_at   TEXT,
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, page_number)
    );

    CREATE TABLE IF NOT EXISTS class_invitations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id    INTEGER NOT NULL REFERENCES classes(id),
      phone       TEXT    NOT NULL,
      created_by  INTEGER NOT NULL REFERENCES users(id),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Page-level status (one row per page per student) ───────
    -- Pages without a row are "untouched" (default state).
    CREATE TABLE IF NOT EXISTS student_page_status (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id     INTEGER NOT NULL REFERENCES users(id),
      variant        TEXT    NOT NULL DEFAULT 'NEW_MADANI',
      page_number    INTEGER NOT NULL CHECK(page_number BETWEEN 1 AND 604),
      status         TEXT    NOT NULL
                             CHECK(status IN ('BLACK','RED','AMBER','YELLOW','GREEN','GOLD')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      set_by_user_id INTEGER NOT NULL REFERENCES users(id),
      UNIQUE(student_id, variant, page_number)
    );

    -- ── Bank-statement audit log ────────────────────────────────
    CREATE TABLE IF NOT EXISTS status_history (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id     INTEGER NOT NULL REFERENCES users(id),
      variant        TEXT    NOT NULL DEFAULT 'NEW_MADANI',
      page_number    INTEGER NOT NULL,
      from_status    TEXT,
      to_status      TEXT,   -- NULL = untouched (page status row deleted)
      changed_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      changed_by     INTEGER NOT NULL REFERENCES users(id),
      note           TEXT
    );

    -- ── Indexes ─────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_page_reads_student    ON page_reads(student_id);
    CREATE INDEX IF NOT EXISTS idx_enrolments_class      ON enrolments(class_id);
    CREATE INDEX IF NOT EXISTS idx_enrolments_student    ON enrolments(student_id);
    CREATE INDEX IF NOT EXISTS idx_invitations_class     ON class_invitations(class_id);
    CREATE INDEX IF NOT EXISTS idx_page_status_lookup
      ON student_page_status(student_id, variant, page_number);
    CREATE INDEX IF NOT EXISTS idx_history_student_time
      ON status_history(student_id, changed_at DESC);

    -- ── Nazira weekly log snapshots ─────────────────────────────
    -- Student taps "Save" → current page statuses are snapshotted here.
    -- One header row per (student, date); pages stored in nazirah_log_pages.
    -- The UNIQUE constraint means re-saving on the same date overwrites.
    CREATE TABLE IF NOT EXISTS nazirah_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id),
      log_date   TEXT    NOT NULL,   -- YYYY-MM-DD (student-chosen date)
      notes      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, log_date)
    );

    CREATE TABLE IF NOT EXISTS nazirah_log_pages (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      log_id      INTEGER NOT NULL REFERENCES nazirah_logs(id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL CHECK(page_number BETWEEN 1 AND 604),
      status      TEXT    NOT NULL
                          CHECK(status IN ('BLACK','RED','AMBER','YELLOW','GREEN','GOLD')),
      UNIQUE(log_id, page_number)
    );

    CREATE INDEX IF NOT EXISTS idx_nazirah_logs_student
      ON nazirah_logs(student_id, log_date DESC);
    CREATE INDEX IF NOT EXISTS idx_nazirah_log_pages_log
      ON nazirah_log_pages(log_id);

    -- ── Drop deprecated tables from earlier iterations ─────────
    DROP TABLE IF EXISTS chat_messages;
    DROP TABLE IF EXISTS weekly_snapshots;
    DROP TABLE IF EXISTS student_quarter_status;
  `);

  // ── Hifz module tables ────────────────────────────────────────────────────
  await db.exec(`
    -- Student daily task submissions (Sabaq, Sabaq Para, Dawr)
    CREATE TABLE IF NOT EXISTS hifz_daily_tasks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES users(id),
      class_id     INTEGER REFERENCES classes(id),
      task_date    TEXT    NOT NULL,
      task_type    TEXT    NOT NULL
                           CHECK(task_type IN ('sabaq','sabaq_para','dawr')),
      sabaq_surah  INTEGER,
      sabaq_verse  INTEGER,
      sp_start     INTEGER,
      dawr_entries TEXT,   -- JSON: [{juz:1,quarter:"1/4"}, ...]
      submitted_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Dawr log grid: one row per (student, class, juz, quarter)
    -- Updated each time the student submits a matching Dawr task.
    CREATE TABLE IF NOT EXISTS hifz_dawr_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id  INTEGER NOT NULL REFERENCES users(id),
      class_id    INTEGER REFERENCES classes(id),
      juz_number  INTEGER NOT NULL CHECK(juz_number BETWEEN 1 AND 30),
      quarter     TEXT    NOT NULL CHECK(quarter IN ('1/4','1/2','3/4','full')),
      logged_date TEXT,
      score       INTEGER CHECK(score BETWEEN 1 AND 7),
      score_label TEXT,
      comment     TEXT,
      scored_by   INTEGER REFERENCES users(id),
      scored_at   TEXT,
      UNIQUE(student_id, class_id, juz_number, quarter)
    );

    -- Ustadh scores for SP, Sabaq, Tajwid, Adab (one row per student, class, date)
    CREATE TABLE IF NOT EXISTS hifz_task_scores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES users(id),
      class_id     INTEGER REFERENCES classes(id),
      task_date    TEXT    NOT NULL,
      sp_score     INTEGER CHECK(sp_score     BETWEEN 1 AND 7),
      sabaq_score  INTEGER CHECK(sabaq_score  BETWEEN 1 AND 7),
      tajwid_score INTEGER CHECK(tajwid_score BETWEEN 1 AND 7),
      adab_score   INTEGER CHECK(adab_score   BETWEEN 1 AND 7),
      comment      TEXT,
      scored_by    INTEGER REFERENCES users(id),
      scored_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, class_id, task_date)
    );

    CREATE INDEX IF NOT EXISTS idx_hdt_student
      ON hifz_daily_tasks(student_id, task_date DESC);
    CREATE INDEX IF NOT EXISTS idx_hdl_student
      ON hifz_dawr_log(student_id);
    CREATE INDEX IF NOT EXISTS idx_hts_student
      ON hifz_task_scores(student_id, task_date DESC);

    -- SQLite treats NULL != NULL in UNIQUE constraints, so ON CONFLICT never fires
    -- for rows where class_id IS NULL.  These partial indexes cover that case so
    -- the targetless "ON CONFLICT DO UPDATE" upserts work correctly for both paths.
    CREATE UNIQUE INDEX IF NOT EXISTS uidx_hdl_noclass
      ON hifz_dawr_log(student_id, juz_number, quarter)
      WHERE class_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uidx_hts_noclass
      ON hifz_task_scores(student_id, task_date)
      WHERE class_id IS NULL;
  `);

  // ── Hifz class_id migration ────────────────────────────────────────────────
  // Add class_id to hifz tables if not present, and recreate tables with
  // updated UNIQUE constraints so data is isolated per class.
  interface ColInfo { name: string; notnull: number }
  const hdtCols = await db.prepare("PRAGMA table_info(hifz_daily_tasks)").all() as ColInfo[];
  if (hdtCols.length > 0 && !hdtCols.some(c => c.name === 'class_id')) {
    console.log('Migrating Hifz tables to include class_id...');

    // 1. hifz_daily_tasks — just add column (no unique constraint affected)
    await db.exec(`ALTER TABLE hifz_daily_tasks ADD COLUMN class_id INTEGER REFERENCES classes(id)`);

    // 2. hifz_dawr_log — recreate with new UNIQUE(student_id, class_id, juz_number, quarter)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS hifz_dawr_log_v2 (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL REFERENCES users(id),
        class_id    INTEGER REFERENCES classes(id),
        juz_number  INTEGER NOT NULL CHECK(juz_number BETWEEN 1 AND 30),
        quarter     TEXT    NOT NULL CHECK(quarter IN ('1/4','1/2','3/4','full')),
        logged_date TEXT,
        score       INTEGER CHECK(score BETWEEN 1 AND 7),
        score_label TEXT,
        comment     TEXT,
        scored_by   INTEGER REFERENCES users(id),
        scored_at   TEXT,
        UNIQUE(student_id, class_id, juz_number, quarter)
      )
    `);
    await db.exec(`
      INSERT OR IGNORE INTO hifz_dawr_log_v2
        (id, student_id, class_id, juz_number, quarter, logged_date,
         score, score_label, comment, scored_by, scored_at)
      SELECT id, student_id, NULL, juz_number, quarter, logged_date,
             score, score_label, comment, scored_by, scored_at
      FROM hifz_dawr_log
    `);
    await db.exec('DROP TABLE hifz_dawr_log');
    await db.exec('ALTER TABLE hifz_dawr_log_v2 RENAME TO hifz_dawr_log');

    // 3. hifz_task_scores — recreate with UNIQUE(student_id, class_id, task_date)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS hifz_task_scores_v2 (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id   INTEGER NOT NULL REFERENCES users(id),
        class_id     INTEGER REFERENCES classes(id),
        task_date    TEXT    NOT NULL,
        sp_score     INTEGER CHECK(sp_score     BETWEEN 1 AND 7),
        sabaq_score  INTEGER CHECK(sabaq_score  BETWEEN 1 AND 7),
        tajwid_score INTEGER CHECK(tajwid_score BETWEEN 1 AND 7),
        adab_score   INTEGER CHECK(adab_score   BETWEEN 1 AND 7),
        comment      TEXT,
        scored_by    INTEGER REFERENCES users(id),
        scored_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(student_id, class_id, task_date)
      )
    `);
    await db.exec(`
      INSERT OR IGNORE INTO hifz_task_scores_v2
        (id, student_id, class_id, task_date, sp_score, sabaq_score,
         tajwid_score, adab_score, comment, scored_by, scored_at)
      SELECT id, student_id, NULL, task_date, sp_score, sabaq_score,
             tajwid_score, adab_score, comment, scored_by, scored_at
      FROM hifz_task_scores
    `);
    await db.exec('DROP TABLE hifz_task_scores');
    await db.exec('ALTER TABLE hifz_task_scores_v2 RENAME TO hifz_task_scores');

    // Recreate indexes
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_hdt_class ON hifz_daily_tasks(student_id, class_id, task_date DESC);
      CREATE INDEX IF NOT EXISTS idx_hdl_class ON hifz_dawr_log(student_id, class_id);
      CREATE INDEX IF NOT EXISTS idx_hts_class ON hifz_task_scores(student_id, class_id, task_date DESC);
    `);
    console.log('Hifz class_id migration complete.');
  }

  // After migration, ensure class_id indexes exist (safe for fresh DBs too)
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_hdt_class ON hifz_daily_tasks(student_id, class_id, task_date DESC);
    CREATE INDEX IF NOT EXISTS idx_hdl_class ON hifz_dawr_log(student_id, class_id);
    CREATE INDEX IF NOT EXISTS idx_hts_class ON hifz_task_scores(student_id, class_id, task_date DESC);
  `);

  // ── Dawr cycles migration ───────────────────────────────────────────────────
  // Old: UNIQUE(student_id, class_id, juz_number, quarter) — one row per juz/quarter
  // New: UNIQUE(student_id, class_id, juz_number, quarter, logged_date) — one row per cycle
  const noClassIdxCols = await db
    .prepare('PRAGMA index_info(uidx_hdl_noclass)')
    .all() as Array<{ name: string }>;
  if (!noClassIdxCols.some(c => c.name === 'logged_date')) {
    console.log('Migrating hifz_dawr_log to support dawr cycles...');
    await db.exec(`
      CREATE TABLE hifz_dawr_log_cyc (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id  INTEGER NOT NULL REFERENCES users(id),
        class_id    INTEGER REFERENCES classes(id),
        juz_number  INTEGER NOT NULL CHECK(juz_number BETWEEN 1 AND 30),
        quarter     TEXT    NOT NULL CHECK(quarter IN ('1/4','1/2','3/4','full')),
        logged_date TEXT    NOT NULL DEFAULT (date('now')),
        score       INTEGER CHECK(score BETWEEN 1 AND 7),
        score_label TEXT,
        comment     TEXT,
        scored_by   INTEGER REFERENCES users(id),
        scored_at   TEXT,
        UNIQUE(student_id, class_id, juz_number, quarter, logged_date)
      )
    `);
    await db.exec(`
      INSERT OR IGNORE INTO hifz_dawr_log_cyc
        (id, student_id, class_id, juz_number, quarter, logged_date,
         score, score_label, comment, scored_by, scored_at)
      SELECT id, student_id, class_id, juz_number, quarter,
             COALESCE(logged_date, date('now')),
             score, score_label, comment, scored_by, scored_at
      FROM hifz_dawr_log
    `);
    await db.exec('DROP INDEX IF EXISTS uidx_hdl_noclass');
    await db.exec('DROP INDEX IF EXISTS idx_hdl_student');
    await db.exec('DROP INDEX IF EXISTS idx_hdl_class');
    await db.exec('DROP TABLE hifz_dawr_log');
    await db.exec('ALTER TABLE hifz_dawr_log_cyc RENAME TO hifz_dawr_log');
    await db.exec(`
      CREATE UNIQUE INDEX uidx_hdl_noclass
        ON hifz_dawr_log(student_id, juz_number, quarter, logged_date)
        WHERE class_id IS NULL;
      CREATE INDEX idx_hdl_student ON hifz_dawr_log(student_id);
      CREATE INDEX idx_hdl_class   ON hifz_dawr_log(student_id, class_id);
    `);
    console.log('Dawr cycles migration complete.');
  }

  // ── Memorisation order ──────────────────────────────────────────────────────
  // Which direction the student works through the Mus'haf, asked at sign-up.
  // It used to be thrown away once the backfill had used it; the Nazirah
  // tracker needs it so a student memorising back to front opens on page 604
  // rather than page 1. Nullable: existing students, and anyone who skipped the
  // question, simply read forward.
  const userColsOrder = await db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (userColsOrder.length > 0 && !userColsOrder.some(c => c.name === 'memorisation_order')) {
    // No CHECK constraint: SQLite's ALTER TABLE cannot add one, and the value
    // is already constrained by the schema the endpoint validates against.
    await db.exec('ALTER TABLE users ADD COLUMN memorisation_order TEXT');
    console.log('Added memorisation_order column to users.');
  }

  // ── Sabaq lines migration ───────────────────────────────────────────────────
  // Add sabaq_lines column to hifz_daily_tasks if not present.
  const hdtColsNow = await db.prepare('PRAGMA table_info(hifz_daily_tasks)').all() as Array<{ name: string }>;
  if (!hdtColsNow.some(c => c.name === 'sabaq_lines')) {
    await db.exec('ALTER TABLE hifz_daily_tasks ADD COLUMN sabaq_lines INTEGER');
    console.log('Added sabaq_lines column to hifz_daily_tasks.');
  }

  // ── Username/password auth migration ──────────────────────────────────────
  // Add username + password_hash columns and make google_id/email nullable.
  const userCols = await db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string; notnull: number }>;
  if (userCols.length > 0 && !userCols.some(c => c.name === 'username')) {
    console.log('Migrating users table to support username/password auth...');
    await db.pragma('foreign_keys = OFF');
    await db.exec(`
      CREATE TABLE users_v4 (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id     TEXT    UNIQUE,
        name          TEXT    NOT NULL,
        email         TEXT    UNIQUE,
        username      TEXT    UNIQUE,
        password_hash TEXT,
        avatar_url    TEXT,
        role          TEXT    CHECK(role IN ('ustadh', 'student')),
        created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO users_v4 (id, google_id, name, email, avatar_url, role, created_at)
        SELECT id, google_id, name, email, avatar_url, role, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_v4 RENAME TO users;
    `);
    await db.pragma('foreign_keys = ON');
    console.log('Users table migration complete.');
  }

  // ── status_history schema repair ───────────────────────────────────────────
  //
  // Two legacy problems can exist in the live database:
  //   1. quarter_index NOT NULL  — column from the quarter-based era; caused
  //      SQLITE_CONSTRAINT_NOTNULL on every INSERT once the code stopped
  //      supplying it.
  //   2. to_status NOT NULL      — old schema; breaks the "untouch page"
  //      operation that sets to_status = NULL in history.
  //
  // CREATE TABLE IF NOT EXISTS never alters existing tables, so we must detect
  // and repair manually.  The fix: recreate the table with the correct schema,
  // copying all surviving columns.
  //
  const histCols = await db.prepare("PRAGMA table_info(status_history)").all() as ColInfo[];
  const hasQuarterIndex = histCols.some(c => c.name === 'quarter_index');
  const toStatusNotNull  = histCols.some(c => c.name === 'to_status' && c.notnull === 1);

  if (hasQuarterIndex || toStatusNotNull) {
    console.log('Repairing status_history schema (stale constraints detected)...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS status_history_v3 (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id     INTEGER NOT NULL REFERENCES users(id),
        variant        TEXT    NOT NULL DEFAULT 'NEW_MADANI',
        page_number    INTEGER NOT NULL,
        from_status    TEXT,
        to_status      TEXT,
        changed_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        changed_by     INTEGER NOT NULL REFERENCES users(id),
        note           TEXT
      )
    `);
    await db.exec(`
      INSERT OR IGNORE INTO status_history_v3
        (id, student_id, variant, page_number, from_status, to_status, changed_at, changed_by, note)
      SELECT id, student_id, variant, page_number, from_status, to_status, changed_at, changed_by, note
      FROM status_history
    `);
    await db.exec('DROP TABLE status_history');
    await db.exec('ALTER TABLE status_history_v3 RENAME TO status_history');
    await db.exec('CREATE INDEX IF NOT EXISTS idx_history_student_time ON status_history(student_id, changed_at DESC)');
    console.log('status_history repair complete.');
  }

  // ── Ustadh Code (co-teacher access) ──────────────────────────────────────────
  // Each class gets a reusable code that only ustadhs can use to join as co-teachers.
  // This prevents unauthorized ustadhs from accessing the class.
  const classColsUstadh = await db.prepare('PRAGMA table_info(classes)').all() as Array<{ name: string }>;
  if (classColsUstadh.length > 0 && !classColsUstadh.some(c => c.name === 'ustadh_code')) {
    await db.exec('ALTER TABLE classes ADD COLUMN ustadh_code TEXT UNIQUE NOT NULL DEFAULT ""');
    console.log('Added ustadh_code column to classes.');
  }

  // Create class_ustadhs table to track authorized co-ustadhs
  await db.exec(`
    CREATE TABLE IF NOT EXISTS class_ustadhs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      ustadh_id    INTEGER NOT NULL REFERENCES users(id),
      added_by     INTEGER NOT NULL REFERENCES users(id),
      added_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, ustadh_id)
    )
  `);
  await db.exec('CREATE INDEX IF NOT EXISTS idx_class_ustadhs_class ON class_ustadhs(class_id)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_class_ustadhs_ustadh ON class_ustadhs(ustadh_id)');
  console.log('Ustadh Code security migration complete.');
}

// Migrations are NOT run here any more. They used to be, because better-sqlite3
// compiled a prepared statement against the live schema the moment a router
// module was imported, so the tables had to exist by then — and being
// synchronous, calling it here guaranteed that.
//
// Neither half of that holds now. prepare() only stores the SQL and does not
// touch the database until the statement is executed, so module-level
// statements no longer need the schema to exist at import time. And the call is
// async: left here it would return a floating promise that runs CONCURRENTLY
// with the awaited call in index.ts — two migration runs racing on one
// database, which is exactly what a schema migration must never do.
//
// index.ts awaits runMigrations() before it starts listening.

export default db;
