import React from 'react';

import { BasicType } from 'easy-email-core';
import { createPortal } from 'react-dom';
import { useBlock, useFocusIdx, useFocusBlockLayout } from 'easy-email-editor';
import { Toolbar } from './Toolbar';

export function FocusTooltip() {
  const { focusBlock, removeBlock } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { focusBlockNode } = useFocusBlockLayout();
  const isPage = focusBlock?.type === BasicType.PAGE;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    removeBlock(focusIdx);
  };

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
