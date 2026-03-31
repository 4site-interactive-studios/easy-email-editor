import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserIdentity, updateUserIdentity, UserPresence } from '@demo/utils/user-identity';

export interface ContentPatch {
  path: string;
  value: any;
  timestamp: number;
}

export interface CollaborationState {
  connected: boolean;
  roomUsers: UserPresence[];
  currentUser: UserPresence;
  lockedBlocks: Map<string, UserPresence>;
  remoteCursors: Map<string, string>; // userId → focusIdx
  codeModeProposal: { userId: string; userName: string } | null;
}

export interface CollaborationActions {
  sendCursor: (focusIdx: string) => void;
  lockBlock: (blockIdx: string) => void;
  unlockBlock: (blockIdx: string) => void;
  sendContentChange: (patch: ContentPatch) => void;
  proposeCodeMode: () => void;
  confirmCodeMode: () => void;
  rejectCodeMode: () => void;
  exitCodeMode: (content: string) => void;
  updateIdentity: (animal: string, colorHex: string) => void;
}

type MessageHandler = (msg: any) => void;

export function useCollaboration(
  roomId: string | null,
  onContentUpdate?: (patch: ContentPatch, userId: string) => void,
  onCodeModeEntered?: () => void,
  onCodeModeExited?: (content: string, userId: string) => void,
): CollaborationState & CollaborationActions {
  const [connected, setConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState<UserPresence[]>([]);
  const [currentUser, setCurrentUser] = useState<UserPresence>(getUserIdentity);
  const [lockedBlocks, setLockedBlocks] = useState<Map<string, UserPresence>>(new Map());
  const [remoteCursors, setRemoteCursors] = useState<Map<string, string>>(new Map());
  const [codeModeProposal, setCodeModeProposal] = useState<{ userId: string; userName: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    if (!roomId) return;

    const user = getUserIdentity();
    setCurrentUser(user);

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: 'join', roomId, user }));
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect after 2s
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onmessage = (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        switch (msg.type) {
          case 'user-joined':
            setRoomUsers(msg.users);
            break;

          case 'user-left':
            setRoomUsers(msg.users);
            setRemoteCursors(prev => {
              const next = new Map(prev);
              next.delete(msg.userId);
              return next;
            });
            setLockedBlocks(prev => {
              const next = new Map(prev);
              for (const [blockIdx, u] of next) {
                if (u.userId === msg.userId) next.delete(blockIdx);
              }
              return next;
            });
            break;

          case 'cursor-moved':
            setRemoteCursors(prev => {
              const next = new Map(prev);
              if (msg.focusIdx) {
                next.set(msg.userId, msg.focusIdx);
              } else {
                next.delete(msg.userId);
              }
              return next;
            });
            break;

          case 'block-locked':
            setLockedBlocks(prev => {
              const next = new Map(prev);
              next.set(msg.blockIdx, msg.user);
              return next;
            });
            break;

          case 'block-unlocked':
            setLockedBlocks(prev => {
              const next = new Map(prev);
              next.delete(msg.blockIdx);
              return next;
            });
            break;

          case 'content-updated':
            onContentUpdate?.(msg.patch, msg.userId);
            break;

          case 'code-mode-proposed':
            setCodeModeProposal({ userId: msg.userId, userName: msg.userName });
            break;

          case 'code-mode-entered':
            setCodeModeProposal(null);
            setLockedBlocks(new Map());
            onCodeModeEntered?.();
            break;

          case 'code-mode-rejected':
            setCodeModeProposal(null);
            break;

          case 'code-mode-cancelled':
            setCodeModeProposal(null);
            break;

          case 'code-mode-exited':
            onCodeModeExited?.(msg.content, msg.userId);
            break;
        }
      };
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      setRoomUsers([]);
      setLockedBlocks(new Map());
      setRemoteCursors(new Map());
    };
  }, [roomId]);

  const sendCursor = useCallback((focusIdx: string) => {
    send({ type: 'cursor', focusIdx });
  }, [send]);

  const lockBlock = useCallback((blockIdx: string) => {
    send({ type: 'lock', blockIdx });
  }, [send]);

  const unlockBlock = useCallback((blockIdx: string) => {
    send({ type: 'unlock', blockIdx });
  }, [send]);

  const sendContentChange = useCallback((patch: ContentPatch) => {
    send({ type: 'content-change', patch });
  }, [send]);

  const proposeCodeMode = useCallback(() => {
    send({ type: 'code-mode-request' });
  }, [send]);

  const confirmCodeMode = useCallback(() => {
    send({ type: 'code-mode-confirm' });
  }, [send]);

  const rejectCodeMode = useCallback(() => {
    send({ type: 'code-mode-reject' });
  }, [send]);

  const exitCodeModeAction = useCallback((content: string) => {
    send({ type: 'code-mode-exit', content });
  }, [send]);

  const updateIdentityAction = useCallback((animal: string, colorHex: string) => {
    const updated = updateUserIdentity(animal, colorHex);
    setCurrentUser(updated);
    send({ type: 'identity-update', user: updated });
  }, [send]);

  return {
    connected,
    roomUsers,
    currentUser,
    lockedBlocks,
    remoteCursors,
    codeModeProposal,
    sendCursor,
    lockBlock,
    unlockBlock,
    sendContentChange,
    proposeCodeMode,
    confirmCodeMode,
    rejectCodeMode,
    exitCodeMode: exitCodeModeAction,
    updateIdentity: updateIdentityAction,
  };
}
