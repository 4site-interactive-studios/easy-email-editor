import React from 'react';

import { BasicType } from 'easy-email-core';
import { createPortal } from 'react-dom';
import { useBlock, useFocusIdx, useFocusBlockLayout } from 'easy-email-editor';
import { Toolbar } from './Toolbar';

export function FocusTooltip() {
  const { focusBlock } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { focusBlockNode } = useFocusBlockLayout();
  const isPage = focusBlock?.type === BasicType.PAGE;

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
