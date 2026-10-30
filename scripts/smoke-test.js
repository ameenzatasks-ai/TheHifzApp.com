/**
 * Smoke test: exercises every endpoint and reports which fail.
 *
 *   node scripts/smoke-test.js http://127.0.0.1:3001
 *   node scripts/smoke-test.js https://thehifzapp-com.onrender.com
 *
 * Exists because the compiler cannot see this application's characteristic
 * failure: an un-awaited database call. The rejected promise is unhandled,
 * Node kills the process, and the endpoint answers 502 — so the only way to
 * know the routes work is to call them.
 *
 * The authorisation checks matter most. They must DENY, not merely respond:
 * the guard once returned a promise, which is always truthy, so every check
 * passed for everyone.
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3001';

async function call(session, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session.cookie ? { Cookie: session.cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get('set-cookie');
  if (sc) session.cookie = sc.split(';')[0];
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

const uniq = () => Math.random().toString(36).slice(2, 7);
const today = new Date().toISOString().slice(0, 10);
const failures = [];

function record(name, ok, detail) {
  if (!ok) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

/** Any 5xx is a failure: it means the process threw or died. */
async function hit(name, session, method, path, body, expect) {
  const r = await call(session, method, path, body);
  const ok = expect ? r.status === expect : r.status < 500;
  record(name, ok, `${r.status}${expect && r.status !== expect ? ` (expected ${expect})` : ''}`);
  return r;
}

(async () => {
  console.log(`target: ${BASE}\n--- student ---`);
  const s = {};
  const reg = await call(s, 'POST', '/api/auth/register',
    { name: 'Smoke Student', username: 'ss' + uniq(), password: 'password123' });
  record('register', reg.status === 201, String(reg.status));
  const role = await call(s, 'PATCH', '/api/auth/role', { role: 'student' });
  record('set role returns the role', role.body?.user?.role === 'student', JSON.stringify(role.body?.user?.role));
  const studentId = reg.body?.user?.id;

  await hit('own pages', s, 'GET', '/api/pages');
  await hit('hifz pages', s, 'GET', '/api/hifz/pages');
  await hit('summary', s, 'GET', '/api/hifz/summary');
  await hit('juz grid', s, 'GET', '/api/hifz/juz/1');
  await hit('audit', s, 'GET', '/api/hifz/audit');
  const put = await hit('mark page', s, 'PUT', '/api/hifz/page/42', { status: 'GREEN' });
  record('mark page returns status', put.body?.status === 'GREEN', JSON.stringify(put.body));
  await hit('listen-mark page', s, 'PUT', '/api/pages/5');
  await hit('unlisten page', s, 'DELETE', '/api/pages/5');
  await hit('submit task', s, 'POST', '/api/hifz-tasks/', {
    date: today, tasks: [{ taskType: 'sabaq', sabaqSurah: 1, sabaqVerse: 5 }],
  });
  await hit('tasks list', s, 'GET', '/api/hifz-tasks/');
  await hit('my scores', s, 'GET', '/api/hifz-tasks/my-scores');
  await hit('dawr grid', s, 'GET', '/api/dawr/');
  await hit('nazirah preview', s, 'GET', `/api/nazirah/log/preview?date=${today}`);
  await hit('nazirah save', s, 'POST', '/api/nazirah/log', { logDate: today });
  await hit('nazirah logs', s, 'GET', '/api/nazirah/logs');

  console.log('--- ustadh ---');
  const t = {};
  await call(t, 'POST', '/api/auth/register',
    { name: 'Smoke Ustadh', username: 'su' + uniq(), password: 'password123' });
  await call(t, 'PATCH', '/api/auth/role', { role: 'ustadh' });

  const made = await hit('create class', t, 'POST', '/api/classes', { name: 'Smoke Class' }, 201);
  const classId = made.body?.id;
  record('class has a join code', !!made.body?.join_code, made.body?.join_code ?? '');
  if (made.body?.join_code) await hit('student joins', s, 'POST', '/api/classes/join', { joinCode: made.body.join_code }, 201);

  if (classId) {
    await hit('class detail', t, 'GET', `/api/classes/${classId}`);
    await hit('students', t, 'GET', `/api/classes/${classId}/students`);
    const roster = await hit('roster + counts', t, 'GET', `/api/classes/${classId}/students-with-summary`);
    const first = Array.isArray(roster.body) ? roster.body[0] : null;
    record('roster counts are real numbers',
           !first || typeof first?.counts?.GREEN === 'number', JSON.stringify(first?.counts));
    await hit('rename class', t, 'PATCH', `/api/classes/${classId}`, { name: 'Renamed' });
    if (studentId) {
      await hit('student pages (class)', t, 'GET', `/api/classes/${classId}/students/${studentId}/pages`);
      await hit('student summary (class)', t, 'GET', `/api/classes/${classId}/students/${studentId}/summary`);
    }
  }

  if (studentId) {
    await hit('student hifz pages', t, 'GET', `/api/hifz/pages/student/${studentId}`);
    await hit('student summary', t, 'GET', `/api/hifz/summary/student/${studentId}`);
    await hit('student juz', t, 'GET', `/api/hifz/juz/1/student/${studentId}`);
    await hit('student audit', t, 'GET', `/api/hifz/audit/student/${studentId}`);
    await hit('set student page', t, 'PUT', `/api/hifz/page/9/student/${studentId}`, { status: 'AMBER' });
    await hit('student tasks', t, 'GET', `/api/hifz-tasks/student/${studentId}`);
    await hit('student scores', t, 'GET', `/api/hifz-tasks/student/${studentId}/scores`);
    await hit('score student', t, 'PATCH', `/api/hifz-tasks/student/${studentId}/score`,
      { taskDate: today, spScore: 5, sabaqScore: 5, tajwidScore: 5, adabScore: 5 });
    await hit('student dawr', t, 'GET', `/api/dawr/student/${studentId}`);
    await hit('student nazirah logs', t, 'GET', `/api/nazirah/logs/student/${studentId}`);
  }

  // ── The guard must DENY an unrelated ustadh, not merely respond ──
  console.log('--- authorisation (must be 403) ---');
  const x = {};
  await call(x, 'POST', '/api/auth/register',
    { name: 'Outsider', username: 'ox' + uniq(), password: 'password123' });
  await call(x, 'PATCH', '/api/auth/role', { role: 'ustadh' });
  if (studentId) {
    await hit('outsider denied pages',   x, 'GET', `/api/hifz/pages/student/${studentId}`, null, 403);
    await hit('outsider denied summary', x, 'GET', `/api/hifz/summary/student/${studentId}`, null, 403);
    await hit('outsider denied audit',   x, 'GET', `/api/hifz/audit/student/${studentId}`, null, 403);
    await hit('outsider denied write',   x, 'PUT', `/api/hifz/page/7/student/${studentId}`, { status: 'GOLD' }, 403);
    await hit('outsider denied tasks',   x, 'GET', `/api/hifz-tasks/student/${studentId}`, null, 403);
    await hit('outsider denied dawr',    x, 'GET', `/api/dawr/student/${studentId}`, null, 403);
  }
  if (classId) await hit('outsider denied class', x, 'GET', `/api/classes/${classId}`, null, 404);

  if (classId) await hit('delete class', t, 'DELETE', `/api/classes/${classId}`);

  console.log('');
  if (failures.length) {
    console.log(`${failures.length} FAILURE(S):`);
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('All checks passed.');
})().catch(e => { console.error('harness error:', e.message); process.exit(1); });
