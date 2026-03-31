import { WebSocketServer } from 'ws';

const PORT = 3100;
const wss = new WebSocketServer({ port: PORT });

// Room state: roomId → Set of { ws, user, locks: Set<blockIdx> }
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

// Code mode consensus tracking per room
const codeModeState = new Map(); // roomId → { proposer, confirmations: Set, rejections: Set, totalNeeded }

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const room = getRoom(msg.roomId);
        const client = { ws, user: msg.user, locks: new Set(), focusIdx: '' };
        room.add(client);
        // Tell the joiner about existing users
        ws.send(JSON.stringify({
          type: 'user-joined',
          user: msg.user,
          users: getUserList(msg.roomId),
        }));
        // Tell others about the new user
        broadcastToRoom(msg.roomId, {
          type: 'user-joined',
          user: msg.user,
          users: getUserList(msg.roomId),
        }, ws);
        // Send existing locks to the new user
        for (const c of room) {
          for (const blockIdx of c.locks) {
            ws.send(JSON.stringify({
              type: 'block-locked',
              userId: c.user.userId,
              blockIdx,
              user: c.user,
            }));
          }
        }
        break;
      }

      case 'leave': {
        handleDisconnect(ws);
        break;
      }

      case 'cursor': {
        const found = findClient(ws);
        if (!found) return;
        found.client.focusIdx = msg.focusIdx;
        broadcastToRoom(found.roomId, {
          type: 'cursor-moved',
          userId: found.client.user.userId,
          focusIdx: msg.focusIdx,
        }, ws);
        break;
      }

      case 'lock': {
        const found = findClient(ws);
        if (!found) return;
        found.client.locks.add(msg.blockIdx);
        broadcastToRoom(found.roomId, {
          type: 'block-locked',
          userId: found.client.user.userId,
          blockIdx: msg.blockIdx,
          user: found.client.user,
        }, ws);
        break;
      }

      case 'unlock': {
        const found = findClient(ws);
        if (!found) return;
        found.client.locks.delete(msg.blockIdx);
        broadcastToRoom(found.roomId, {
          type: 'block-unlocked',
          userId: found.client.user.userId,
          blockIdx: msg.blockIdx,
        }, ws);
        break;
      }

      case 'content-change': {
        const found = findClient(ws);
        if (!found) return;
        broadcastToRoom(found.roomId, {
          type: 'content-updated',
          userId: found.client.user.userId,
          patch: msg.patch,
        }, ws);
        break;
      }

      case 'identity-update': {
        const found = findClient(ws);
        if (!found) return;
        found.client.user = msg.user;
        broadcastToRoom(found.roomId, {
          type: 'user-joined',
          user: msg.user,
          users: getUserList(found.roomId),
        }, ws);
        break;
      }

      case 'code-mode-request': {
        const found = findClient(ws);
        if (!found) return;
        const room = found.room;
        const otherCount = room.size - 1;
        if (otherCount === 0) {
          // Alone — enter immediately
          ws.send(JSON.stringify({ type: 'code-mode-entered' }));
        } else {
          // Need consensus
          codeModeState.set(found.roomId, {
            proposer: found.client.user,
            proposerWs: ws,
            confirmations: new Set(),
            rejections: new Set(),
            totalNeeded: otherCount,
          });
          broadcastToRoom(found.roomId, {
            type: 'code-mode-proposed',
            userId: found.client.user.userId,
            userName: found.client.user.name,
          }, ws);
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
          // All confirmed — everyone enters code mode, release all locks
          for (const c of found.room) {
            c.locks.clear();
          }
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
        // Notify proposer
        if (state.proposerWs.readyState === 1) {
          state.proposerWs.send(JSON.stringify({
            type: 'code-mode-rejected',
            userId: found.client.user.userId,
            userName: found.client.user.name,
          }));
        }
        // Cancel the proposal
        broadcastToAll(found.roomId, { type: 'code-mode-cancelled' });
        codeModeState.delete(found.roomId);
        break;
      }

      case 'code-mode-exit': {
        const found = findClient(ws);
        if (!found) return;
        broadcastToAll(found.roomId, {
          type: 'code-mode-exited',
          content: msg.content,
          userId: found.client.user.userId,
        });
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

  // Release all locks
  for (const blockIdx of client.locks) {
    broadcastToRoom(roomId, {
      type: 'block-unlocked',
      userId: client.user.userId,
      blockIdx,
    }, ws);
  }

  room.delete(client);

  // Notify others
  broadcastToRoom(roomId, {
    type: 'user-left',
    userId: client.user.userId,
    users: getUserList(roomId),
  });

  // Clean up empty rooms
  if (room.size === 0) {
    rooms.delete(roomId);
    codeModeState.delete(roomId);
  }

  // Cancel any pending code mode proposal if proposer left
  const state = codeModeState.get(roomId);
  if (state && state.proposer.userId === client.user.userId) {
    broadcastToAll(roomId, { type: 'code-mode-cancelled' });
    codeModeState.delete(roomId);
  }
}

console.log(`Collaboration server running on ws://localhost:${PORT}`);
