import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBlockNodeByIdx } from 'easy-email-editor';
import { UserPresence } from '@demo/utils/user-identity';

interface RemoteCursorsProps {
  remoteCursors: Map<string, string>; // userId → focusIdx
  lockedBlocks: Map<string, UserPresence>; // blockIdx → user
  currentUserId: string;
  roomUsers: UserPresence[];
}

export function RemoteCursors({ remoteCursors, lockedBlocks, currentUserId, roomUsers }: RemoteCursorsProps) {
  const [, setTick] = useState(0);

  // Re-render periodically so portals update when DOM nodes appear/move
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const overlays: React.ReactNode[] = [];

  // Render cursor outlines for remote users
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
          {/* Name badge */}
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

  // Render lock overlays for blocks locked by others
  lockedBlocks.forEach((user, blockIdx) => {
    if (user.userId === currentUserId) return;
    // Skip if already showing a cursor overlay for this block
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

  return <>{overlays}</>;
}
