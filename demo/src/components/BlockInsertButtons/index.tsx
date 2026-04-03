import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Type, Image, Square, Minus, ArrowDownUp, Columns, LayoutTemplate, ChevronRight, ChevronUp, ChevronDown, Table2, ListCollapse, Navigation, Share2, Code, Box } from 'lucide-react';
import { BlockManager, BasicType, getSiblingIdx } from 'easy-email-core';
import { useBlock, useFocusIdx, getBlockNodeByIdx } from 'easy-email-editor';
import { get } from 'lodash';

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
  BasicType.PAGE,
  BasicType.TEMPLATE,
  BasicType.ACCORDION_ELEMENT,
  BasicType.ACCORDION_TITLE,
  BasicType.ACCORDION_TEXT,
]);

const BLOCK_NAMES: Record<string, string> = {
  [BasicType.TEXT]: 'Text',
  [BasicType.IMAGE]: 'Image',
  [BasicType.BUTTON]: 'Button',
  [BasicType.DIVIDER]: 'Divider',
  [BasicType.SPACER]: 'Spacer',
  [BasicType.SECTION]: 'Section',
  [BasicType.WRAPPER]: 'Wrapper',
  [BasicType.COLUMN]: 'Column',
  [BasicType.GROUP]: 'Group',
  [BasicType.HERO]: 'Hero',
  [BasicType.CAROUSEL]: 'Carousel',
  [BasicType.NAVBAR]: 'Navbar',
  [BasicType.SOCIAL]: 'Social',
  [BasicType.TABLE]: 'Table',
  [BasicType.ACCORDION]: 'Accordion',
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
  const { addBlock, moveBlock, values } = useBlock();
  const [popup, setPopup] = useState<'above' | 'below' | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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
      .sort((a, b) => {
        const nameA = BLOCK_NAMES[a.type] || a.name || a.type;
        const nameB = BLOCK_NAMES[b.type] || b.name || b.type;
        return nameA.localeCompare(nameB);
      });
  }, [parentInfo?.parentType]);

  // Track the focused block's DOM rect
  useEffect(() => {
    if (!focusIdx || focusIdx === 'content' || !containerRef.current) {
      setRect(null);
      return;
    }
    const updateRect = () => {
      const container = containerRef.current;
      if (!container) return;
      const el = getBlockNodeByIdx(focusIdx);
      if (!el) { setRect(null); return; }
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setRect({
        top: elRect.top - containerRect.top,
        left: elRect.left - containerRect.left,
        width: elRect.width,
        height: elRect.height,
      });
    };
    const timer = setTimeout(updateRect, 100);
    const interval = setInterval(updateRect, 200);
    const editorRoot = document.getElementById('VisualEditorEditMode');
    const shadowRoot = editorRoot?.shadowRoot;
    const scrollContainer = shadowRoot?.querySelector('.shadow-container') || shadowRoot;
    const onScroll = () => updateRect();
    if (scrollContainer) scrollContainer.addEventListener('scroll', onScroll, true);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      if (scrollContainer) scrollContainer.removeEventListener('scroll', onScroll, true);
    };
  }, [focusIdx, containerRef]);

  // Close popup on click outside
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [popup]);

  useEffect(() => { setPopup(null); }, [focusIdx]);

  const handleInsert = useCallback((blockType: string, position: 'above' | 'below') => {
    if (!parentInfo) return;
    addBlock({
      type: blockType,
      parentIdx: parentInfo.parentIdx,
      positionIndex: position === 'above' ? parentInfo.childIndex : parentInfo.childIndex + 1,
    });
    setPopup(null);
  }, [parentInfo, addBlock]);

  const handleMoveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    moveBlock(focusIdx, getSiblingIdx(focusIdx, -1));
  }, [focusIdx, moveBlock]);

  const handleMoveDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    moveBlock(focusIdx, getSiblingIdx(focusIdx, 1));
  }, [focusIdx, moveBlock]);

  if (!rect || !parentInfo || validBlocks.length === 0 || !containerRef.current) return null;

  const centerX = rect.left + rect.width / 2;

  // Shared small button styles
  const smallBtn: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '2px solid #fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    padding: 0,
    position: 'absolute',
    zIndex: 15,
  };

  const plusBtnStyle: React.CSSProperties = {
    ...smallBtn,
    background: '#4f46e5',
    color: '#fff',
  };

  const moveBtnStyle: React.CSSProperties = {
    ...smallBtn,
    background: 'var(--selected-color, #1890ff)',
    color: '#fff',
  };

  return createPortal(
    <>
      {/* ── Top row: move up + insert above ── */}
      <div style={{
        position: 'absolute',
        top: rect.top - 12,
        left: centerX,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        zIndex: 15,
        pointerEvents: 'auto',
      }}>
        {parentInfo.canMoveUp && (
          <button
            style={moveBtnStyle}
            onClick={handleMoveUp}
            title={parentInfo.upLabel}
          >
            <ChevronUp size={14} strokeWidth={2.5} />
          </button>
        )}
        <button
          style={plusBtnStyle}
          onClick={e => { e.stopPropagation(); setPopup(popup === 'above' ? null : 'above'); }}
          title='Insert block above'
        >
          <Plus size={14} strokeWidth={3} />
        </button>
      </div>

      {/* ── Bottom row: insert below + move down ── */}
      <div style={{
        position: 'absolute',
        top: rect.top + rect.height - 12,
        left: centerX,
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 4,
        zIndex: 15,
        pointerEvents: 'auto',
      }}>
        <button
          style={plusBtnStyle}
          onClick={e => { e.stopPropagation(); setPopup(popup === 'below' ? null : 'below'); }}
          title='Insert block below'
        >
          <Plus size={14} strokeWidth={3} />
        </button>
        {parentInfo.canMoveDown && (
          <button
            style={moveBtnStyle}
            onClick={handleMoveDown}
            title={parentInfo.downLabel}
          >
            <ChevronDown size={14} strokeWidth={2.5} />
          </button>
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
              fontSize: 10,
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Insert {popup}
            </div>
            {validBlocks.map(block => (
              <button
                key={block.type}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 12px',
                  fontSize: 13,
                  color: '#374151',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; (e.currentTarget as HTMLElement).style.color = '#4338ca'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                onClick={() => handleInsert(block.type, popup)}
              >
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>
                  {BLOCK_ICONS[block.type] || <Box size={16} />}
                </span>
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
