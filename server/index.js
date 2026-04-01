import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3100;

// ─── SQLite ────────────────────────────────────────────────────────────────────

const db = new Database(join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    article_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    summary TEXT DEFAULT '',
    picture TEXT DEFAULT '',
    content TEXT NOT NULL DEFAULT '{}',
    user_id INTEGER DEFAULT 0,
    category_id INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    secret INTEGER DEFAULT 0,
    readcount INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    subject TEXT DEFAULT '',
    note TEXT DEFAULT '',
    FOREIGN KEY (article_id) REFERENCES templates(article_id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_revisions_article ON revisions(article_id);
`);

// Prepared statements
const stmts = {
  listTemplates: db.prepare('SELECT * FROM templates ORDER BY updated_at DESC'),
  getTemplate: db.prepare('SELECT * FROM templates WHERE article_id = ?'),
  insertTemplate: db.prepare(`
    INSERT INTO templates (article_id, title, summary, picture, content, user_id, category_id, tags, secret, readcount, level, created_at, updated_at)
    VALUES (@article_id, @title, @summary, @picture, @content, @user_id, @category_id, @tags, @secret, @readcount, @level, @created_at, @updated_at)
  `),
  updateTemplate: db.prepare(`
    UPDATE templates SET title=@title, summary=@summary, picture=@picture, content=@content, user_id=@user_id, category_id=@category_id, tags=@tags, secret=@secret, readcount=@readcount, level=@level, updated_at=@updated_at
    WHERE article_id=@article_id
  `),
  deleteTemplate: db.prepare('DELETE FROM templates WHERE article_id = ?'),

  listRevisions: db.prepare('SELECT * FROM revisions WHERE article_id = ? ORDER BY id DESC LIMIT 50'),
  insertRevision: db.prepare('INSERT INTO revisions (article_id, timestamp, label, content, subject, note) VALUES (@article_id, @timestamp, @label, @content, @subject, @note)'),
  updateRevisionNote: db.prepare('UPDATE revisions SET note = ? WHERE id = ?'),
  clearRevisions: db.prepare('DELETE FROM revisions WHERE article_id = ?'),
};

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function toArticle(row) {
  if (!row) return null;
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    content: { article_id: row.article_id, content: row.content },
  };
}

// ─── HTTP server + WebSocket ───────────────────────────────────────────────────

const httpServer = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  try {
    // ── Templates ──
    if (path === '/api/templates' && method === 'GET') {
      const rows = stmts.listTemplates.all();
      return json(res, rows.map(toArticle));
    }

    const templateMatch = path.match(/^\/api\/templates\/(\d+)$/);
    if (templateMatch && method === 'GET') {
      const row = stmts.getTemplate.get(+templateMatch[1]);
      return row ? json(res, toArticle(row)) : json(res, null, 404);
    }

    if (path === '/api/templates' && method === 'POST') {
      const body = await parseBody(req);
      const content = typeof body.content === 'object' && body.content.content
        ? body.content.content
        : typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
      stmts.insertTemplate.run({
        article_id: body.article_id,
        title: body.title || 'Untitled',
        summary: body.summary || '',
        picture: body.picture || '',
        content,
        user_id: body.user_id || 0,
        category_id: body.category_id || 0,
        tags: JSON.stringify(body.tags || []),
        secret: body.secret || 0,
        readcount: body.readcount || 0,
        level: body.level || 0,
        created_at: body.created_at || Math.floor(Date.now() / 1000),
        updated_at: body.updated_at || Math.floor(Date.now() / 1000),
      });
      const saved = stmts.getTemplate.get(body.article_id);
      return json(res, toArticle(saved), 201);
    }

    if (templateMatch && method === 'PUT') {
      const id = +templateMatch[1];
      const body = await parseBody(req);
      const content = typeof body.content === 'object' && body.content.content
        ? body.content.content
        : typeof body.content === 'string' ? body.content : JSON.stringify(body.content);
      const existing = stmts.getTemplate.get(id);
      if (!existing) return json(res, { error: 'Not found' }, 404);
      stmts.updateTemplate.run({
        article_id: id,
        title: body.title ?? existing.title,
        summary: body.summary ?? existing.summary,
        picture: body.picture ?? existing.picture,
        content: content || existing.content,
        user_id: body.user_id ?? existing.user_id,
        category_id: body.category_id ?? existing.category_id,
        tags: body.tags ? JSON.stringify(body.tags) : existing.tags,
        secret: body.secret ?? existing.secret,
        readcount: body.readcount ?? existing.readcount,
        level: body.level ?? existing.level,
        updated_at: body.updated_at || Math.floor(Date.now() / 1000),
      });
      const updated = stmts.getTemplate.get(id);
      return json(res, toArticle(updated));
    }

    if (templateMatch && method === 'DELETE') {
      stmts.deleteTemplate.run(+templateMatch[1]);
      return json(res, { ok: true });
    }

    // ── Revisions ──
    const revisionsMatch = path.match(/^\/api\/templates\/(\d+)\/revisions$/);
    if (revisionsMatch && method === 'GET') {
      const rows = stmts.listRevisions.all(+revisionsMatch[1]);
      return json(res, rows);
    }

    if (revisionsMatch && method === 'POST') {
      const body = await parseBody(req);
      const result = stmts.insertRevision.run({
        article_id: +revisionsMatch[1],
        timestamp: body.timestamp || Math.floor(Date.now() / 1000),
        label: body.label || 'Auto-saved',
        content: body.content || '',
        subject: body.subject || '',
        note: body.note || '',
      });
      return json(res, { id: result.lastInsertRowid, ...body }, 201);
    }

    if (revisionsMatch && method === 'DELETE') {
      stmts.clearRevisions.run(+revisionsMatch[1]);
      return json(res, { ok: true });
    }

    const noteMatch = path.match(/^\/api\/revisions\/(\d+)\/note$/);
    if (noteMatch && method === 'PUT') {
      const body = await parseBody(req);
      stmts.updateRevisionNote.run(body.note || '', +noteMatch[1]);
      return json(res, { ok: true });
    }

    // ── Presence (who's editing which templates) ──
    if (path === '/api/presence' && method === 'GET') {
      const presence = {};
      for (const [roomId, clients] of rooms) {
        const users = Array.from(clients).map(c => c.user);
        if (users.length > 0) {
          presence[roomId] = users;
        }
      }
      return json(res, presence);
    }

    // Not found
    json(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error:', err);
    json(res, { error: err.message }, 500);
  }
});

const wss = new WebSocketServer({ server: httpServer });

// ─── WebSocket collaboration (unchanged logic) ────────────────────────────────

const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function findClient(ws) {
  for (const [roomId, clients] of rooms) {
    for (const client of clients) {
      if (client.ws === ws) return { roomId, client, room: clients };
    }
  }
  return null;
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function broadcastToAll(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const client of room) {
    if (client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

function getUserList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room).map(c => c.user);
}

const codeModeState = new Map();
const roomModes = new Map(); // roomId → 'visual' | 'code'

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'join': {
        const room = getRoom(msg.roomId);
        const client = { ws, user: msg.user, locks: new Set(), focusIdx: '' };
        room.add(client);
        const currentMode = roomModes.get(msg.roomId) || 'visual';
        ws.send(JSON.stringify({ type: 'user-joined', user: msg.user, users: getUserList(msg.roomId), mode: currentMode }));
        broadcastToRoom(msg.roomId, { type: 'user-joined', user: msg.user, users: getUserList(msg.roomId) }, ws);
        // Send existing locks and cursor positions
        for (const c of room) {
          if (c === client) continue;
          for (const blockIdx of c.locks) {
            ws.send(JSON.stringify({ type: 'block-locked', userId: c.user.userId, blockIdx, user: c.user }));
          }
          if (c.focusIdx) {
            ws.send(JSON.stringify({ type: 'cursor-moved', userId: c.user.userId, focusIdx: c.focusIdx }));
          }
        }
        break;
      }
      case 'leave': handleDisconnect(ws); break;
      case 'cursor': {
        const found = findClient(ws);
        if (!found) return;
        found.client.focusIdx = msg.focusIdx;
        broadcastToRoom(found.roomId, { type: 'cursor-moved', userId: found.client.user.userId, focusIdx: msg.focusIdx }, ws);
        break;
      }
      case 'lock': {
        const found = findClient(ws);
        if (!found) return;
        found.client.locks.add(msg.blockIdx);
        broadcastToRoom(found.roomId, { type: 'block-locked', userId: found.client.user.userId, blockIdx: msg.blockIdx, user: found.client.user }, ws);
        break;
      }
      case 'unlock': {
        const found = findClient(ws);
        if (!found) return;
        found.client.locks.delete(msg.blockIdx);
        broadcastToRoom(found.roomId, { type: 'block-unlocked', userId: found.client.user.userId, blockIdx: msg.blockIdx }, ws);
        break;
      }
      case 'mouse-position': {
        const found = findClient(ws);
        if (!found) return;
        broadcastToRoom(found.roomId, { type: 'mouse-moved', userId: found.client.user.userId, x: msg.x, y: msg.y }, ws);
        break;
      }
      case 'text-cursor': {
        const found = findClient(ws);
        if (!found) return;
        broadcastToRoom(found.roomId, { type: 'text-cursor-moved', userId: found.client.user.userId, focusIdx: msg.focusIdx, offset: msg.offset, endOffset: msg.endOffset, nodeIndex: msg.nodeIndex }, ws);
        break;
      }
      case 'content-change': {
        const found = findClient(ws);
        if (!found) return;
        broadcastToRoom(found.roomId, { type: 'content-updated', userId: found.client.user.userId, patch: msg.patch }, ws);
        break;
      }
      case 'identity-update': {
        const found = findClient(ws);
        if (!found) return;
        found.client.user = msg.user;
        broadcastToRoom(found.roomId, { type: 'user-joined', user: msg.user, users: getUserList(found.roomId) }, ws);
        break;
      }
      case 'code-mode-request': {
        const found = findClient(ws);
        if (!found) return;
        const room = found.room;
        const otherCount = room.size - 1;
        if (otherCount === 0) {
          roomModes.set(found.roomId, 'code');
          ws.send(JSON.stringify({ type: 'code-mode-entered' }));
        } else {
          codeModeState.set(found.roomId, { proposer: found.client.user, proposerWs: ws, confirmations: new Set(), totalNeeded: otherCount });
          broadcastToRoom(found.roomId, { type: 'code-mode-proposed', userId: found.client.user.userId, userName: found.client.user.name }, ws);
        }
        break;
      }
      case 'code-mode-confirm': {
        const found = findClient(ws);
        if (!found) return;
        const state = codeModeState.get(found.roomId);
        if (!state) return;
        state.confirmations.add(found.client.user.userId);
        if (state.confirmations.size >= state.totalNeeded) {
          for (const c of found.room) c.locks.clear();
          roomModes.set(found.roomId, 'code');
          broadcastToAll(found.roomId, { type: 'code-mode-entered' });
          codeModeState.delete(found.roomId);
        }
        break;
      }
      case 'code-mode-reject': {
        const found = findClient(ws);
        if (!found) return;
        const state = codeModeState.get(found.roomId);
        if (!state) return;
        if (state.proposerWs.readyState === 1) {
          state.proposerWs.send(JSON.stringify({ type: 'code-mode-rejected', userId: found.client.user.userId, userName: found.client.user.name }));
        }
        broadcastToAll(found.roomId, { type: 'code-mode-cancelled' });
        codeModeState.delete(found.roomId);
        break;
      }
      case 'code-mode-exit': {
        const found = findClient(ws);
        if (!found) return;
        roomModes.set(found.roomId, 'visual');
        broadcastToAll(found.roomId, { type: 'code-mode-exited', content: msg.content, userId: found.client.user.userId });
        break;
      }
    }
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

function handleDisconnect(ws) {
  const found = findClient(ws);
  if (!found) return;
  const { roomId, client, room } = found;
  for (const blockIdx of client.locks) {
    broadcastToRoom(roomId, { type: 'block-unlocked', userId: client.user.userId, blockIdx }, ws);
  }
  room.delete(client);
  broadcastToRoom(roomId, { type: 'user-left', userId: client.user.userId, users: getUserList(roomId) });
  if (room.size === 0) { rooms.delete(roomId); codeModeState.delete(roomId); roomModes.delete(roomId); }
  const state = codeModeState.get(roomId);
  if (state && state.proposer.userId === client.user.userId) {
    broadcastToAll(roomId, { type: 'code-mode-cancelled' });
    codeModeState.delete(roomId);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (REST + WebSocket)`);
});
