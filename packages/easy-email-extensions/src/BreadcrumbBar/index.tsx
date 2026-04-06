import React, { useMemo } from 'react';
import {
  BlockManager,
  getParentIdx,
  IBlockData,
} from 'easy-email-core';
import { useFocusIdx, useBlock } from 'easy-email-editor';
import { get } from 'lodash';

function getBlockDisplayName(block: any): string {
  if (!block) return '?';
  return BlockManager.getBlockByType(block.type)?.name || block.type || '?';
}

/**
 * A breadcrumb bar showing the path from the page root to the
 * currently focused block. Click any ancestor to navigate to it.
 */
export function BreadcrumbBar() {
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { values } = useBlock();

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
            <button
              onClick={() => !isLast && setFocusIdx(crumb.idx)}
              style={{
                background: 'none',
                border: 'none',
                padding: '1px 4px',
                borderRadius: 3,
                cursor: isLast ? 'default' : 'pointer',
                fontWeight: isLast ? 600 : 400,
                color: isLast ? '#1e40af' : '#6b7280',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 11,
                lineHeight: '18px',
              }}
              onMouseEnter={e => { if (!isLast) (e.currentTarget as HTMLElement).style.background = '#e5e7eb'; }}
              onMouseLeave={e => { if (!isLast) (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
