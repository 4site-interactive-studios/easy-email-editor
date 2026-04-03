import React, { useMemo } from 'react';

import { BasicType, getParentIdx, getSiblingIdx, getParentByIdx } from 'easy-email-core';
import { createPortal } from 'react-dom';
import { useBlock, useFocusIdx, useFocusBlockLayout } from 'easy-email-editor';
import { Toolbar } from './Toolbar';
import { get } from 'lodash';

export function FocusTooltip() {
  const { focusBlock, moveBlock, values } = useBlock();
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { focusBlockNode } = useFocusBlockLayout();
  const isPage = focusBlock?.type === BasicType.PAGE;

  // Determine which move directions are valid
  const moveInfo = useMemo(() => {
    if (!focusIdx || isPage) return { canMoveUp: false, canMoveDown: false, canMoveOut: false };

    const match = focusIdx.match(/^(.+)\.children\.\[(\d+)\]$/);
    if (!match) return { canMoveUp: false, canMoveDown: false, canMoveOut: false };

    const parentIdx = match[1];
    const childIndex = parseInt(match[2], 10);
    const parent = get(values, parentIdx);
    const childCount = parent?.children?.length ?? 0;

    // Can move up if not the first child
    const canMoveUp = childIndex > 0;
    // Can move down if not the last child
    const canMoveDown = childIndex < childCount - 1;
    // Can move out to parent if parent is not the page root
    const canMoveOut = parentIdx !== 'content';

    return { canMoveUp, canMoveDown, canMoveOut, parentIdx };
  }, [focusIdx, values, isPage]);

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    moveBlock(focusIdx, getSiblingIdx(focusIdx, -1));
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    moveBlock(focusIdx, getSiblingIdx(focusIdx, 1));
  };

  const handleMoveOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (moveInfo.parentIdx) {
      setFocusIdx(moveInfo.parentIdx);
    }
  };

  if (!focusBlockNode || !focusBlock) return null;

  const showButtons = !isPage && (moveInfo.canMoveUp || moveInfo.canMoveDown || moveInfo.canMoveOut);

  const btnStyle: React.CSSProperties = {
    backgroundColor: 'var(--selected-color)',
    color: '#ffffff',
    height: 22,
    width: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    pointerEvents: 'auto',
    border: 'none',
    padding: 0,
    fontSize: 14,
    lineHeight: '22px',
  };

  return (
    <>
      {createPortal(
        <div
          id='easy-email-extensions-InteractivePrompt-FocusTooltip'
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            left: 0,
            top: 0,
            zIndex: 1,
          }}
        >
          <style>
            {`
                .email-block {
                  position: relative;
                }
            `}
          </style>

          {/* Move buttons on the right edge */}
          {showButtons && (
            <div
              style={{
                position: 'absolute',
                zIndex: 9999,
                right: -1,
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.preventDefault()}
            >
              {moveInfo.canMoveUp && (
                <div onClick={handleMoveUp} style={btnStyle} title='Move up'>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                  </svg>
                </div>
              )}
              {moveInfo.canMoveOut && (
                <div onClick={handleMoveOut} style={{ ...btnStyle, borderTop: moveInfo.canMoveUp ? '1px solid rgba(255,255,255,0.3)' : undefined, borderBottom: moveInfo.canMoveDown ? '1px solid rgba(255,255,255,0.3)' : undefined }} title='Select parent'>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 4l-5 5 5 5" /><path d="M4 9h10a4 4 0 0 1 4 4v7" />
                  </svg>
                </div>
              )}
              {moveInfo.canMoveDown && (
                <div onClick={handleMoveDown} style={btnStyle} title='Move down'>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" /><path d="M19 12l-7 7-7-7" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* outline */}
          <div
            style={{
              position: 'absolute',
              fontSize: 14,
              zIndex: 2,
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              outlineOffset: '-2px',
              outline: '2px solid var(--selected-color)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              fontSize: 14,
              zIndex: 3,
              left: 0,
              top: 0,
              width: '0%',
              height: '100%',
            }}
          >
            <Toolbar />
          </div>
        </div>,

        focusBlockNode
      )}
    </>
  );
}
