import 'dotenv/config';
// Express 4 does not catch rejections from async route handlers: an unhandled
// rejection kills the Node process, so ONE failing query took the entire site
// down rather than returning 500 for the one request that caused it. This
// patches async handler rejections through to the error middleware below.
// (Express 5 does this natively; when this upgrades, the import can go.)
import 'express-async-errors';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import os from 'os';
import { runMigrations } from './db';
import { configurePassport } from './auth/passport';
import passportInstance from './auth/passport';
import authRouter from './auth/router';
import classesRouter from './classes/router';
import pagesRouter from './pages/router';
import hifzRouter from './hifz/router';
import nazirahRouter from './nazirah/router';
import hifzTasksRouter from './hifz-tasks/router';
import dawrRouter from './dawr/router';

const app = express();
app.set('trust proxy', 1); // Required behind Render/Heroku/Railway reverse proxies
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required in production');
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-nazirah-secret-change-in-production';
  console.warn('⚠  JWT_SECRET not set — using insecure dev default');
}

// ── Middleware ──────────────────────────────────────────────────
// In dev, allow localhost + any private-network LAN IP so phones/tablets
// can hit the API while testing. In prod, only CLIENT_ORIGIN is allowed.
const isPrivateOrigin = (origin: string): boolean => {
  // Match http://<ip>:<port> where ip is in RFC1918 private ranges or localhost
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
};
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);          // curl / mobile native shells
      if (origin === CLIENT_ORIGIN) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && isPrivateOrigin(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 min (only for OAuth state)
  },
}));

configurePassport();
app.use(passportInstance.initialize());
app.use(passportInstance.session());

// ── Health check ───────────────────────────────────────────────
// Deliberately does NOT touch the database. The host restarts a container that
// fails this, so it must answer the question "is this process serving?" — if it
// reported the database instead, a brief blip at Turso would cycle the app and
// take the whole site down rather than just the queries that needed it.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/classes', classesRouter);
app.use('/api/pages', pagesRouter);
app.use('/api/hifz', hifzRouter);
app.use('/api/nazirah', nazirahRouter);
app.use('/api/hifz-tasks', hifzTasksRouter);
app.use('/api/dawr', dawrRouter);

// ── Page audio (Ayman Suwayd recitations) ──────────────────────
// Served in every environment, and mounted BEFORE the SPA catch-all below:
// otherwise a request for a missing track falls through to index.html and the
// browser receives HTML where it expected audio, which fails silently.
// `fallthrough: false` makes a missing file a real 404 instead.
// __dirname is server/src in dev and server/dist once compiled, so ../public
// resolves to server/public from both.
// Local copies first — that is what development has, and it avoids a round
// trip to the archive when the file is right here.
app.use('/audio', express.static(path.join(__dirname, '../public/audio'), {
  maxAge: '30d',        // the recordings never change
  fallthrough: true,    // not here? fall through to the redirect below
}));

// The 2.47 GB of recordings cannot ship with the deploy, so anything not on
// disk is redirected to the copy hosted on archive.org.
//
// Resolved at RUNTIME rather than baked into the client at build time. The
// build-time route silently produced a bundle still pointing at /audio when
// the variable did not reach the build, which fails invisibly — a redirect
// here works for clients that are already deployed, needs no rebuild, and can
// be repointed by restarting with a different value.
const AUDIO_REMOTE_BASE = (
  process.env.AUDIO_REMOTE_BASE || 'https://archive.org/download/hifz-app-ayman-suwayd-pages'
).replace(/\/$/, '');

app.get('/audio/:file', (req: Request, res: Response): void => {
  // Only ever redirect to NNN.mp3. basename plus this pattern keeps a crafted
  // path from turning the endpoint into an open redirect.
  const file = path.basename(req.params.file);
  if (!/^\d{3}\.mp3$/.test(file)) {
    res.status(404).json({ error: 'Recording not found' });
    return;
  }
  res.redirect(302, `${AUDIO_REMOTE_BASE}/${file}`);
});

// ── Production static serving ──────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  // TypeScript compiles src/ into dist/, so __dirname is
  // <project-root>/server/dist — go up 2 levels to reach project root.
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ── Global error handler ───────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Last line of defence ───────────────────────────────────────
// Anything rejecting outside a request — a background sweep, a stray promise —
// would otherwise take the process down with it, and Node's default really is
// to exit. For a server a class of students depends on, one broken code path
// should cost that one request, not everybody's session. Logged loudly so a
// swallowed fault is still visible rather than silently ignored.
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server kept alive):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (server kept alive):', err);
});

// ── Start ──────────────────────────────────────────────────────
function getLanIPs(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

async function start() {
  // Awaited before listening: the migrations create and reshape every table,
  // so serving requests first would expose a half-built schema. Against a
  // local file this raced invisibly; against a remote database it certainly
  // would.
  try {
    await runMigrations();
  } catch (err) {
    // No point serving with an unusable schema — fail loudly so the host
    // reports a failed deploy rather than a running but broken app.
    console.error('FATAL: database migrations failed');
    console.error(err);
    process.exit(1);
  }

  // Bind to 0.0.0.0 so LAN devices (phone, tablet, laptop) can reach the API.
  app.listen(PORT, '0.0.0.0', () => {
    const lan = getLanIPs();
    console.log('');
    console.log(`✓ Nazirah API server running`);
    console.log(`  • Local:   http://localhost:${PORT}`);
    for (const ip of lan) console.log(`  • Network: http://${ip}:${PORT}`);
    console.log('');
    console.log(`  Client should be reachable at the matching :5173 URLs.`);
    console.log('');
  });
}

start();
