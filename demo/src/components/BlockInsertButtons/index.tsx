import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Copy, Type, Image, Square, Minus, ArrowDownUp, Columns, LayoutTemplate, ChevronRight, ChevronUp, ChevronDown, Table2, ListCollapse, Navigation, Share2, Code, Box } from 'lucide-react';
import { BlockManager, BasicType, getSiblingIdx, isCommentBlock } from 'easy-email-core';
import { useBlock, useFocusIdx, getBlockNodeByIdx } from 'easy-email-editor';
import { get } from 'lodash';

/**
 * Get the sibling index that skips over comment-only raw blocks.
 * If the immediate sibling is a comment, jump one more position.
 */
function getSkipCommentSiblingIdx(focusIdx: string, direction: -1 | 1, values: any): string {
  let offset = direction;
  const targetIdx = getSiblingIdx(focusIdx, offset);
  const targetBlock = get(values, targetIdx);
  // If target is a comment block, skip one more
  if (targetBlock && isCommentBlock(targetBlock)) {
    offset += direction;
  }
  return getSiblingIdx(focusIdx, offset);
}

// ── Block icon mapping ────────────────────────────────────────────────────────

const BLOCK_ICONS: Record<string, React.ReactNode> = {
  [BasicType.TEXT]: <Type size={16} />,
  [BasicType.IMAGE]: <Image size={16} />,
  [BasicType.BUTTON]: <Square size={16} />,
  [BasicType.DIVIDER]: <Minus size={16} />,
  [BasicType.SPACER]: <ArrowDownUp size={16} />,
  [BasicType.SECTION]: <Columns size={16} />,
  [BasicType.WRAPPER]: <LayoutTemplate size={16} />,
  [BasicType.COLUMN]: <ChevronRight size={16} />,
  [BasicType.GROUP]: <Columns size={16} />,
  [BasicType.HERO]: <Box size={16} />,
  [BasicType.CAROUSEL]: <Image size={16} />,
  [BasicType.NAVBAR]: <Navigation size={16} />,
  [BasicType.SOCIAL]: <Share2 size={16} />,
  [BasicType.TABLE]: <Table2 size={16} />,
  [BasicType.ACCORDION]: <ListCollapse size={16} />,
  [BasicType.RAW]: <Code size={16} />,
};

const HIDDEN_BLOCK_TYPES = new Set([
  BasicType.PAGE, BasicType.TEMPLATE,
  BasicType.ACCORDION_ELEMENT, BasicType.ACCORDION_TITLE, BasicType.ACCORDION_TEXT,
]);

const BLOCK_NAMES: Record<string, string> = {
  [BasicType.TEXT]: 'Text', [BasicType.IMAGE]: 'Image', [BasicType.BUTTON]: 'Button',
  [BasicType.DIVIDER]: 'Divider', [BasicType.SPACER]: 'Spacer', [BasicType.SECTION]: 'Section',
  [BasicType.WRAPPER]: 'Wrapper', [BasicType.COLUMN]: 'Column', [BasicType.GROUP]: 'Group',
  [BasicType.HERO]: 'Hero', [BasicType.CAROUSEL]: 'Carousel', [BasicType.NAVBAR]: 'Navbar',
  [BasicType.SOCIAL]: 'Social', [BasicType.TABLE]: 'Table', [BasicType.ACCORDION]: 'Accordion',
  [BasicType.RAW]: 'Raw HTML',
};

function getBlockName(block: any): string {
  if (!block) return 'block';
  return BlockManager.getBlockByType(block.type)?.name || block.type || 'block';
}

interface BlockInsertButtonsProps {
  containerRef: React.RefObject<HTMLElement>;
}

