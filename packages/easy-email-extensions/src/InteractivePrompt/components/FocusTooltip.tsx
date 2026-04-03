import React, { useMemo } from 'react';

import { BasicType, BlockManager, getParentIdx, getSiblingIdx } from 'easy-email-core';
import { createPortal } from 'react-dom';
import { useBlock, useFocusIdx, useFocusBlockLayout } from 'easy-email-editor';
import { Toolbar } from './Toolbar';
import { get } from 'lodash';

function getBlockName(block: any): string {
  if (!block) return 'block';
  return BlockManager.getBlockByType(block.type)?.name || block.type || 'block';
}

/** Check if a block type can accept children of `childType` */
function canAcceptChild(containerType: string, childType: string): boolean {
  const childBlock = BlockManager.getBlockByType(childType);
  if (!childBlock) return false;
  return childBlock.validParentType.includes(containerType);
}

// SVG icons as components for clarity
const ArrowUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
  </svg>
);
const ArrowDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M19 12l-7 7-7-7" />
  </svg>
);
const ArrowOut = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17l-5-5 5-5" /><path d="M2 12h14a4 4 0 0 1 4 4v4" />
  </svg>
);
const ArrowIn = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 7l5 5-5 5" /><path d="M22 12H8a4 4 0 0 0-4 4v4" />
  </svg>
);

