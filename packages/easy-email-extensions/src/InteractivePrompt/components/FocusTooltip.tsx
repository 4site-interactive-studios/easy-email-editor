import React, { useCallback, useRef } from 'react';

import { BasicType } from 'easy-email-core';
import { createPortal } from 'react-dom';
import { useBlock, useFocusIdx, useFocusBlockLayout } from 'easy-email-editor';
import { Toolbar } from './Toolbar';

export function FocusTooltip() {
  const { focusBlock, removeBlock, setValueByIdx } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { focusBlockNode } = useFocusBlockLayout();
  const isPage = focusBlock?.type === BasicType.PAGE;
  const isSpacer = focusBlock?.type === BasicType.SPACER;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    removeBlock(focusIdx);
  };

  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const currentHeight = parseInt(focusBlock?.attributes?.height || '20', 10);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = currentHeight;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - dragStartYRef.current;
      const newHeight = Math.max(0, dragStartHeightRef.current + delta);
      if (focusBlock) {
        const updated = { ...focusBlock, attributes: { ...focusBlock.attributes, height: `${newHeight}px` } };
        setValueByIdx(focusIdx, updated);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [focusBlock, focusIdx, setValueByIdx]);

  if (!focusBlockNode || !focusBlock) return null;

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

          {/* Delete button — centered on the right edge */}
          {!isPage && (
            <div
              onClick={handleDelete}
              onMouseDown={e => e.preventDefault()}
              style={{
                position: 'absolute',
                zIndex: 9999,
                right: 0,
                top: '50%',
                transform: 'translate(50%, -50%)',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                height: 24,
                width: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              title='Delete block'
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </div>
          )}

          {/* Spacer resize handle — bottom edge */}
          {isSpacer && (
            <div
              onMouseDown={handleResizeStart}
              style={{
                position: 'absolute',
                zIndex: 9999,
                bottom: 0,
                left: '50%',
                transform: 'translate(-50%, 50%)',
                width: 40,
                height: 8,
                backgroundColor: 'var(--selected-color)',
                borderRadius: 4,
                cursor: 'ns-resize',
                pointerEvents: 'auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title='Drag to resize spacer'
            >
              <div style={{
                width: 16,
                height: 2,
                backgroundColor: 'rgba(255,255,255,0.7)',
                borderRadius: 1,
              }} />
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
