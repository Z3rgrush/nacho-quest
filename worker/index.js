// Nacho Quest leaderboard API — Cloudflare Worker + KV
// GET  /scores        -> top 100 scores, JSON array
// POST /scores        -> { name, score, title, won } -> { ok, position }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (url.pathname === '/scores' && req.method === 'GET') {
      const raw = await env.SCORES.get('leaderboard');
      return new Response(raw || '[]', {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
      });
    }

    if (url.pathname === '/scores' && req.method === 'POST') {
      let body;
      try { body = await req.json(); } catch { return bad('bad json'); }
      const name = String(body.name || '').trim().slice(0, 20);
      const score = Math.floor(Number(body.score));
      const title = String(body.title || '').trim().slice(0, 30);
      const won = !!body.won;
      // sanity bounds: no name, no negative scores, nothing beyond what a run can produce
      if (!name || !Number.isFinite(score) || score < 0 || score > 500) return bad('invalid entry');

      const raw = await env.SCORES.get('leaderboard');
      const board = raw ? JSON.parse(raw) : [];
      const entry = { name, score, title, won, at: Date.now() };
      board.push(entry);
      board.sort((a, b) => b.score - a.score || a.at - b.at);
      const trimmed = board.slice(0, 100);
      await env.SCORES.put('leaderboard', JSON.stringify(trimmed));

      const pos = trimmed.indexOf(entry);
      return new Response(JSON.stringify({ ok: true, position: pos === -1 ? null : pos + 1 }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response('Nacho Quest leaderboard API. GET or POST /scores.', { headers: CORS });
  },
};

function bad(msg) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 400,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
