import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  BlockManager,
  getParentIdx,
  getChildIdx,
  IBlockData,
  isCommentBlock,
  getCommentText,
} from 'easy-email-core';
import { useFocusIdx, useBlock, scrollBlockEleIntoView } from 'easy-email-editor';
import { get } from 'lodash';

function getBlockDisplayName(block: any): string {
  if (!block) return '?';
  return BlockManager.getBlockByType(block.type)?.name || block.type || '?';
}

/**
 * A breadcrumb bar showing the path from the page root to the
 * currently focused block. Click any ancestor to navigate to it.
 * Hovering the current (last) breadcrumb shows a flyout with all
 * sibling blocks in the parent.
 */
export function BreadcrumbBar() {
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { values } = useBlock();
  const [showSiblings, setShowSiblings] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Close flyout when focus changes
  useEffect(() => { setShowSiblings(false); }, [focusIdx]);

  const breadcrumbs = useMemo(() => {
    if (!focusIdx) return [];
    const crumbs: Array<{ idx: string; name: string }> = [];
    let idx: string | undefined = focusIdx;
    while (idx) {
      const block = get(values, idx);
      if (block) {
        crumbs.unshift({ idx, name: getBlockDisplayName(block) });
      }
      idx = getParentIdx(idx);
    }
    return crumbs;
  }, [focusIdx, values]);

  // Get siblings of the current block (for the flyout)
  const siblings = useMemo(() => {
    if (!focusIdx) return [];
    const parentIdx = getParentIdx(focusIdx);
    if (!parentIdx) return [];
    const parent = get(values, parentIdx) as IBlockData | null;
    if (!parent?.children) return [];

    const items: Array<{ idx: string; name: string; comment: string; isCurrent: boolean }> = [];
    let pendingComment = '';

    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (isCommentBlock(child)) {
        pendingComment = getCommentText(child);
        continue;
      }
      const childIdx = getChildIdx(parentIdx, i);
      items.push({
        idx: childIdx,
        name: getBlockDisplayName(child),
        comment: pendingComment,
        isCurrent: childIdx === focusIdx,
      });
      pendingComment = '';
    }
    return items;
  }, [focusIdx, values]);

  const handleMouseEnterLast = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowSiblings(true);
  };

  const handleMouseLeaveLast = () => {
    hideTimerRef.current = setTimeout(() => setShowSiblings(false), 200);
  };

  const handleFlyoutEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const handleFlyoutLeave = () => {
    hideTimerRef.current = setTimeout(() => setShowSiblings(false), 200);
  };

  if (breadcrumbs.length <= 1) return null;

  return (
    <div style={{
      padding: '4px 8px',
      background: '#f9fafb',
      borderBottom: '1px solid #e5e7eb',
      fontSize: 11,
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 1,
      flexShrink: 0,
      minHeight: 28,
      position: 'relative',
    }}>
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.idx}>
            {i > 0 && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            {isLast ? (
              <div
                style={{ position: 'relative', display: 'inline-flex' }}
                onMouseEnter={handleMouseEnterLast}
                onMouseLeave={handleMouseLeaveLast}
              >
                <button
                  style={{
                    background: showSiblings ? '#e5e7eb' : 'none',
                    border: 'none',
                    padding: '1px 4px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: '#1e40af',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 11,
                    lineHeight: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  {crumb.name}
                  {siblings.length > 1 && (
                    <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 10 }}>
                      ({siblings.length})
                    </span>
                  )}
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Siblings flyout */}
                {showSiblings && siblings.length > 1 && (
                  <div
                    ref={flyoutRef}
                    onMouseEnter={handleFlyoutEnter}
                    onMouseLeave={handleFlyoutLeave}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      zIndex: 100,
                      minWidth: 180,
                      maxHeight: 300,
                      overflowY: 'auto',
                      background: '#fff',
                      borderRadius: 6,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                      padding: '4px 0',
                    }}
                  >
                    {siblings.map((sib) => (
                      <button
                        key={sib.idx}
                        onClick={() => { setFocusIdx(sib.idx); scrollBlockEleIntoView({ idx: sib.idx }); setShowSiblings(false); }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 10px',
                          fontSize: 12,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                          color: sib.isCurrent ? '#1e40af' : '#374151',
                          fontWeight: sib.isCurrent ? 600 : 400,
                          background: sib.isCurrent ? '#eff6ff' : 'none',
                          border: 'none',
                          cursor: sib.isCurrent ? 'default' : 'pointer',
                          textAlign: 'left',
                          borderLeft: sib.isCurrent ? '3px solid #3b82f6' : '3px solid transparent',
                        }}
                        onMouseEnter={e => { if (!sib.isCurrent) (e.currentTarget as HTMLElement).style.background = '#f3f4f6'; }}
                        onMouseLeave={e => { if (!sib.isCurrent) (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11 }}>
                          {sib.name}
                        </span>
                        {sib.comment && (
                          <span style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
                            {sib.comment}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setFocusIdx(crumb.idx); scrollBlockEleIntoView({ idx: crumb.idx }); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '1px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontWeight: 400,
                  color: '#6b7280',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 11,
                  lineHeight: '18px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#e5e7eb'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
              >
                {crumb.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