export function BlockInsertButtons({ containerRef }: BlockInsertButtonsProps) {
  const { focusIdx } = useFocusIdx();
  const { addBlock, moveBlock, copyBlock, values } = useBlock();
  const [popup, setPopup] = useState<'above' | 'below' | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Track which pill was last hovered so it renders on top when they overlap
  const [topPill, setTopPill] = useState<'top' | 'bottom'>('bottom');

  // Get the parent block info
  const parentInfo = useMemo(() => {
    if (!focusIdx || focusIdx === 'content') return null;
    const match = focusIdx.match(/^(.+)\.children\.\[(\d+)\]$/);
    if (!match) return null;

    const parentIdx = match[1];
    const childIndex = parseInt(match[2], 10);
    const parentBlock = get(values, parentIdx);
    const childCount = parentBlock?.children?.length ?? 0;

    const prevSibling = childIndex > 0 ? parentBlock?.children?.[childIndex - 1] : null;
    const nextSibling = childIndex < childCount - 1 ? parentBlock?.children?.[childIndex + 1] : null;

    return {
      parentIdx,
      childIndex,
      childCount,
      parentType: parentBlock?.type as string | undefined,
      canMoveUp: childIndex > 0,
      canMoveDown: childIndex < childCount - 1,
      upLabel: prevSibling ? `Move before the ${getBlockName(prevSibling)}` : '',
      downLabel: nextSibling ? `Move after the ${getBlockName(nextSibling)}` : '',
    };
  }, [focusIdx, values]);

  // Valid block types for insertion
  const validBlocks = useMemo(() => {
    if (!parentInfo?.parentType) return [];
    return BlockManager.getBlocks()
      .filter(block => {
        if (HIDDEN_BLOCK_TYPES.has(block.type as BasicType)) return false;
        return block.validParentType.includes(parentInfo.parentType!);
      })
      .sort((a, b) => (BLOCK_NAMES[a.type] || a.name || a.type).localeCompare(BLOCK_NAMES[b.type] || b.name || b.type));
  }, [parentInfo?.parentType]);

  // Track the focused block's DOM rect
  useEffect(() => {
    if (!focusIdx || focusIdx === 'content' || !containerRef.current) { setRect(null); return; }
    const updateRect = () => {
      const container = containerRef.current;
      if (!container) return;
      const el = getBlockNodeByIdx(focusIdx);
      if (!el) { setRect(null); return; }
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setRect({ top: elRect.top - containerRect.top, left: elRect.left - containerRect.left, width: elRect.width, height: elRect.height });
    };
    const timer = setTimeout(updateRect, 100);
    const interval = setInterval(updateRect, 200);
    const editorRoot = document.getElementById('VisualEditorEditMode');
    const scrollContainer = editorRoot?.shadowRoot?.querySelector('.shadow-container') || editorRoot?.shadowRoot;
    const onScroll = () => updateRect();
    if (scrollContainer) scrollContainer.addEventListener('scroll', onScroll, true);
    return () => { clearTimeout(timer); clearInterval(interval); if (scrollContainer) scrollContainer.removeEventListener('scroll', onScroll, true); };
  }, [focusIdx, containerRef]);

  // Close popup on click outside
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e: MouseEvent) => { if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null); };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [popup]);

  useEffect(() => { setPopup(null); }, [focusIdx]);

  const handleInsert = useCallback((blockType: string, position: 'above' | 'below') => {
    if (!parentInfo) return;
    addBlock({ type: blockType, parentIdx: parentInfo.parentIdx, positionIndex: position === 'above' ? parentInfo.childIndex : parentInfo.childIndex + 1 });
    setPopup(null);
  }, [parentInfo, addBlock]);

  const handleDuplicate = useCallback(() => {
    copyBlock(focusIdx);
    setPopup(null);
  }, [focusIdx, copyBlock]);

  const handleMoveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // If this block has a preceding comment, move the comment first
    const prevIdx = getSiblingIdx(focusIdx, -1);
    const prevBlock = get(values, prevIdx);
    if (prevBlock && isCommentBlock(prevBlock)) {
      // Move comment to before where the block will land
      const targetIdx = getSkipCommentSiblingIdx(focusIdx, -1, values);
      moveBlock(prevIdx, targetIdx); // comment goes first
      // After comment moved, our block shifted — move it too
      setTimeout(() => moveBlock(focusIdx, getSiblingIdx(focusIdx, -1)), 0);
    } else {
      moveBlock(focusIdx, getSkipCommentSiblingIdx(focusIdx, -1, values));
    }
  }, [focusIdx, moveBlock, values]);

  const handleMoveDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // If this block has a preceding comment, move both together
    const prevIdx = getSiblingIdx(focusIdx, -1);
    const prevBlock = get(values, prevIdx);
    if (prevBlock && isCommentBlock(prevBlock)) {
      // Move the block first, then the comment follows
      const targetIdx = getSkipCommentSiblingIdx(focusIdx, 1, values);
      moveBlock(focusIdx, targetIdx);
      // After block moved, move the comment to just before block's new position
      setTimeout(() => {
        // The comment is now at prevIdx, the block moved to targetIdx
        // We need to move the comment to just before the block
        moveBlock(prevIdx, getSiblingIdx(prevIdx, 1));
      }, 0);
    } else {
      moveBlock(focusIdx, getSkipCommentSiblingIdx(focusIdx, 1, values));
    }
  }, [focusIdx, moveBlock, values]);

  if (!rect || !parentInfo || validBlocks.length === 0 || !containerRef.current) return null;

  const centerX = rect.left + rect.width / 2;

  // ── Pill styles ──
  const pillStyle: React.CSSProperties = {
    position: 'absolute',
    transform: 'translateX(-50%)',
    display: 'flex',
    zIndex: 15,
    pointerEvents: 'auto',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.8)',
    height: 24,
  };

  const segmentBase: React.CSSProperties = {
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    padding: '0 6px',
    fontSize: 12,
    lineHeight: '24px',
  };

  const moveSegment: React.CSSProperties = {
    ...segmentBase,
    background: 'var(--selected-color, #1890ff)',
    color: '#fff',
    minWidth: 24,
  };

  const plusSegment: React.CSSProperties = {
    ...segmentBase,
    background: '#4f46e5',
    color: '#fff',
    minWidth: 24,
  };

  const divider: React.CSSProperties = {
    width: 1,
    background: 'rgba(255,255,255,0.3)',
    alignSelf: 'stretch',
  };

  return createPortal(
    <>
      {/* ── Top pill: [+ Insert] | [⧉ Copy] | [↰ Up & Out] | [↑ Move Up] ── */}
      <div
        style={{ ...pillStyle, top: rect.top - 12, left: centerX, zIndex: topPill === 'top' ? 16 : 15 }}
        onMouseEnter={() => setTopPill('top')}
      >
        <button
          style={plusSegment}
          onClick={e => { e.stopPropagation(); setPopup(popup === 'above' ? null : 'above'); }}
          title='Insert block above'
        >
          <Plus size={14} strokeWidth={3} />
        </button>
        <div style={divider} />
        <button
          style={{ ...moveSegment, background: '#6366f1' }}
          onClick={e => { e.stopPropagation(); handleDuplicate(); }}
          title='Duplicate this block'
        >
          <Copy size={13} strokeWidth={2.5} />
        </button>
        {parentInfo.canMoveUp && (
          <>
            <div style={divider} />
            <button style={moveSegment} onClick={handleMoveUp} title={parentInfo.upLabel}>
              <ChevronUp size={14} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* ── Bottom pill: [+ Insert] | [⧉ Copy] | [↳ Down & Out] | [↓ Move Down] ── */}
      <div
        style={{ ...pillStyle, top: rect.top + rect.height - 12, left: centerX, zIndex: topPill === 'bottom' ? 16 : 15 }}
        onMouseEnter={() => setTopPill('bottom')}
      >
        <button
          style={plusSegment}
          onClick={e => { e.stopPropagation(); setPopup(popup === 'below' ? null : 'below'); }}
          title='Insert block below'
        >
          <Plus size={14} strokeWidth={3} />
        </button>
        <div style={divider} />
        <button
          style={{ ...moveSegment, background: '#6366f1' }}
          onClick={e => { e.stopPropagation(); handleDuplicate(); }}
          title='Duplicate this block'
        >
          <Copy size={13} strokeWidth={2.5} />
        </button>
        {parentInfo.canMoveDown && (
          <>
            <div style={divider} />
            <button style={moveSegment} onClick={handleMoveDown} title={parentInfo.downLabel}>
              <ChevronDown size={14} strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Block type popup */}
      {popup && (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            top: popup === 'above' ? rect.top - 12 : rect.top + rect.height - 12,
            left: centerX + 20,
            transform: 'translateY(-50%)',
            zIndex: 50,
            minWidth: 180,
          }}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '4px 0',
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            <div style={{
              padding: '6px 12px 4px',
              fontSize: 10, fontWeight: 600, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Insert {popup}
            </div>
            {validBlocks.map(block => (
              <button
                key={block.type}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 12px', fontSize: 13, color: '#374151',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; (e.currentTarget as HTMLElement).style.color = '#4338ca'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                onClick={() => handleInsert(block.type, popup)}
              >
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{BLOCK_ICONS[block.type] || <Box size={16} />}</span>
                {BLOCK_NAMES[block.type] || block.name || block.type}
              </button>
            ))}
          </div>
        </div>
      )}
    </>,
    containerRef.current,
  );
}
