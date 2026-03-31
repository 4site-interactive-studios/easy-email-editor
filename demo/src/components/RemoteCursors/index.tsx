import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getBlockNodeByIdx } from 'easy-email-editor';
import { UserPresence } from '@demo/utils/user-identity';
import { MousePosition, TextCursorPosition } from '@demo/hooks/useCollaboration';

interface RemoteCursorsProps {
  remoteCursors: Map<string, string>;
  lockedBlocks: Map<string, UserPresence>;
  remoteMousePositions: Map<string, MousePosition>;
  remoteTextCursors: Map<string, TextCursorPosition>;
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
  remoteCursors, lockedBlocks, remoteMousePositions, remoteTextCursors,
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

  // Inject text cursor carets into shadow DOM contenteditable elements
  useEffect(() => {
    if (!showCursors) return;
    const editorRoot = document.getElementById('VisualEditorEditMode');
    const shadowRoot = editorRoot?.shadowRoot;
    if (!shadowRoot) return;

    // Clean up old caret markers
    shadowRoot.querySelectorAll('.remote-text-caret').forEach(el => el.remove());

    remoteTextCursors.forEach((pos, userId) => {
      if (userId === currentUserId) return;
      const user = roomUsers.find(u => u.userId === userId);
      if (!user) return;

      // Find the contenteditable element by its idx attribute
      const el = shadowRoot.querySelector(`[data-content_editable-idx="${pos.focusIdx}"]`) as HTMLElement;
      if (!el) return;

      // Walk text nodes to find the correct position
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      let remaining = pos.offset;
      let targetNode: Text | null = null;

      while (walker.nextNode()) {
        const textNode = walker.currentNode as Text;
        if (remaining <= textNode.length) {
          targetNode = textNode;
          break;
        }
        remaining -= textNode.length;
      }

      if (!targetNode) return;

      // Create a caret marker element
      const caret = document.createElement('span');
      caret.className = 'remote-text-caret';
      caret.style.cssText = `
        display: inline-block;
        width: 2px;
        height: 1.1em;
        background: ${user.color};
        margin: 0 -1px;
        position: relative;
        vertical-align: text-bottom;
        pointer-events: none;
        animation: blink 1s step-end infinite;
      `;
      // Name flag
      const flag = document.createElement('span');
      flag.style.cssText = `
        position: absolute;
        bottom: 100%;
        left: -1px;
        background: ${user.color};
        color: #fff;
        font-size: 9px;
        font-weight: 600;
        padding: 1px 4px;
        border-radius: 2px 2px 2px 0;
        white-space: nowrap;
        line-height: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      flag.textContent = `${user.emoji} ${user.name}`;
      caret.appendChild(flag);

      // Split the text node and insert the caret
      try {
        const afterNode = targetNode.splitText(remaining);
        targetNode.parentNode?.insertBefore(caret, afterNode);
      } catch {
        // If offset is out of bounds, append at end
        el.appendChild(caret);
      }
    });

    // Add blink animation if not already present
    if (!shadowRoot.querySelector('#remote-caret-styles')) {
      const style = document.createElement('style');
      style.id = 'remote-caret-styles';
      style.textContent = `@keyframes blink { 50% { opacity: 0; } }`;
      shadowRoot.appendChild(style);
    }

    return () => {
      shadowRoot.querySelectorAll('.remote-text-caret').forEach(el => el.remove());
    };
  }, [remoteTextCursors, currentUserId, roomUsers, showCursors]);

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
