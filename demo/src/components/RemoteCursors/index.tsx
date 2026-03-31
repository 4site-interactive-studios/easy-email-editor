import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBlockNodeByIdx } from 'easy-email-editor';
import { UserPresence } from '@demo/utils/user-identity';
import { MousePosition } from '@demo/hooks/useCollaboration';

interface RemoteCursorsProps {
  remoteCursors: Map<string, string>;
  lockedBlocks: Map<string, UserPresence>;
  remoteMousePositions: Map<string, MousePosition>;
  currentUserId: string;
  roomUsers: UserPresence[];
  showCursors: boolean;
  onToggleCursors: () => void;
  editorContainerRef: React.RefObject<HTMLElement>;
  onMouseMove: (x: number, y: number) => void;
}

// SVG cursor arrow pointing top-left
const CursorArrow = ({ color }: { color: string }) => (
  <svg width='16' height='20' viewBox='0 0 16 20' fill='none' style={{ filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}>
    <path d='M0 0L16 12H8L4 20L0 0Z' fill={color} stroke='#fff' strokeWidth='1' />
  </svg>
);

export function RemoteCursors({
  remoteCursors, lockedBlocks, remoteMousePositions,
  currentUserId, roomUsers, showCursors, onToggleCursors,
  editorContainerRef, onMouseMove,
}: RemoteCursorsProps) {
  const [, setTick] = useState(0);

  // Re-render periodically so block portals stay in sync
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  // Track local mouse position and broadcast
  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      onMouseMove(x, y);
    };

    el.addEventListener('mousemove', handler, { passive: true });
    return () => el.removeEventListener('mousemove', handler);
  }, [editorContainerRef, onMouseMove]);

  const overlays: React.ReactNode[] = [];

  // Block focus outlines
  remoteCursors.forEach((focusIdx, userId) => {
    if (userId === currentUserId) return;
    const user = roomUsers.find(u => u.userId === userId);
    if (!user) return;
    const node = getBlockNodeByIdx(focusIdx);
    if (!node) return;

    overlays.push(
      createPortal(
        <div
          key={`cursor-${userId}`}
          style={{
            position: 'absolute',
            inset: 0,
            outline: `2px solid ${user.color}`,
            outlineOffset: '-2px',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -22,
              left: 0,
              background: user.color,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '3px 3px 0 0',
              whiteSpace: 'nowrap',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              lineHeight: '16px',
            }}
          >
            {user.emoji} {user.name}
          </div>
        </div>,
        node,
      ),
    );
  });

  // Block lock overlays
  lockedBlocks.forEach((user, blockIdx) => {
    if (user.userId === currentUserId) return;
    if (remoteCursors.get(user.userId) === blockIdx) return;
    const node = getBlockNodeByIdx(blockIdx);
    if (!node) return;
    overlays.push(
      createPortal(
        <div
          key={`lock-${blockIdx}`}
          style={{
            position: 'absolute',
            inset: 0,
            background: `${user.color}10`,
            outline: `1px dashed ${user.color}`,
            outlineOffset: '-1px',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />,
        node,
      ),
    );
  });

  // Floating mouse cursors
  const containerRect = editorContainerRef.current?.getBoundingClientRect();

  return (
    <>
      {overlays}

      {/* Floating mouse cursors rendered in the editor container */}
      {showCursors && containerRect && Array.from(remoteMousePositions.entries()).map(([userId, pos]) => {
        if (userId === currentUserId) return null;
        const user = roomUsers.find(u => u.userId === userId);
        if (!user) return null;
        return (
          <div
            key={`mouse-${userId}`}
            style={{
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'left 0.05s linear, top 0.05s linear',
            }}
          >
            <CursorArrow color={user.color} />
            <div
              style={{
                marginLeft: 12,
                marginTop: -2,
                background: user.color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 5px',
                borderRadius: 3,
                whiteSpace: 'nowrap',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {user.emoji} {user.name}
            </div>
          </div>
        );
      })}

      {/* Toggle button — bottom-right corner */}
      {roomUsers.length > 1 && (
        <button
          onClick={onToggleCursors}
          style={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            zIndex: 100,
            background: showCursors ? 'rgba(59,130,246,0.1)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${showCursors ? '#3b82f6' : '#d1d5db'}`,
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            color: showCursors ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
          title={showCursors ? 'Hide remote cursors' : 'Show remote cursors'}
        >
          {showCursors ? '👆 Cursors on' : '👆 Cursors off'}
        </button>
      )}
    </>
  );
}