export function FocusTooltip() {
  const { focusBlock, moveBlock, values, addBlock, removeBlock } = useBlock();
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { focusBlockNode } = useFocusBlockLayout();
  const isPage = focusBlock?.type === BasicType.PAGE;

  // Determine which move directions are valid and generate tooltip labels
  const moveInfo = useMemo(() => {
    const none = {
      canMoveUp: false, canMoveDown: false, canMoveOut: false, canMoveIn: false,
      upLabel: '', downLabel: '', outLabel: '', inLabel: '',
      parentIdx: '', moveInTarget: null as { idx: string; position: 'first' | 'last' } | null,
    };
    if (!focusIdx || isPage) return none;

    const match = focusIdx.match(/^(.+)\.children\.\[(\d+)\]$/);
    if (!match) return none;

    const parentIdx = match[1];
    const childIndex = parseInt(match[2], 10);
    const parent = get(values, parentIdx);
    const childCount = parent?.children?.length ?? 0;
    const parentName = getBlockName(parent);
    const blockType = focusBlock?.type || '';

    // Can move up if not the first child
    const canMoveUp = childIndex > 0;
    const prevSibling = canMoveUp ? parent?.children?.[childIndex - 1] : null;
    const prevSiblingName = getBlockName(prevSibling);

    // Can move down if not the last child
    const canMoveDown = childIndex < childCount - 1;
    const nextSibling = canMoveDown ? parent?.children?.[childIndex + 1] : null;
    const nextSiblingName = getBlockName(nextSibling);

    // Can move out to parent's parent if parent is not the page root
    const canMoveOut = parentIdx !== 'content';
    const grandparentIdx = canMoveOut ? getParentIdx(parentIdx) : null;
    const grandparent = grandparentIdx ? get(values, grandparentIdx) : null;
    const grandparentName = getBlockName(grandparent);

    // Can move into an adjacent sibling that can accept this block type
    let canMoveIn = false;
    let moveInTarget: { idx: string; position: 'first' | 'last' } | null = null;
    let inLabel = '';

    // Check if next sibling can accept this block
    if (nextSibling && canAcceptChild(nextSibling.type, blockType)) {
      canMoveIn = true;
      moveInTarget = { idx: `${parentIdx}.children.[${childIndex + 1}]`, position: 'first' };
      inLabel = `Move into the ${nextSiblingName}`;
    }
    // Otherwise check if previous sibling can accept this block
    else if (prevSibling && canAcceptChild(prevSibling.type, blockType)) {
      canMoveIn = true;
      moveInTarget = { idx: `${parentIdx}.children.[${childIndex - 1}]`, position: 'last' };
      inLabel = `Move into the ${prevSiblingName}`;
    }

    return {
      canMoveUp,
      canMoveDown,
      canMoveOut,
      canMoveIn,
      upLabel: canMoveUp ? `Move before the ${prevSiblingName}` : '',
      downLabel: canMoveDown ? `Move after the ${nextSiblingName}` : '',
      outLabel: canMoveOut ? `Move out of the ${parentName}` : '',
      inLabel,
      parentIdx,
      moveInTarget,
    };
  }, [focusIdx, values, isPage, focusBlock]);

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
    if (!moveInfo.parentIdx || !focusBlock) return;
    // Move this block to just after the parent in the grandparent's children
    const grandparentIdx = getParentIdx(moveInfo.parentIdx);
    if (!grandparentIdx) return;
    const parentMatch = moveInfo.parentIdx.match(/\.children\.\[(\d+)\]$/);
    if (!parentMatch) return;
    const parentChildIndex = parseInt(parentMatch[1], 10);
    const targetIdx = `${grandparentIdx}.children.[${parentChildIndex + 1}]`;
    moveBlock(focusIdx, targetIdx);
  };

  const handleMoveIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!moveInfo.moveInTarget || !focusBlock) return;

    const targetContainerIdx = moveInfo.moveInTarget.idx;
    const targetContainer = get(values, targetContainerIdx);
    if (!targetContainer) return;

    const targetChildCount = targetContainer.children?.length ?? 0;
    const positionIndex = moveInfo.moveInTarget.position === 'first' ? 0 : targetChildCount;

    // Save block data, remove from current position, add to new position
    const blockData = JSON.parse(JSON.stringify(focusBlock));
    removeBlock(focusIdx);

    // After removal, indices may shift. Re-resolve target.
    // Use addBlock to insert the saved block data
    setTimeout(() => {
      // The targetContainerIdx may have shifted after removal if the block was before it.
      // For simplicity, use addBlock which handles this correctly
      addBlock({
        type: blockData.type,
        parentIdx: targetContainerIdx,
        positionIndex,
        payload: blockData,
      });
    }, 0);
  };

  if (!focusBlockNode || !focusBlock) return null;

  const hasButtons = !isPage && (moveInfo.canMoveOut || moveInfo.canMoveIn);

  const btnBase: React.CSSProperties = {
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
    position: 'relative',
  };

  const dividerStyle = '1px solid rgba(255,255,255,0.3)';

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
              .ee-move-btn:hover .ee-move-tooltip {
                opacity: 1 !important;
                pointer-events: auto !important;
              }
            `}
          </style>

          {/* Move buttons on the right edge */}
          {hasButtons && (
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
                overflow: 'visible',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.preventDefault()}
            >
              {moveInfo.canMoveOut && (
                <MoveButton
                  style={btnBase}
                  icon={<ArrowOut />}
                  label={moveInfo.outLabel}
                  onClick={handleMoveOut}
                />
              )}
              {moveInfo.canMoveIn && (
                <MoveButton
                  style={{ ...btnBase, borderTop: moveInfo.canMoveOut ? dividerStyle : undefined }}
                  icon={<ArrowIn />}
                  label={moveInfo.inLabel}
                  onClick={handleMoveIn}
                />
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

/** A single move button with a tooltip that appears on hover */
function MoveButton({ style, icon, label, onClick }: {
  style: React.CSSProperties;
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div className='ee-move-btn' onClick={onClick} style={style}>
      {icon}
      <div
        className='ee-move-tooltip'
        style={{
          position: 'absolute',
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: 6,
          background: '#1f2937',
          color: '#fff',
          fontSize: 11,
          fontWeight: 500,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '3px 8px',
          borderRadius: 4,
          whiteSpace: 'nowrap',
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.15s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          lineHeight: '16px',
        }}
      >
        {label}
      </div>
    </div>
  );
}
