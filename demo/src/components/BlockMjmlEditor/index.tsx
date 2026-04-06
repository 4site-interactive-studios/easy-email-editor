import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { Message } from '@arco-design/web-react';
import { ChevronUp, ChevronRight } from 'lucide-react';
import {
  BasicType,
  BlockManager,
  getPageIdx,
  getParentIdx,
  getParentByIdx,
  JsonToMjml,
} from 'easy-email-core';
import {
  useBlock,
  useFocusIdx,
  useEditorContext,
  useEditorProps,
} from 'easy-email-editor';
import { MjmlToJson } from 'easy-email-extensions';
import { cloneDeep, get } from 'lodash';

// CodeMirror core
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/xml/xml';

// Editing addons
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/matchtags';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';

// Code folding
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/xml-fold';

// Autocomplete
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/xml-hint';

// Search — enables Ctrl+F/Cmd+F within the editor
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/search/match-highlighter';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/dialog/dialog.css';

function getBlockDisplayName(block: any): string {
  if (!block) return '?';
  return BlockManager.getBlockByType(block.type)?.name || block.type || '?';
}

/**
 * A CodeMirror-based MJML editor for the currently focused block.
 * Designed to be used as a sidebar tab in the right panel.
 */
export function BlockMjmlEditor() {
  const { setValueByIdx, focusBlock, values } = useBlock();
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { pageData } = useEditorContext();
  const { mergeTags } = useEditorProps();
  const [mjmlText, setMjmlText] = useState('');
  const editorRef = useRef<any>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build breadcrumb trail from page root to current block
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

  const parentIdx = focusIdx ? getParentIdx(focusIdx) : undefined;
  const canJumpUp = !!parentIdx;

  // Re-generate MJML when the focused block changes
  useEffect(() => {
    if (focusBlock) {
      const generated = JsonToMjml({
        idx: focusIdx,
        data: focusBlock,
        context: pageData,
        mode: 'production',
        dataSource: cloneDeep(mergeTags),
        beautify: true,
      });
      setMjmlText(generated);
    } else {
      setMjmlText('');
    }
    return () => {
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    };
  }, [focusBlock, focusIdx, pageData, mergeTags]);

  // Apply MJML changes back to the block tree
  const applyMjml = useCallback((mjml: string) => {
    try {
      const parseValue = MjmlToJson(mjml);
      if (parseValue.type !== BasicType.PAGE) {
        const parentBlock = getParentByIdx(values, focusIdx)!;
        const parseBlock = BlockManager.getBlockByType(parseValue.type);
        if (!parseBlock?.validParentType.includes(parentBlock?.type)) {
          Message.error('Invalid content for this position');
          return;
        }
      } else if (focusIdx !== getPageIdx()) {
        Message.error('Invalid content');
        return;
      }
      setValueByIdx(focusIdx, parseValue);
    } catch (error) {
      Message.error('Invalid MJML');
    }
  }, [focusIdx, setValueByIdx, values]);

  // Handle code changes — debounce applying to block tree
  const handleChange = useCallback((_editor: any, _data: any, value: string) => {
    setMjmlText(value);
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => applyMjml(value), 1500);
  }, [applyMjml]);

  // Apply on blur (immediate)
  const handleBlur = useCallback(() => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyMjml(mjmlText);
  }, [applyMjml, mjmlText]);

  const handleJumpUp = useCallback(() => {
    if (parentIdx) {
      // Apply any pending changes before jumping
      if (applyTimerRef.current) {
        clearTimeout(applyTimerRef.current);
        applyMjml(mjmlText);
      }
      setFocusIdx(parentIdx);
    }
  }, [parentIdx, setFocusIdx, applyMjml, mjmlText]);

  const handleBreadcrumbClick = useCallback((idx: string) => {
    if (idx === focusIdx) return;
    // Apply any pending changes before jumping
    if (applyTimerRef.current) {
      clearTimeout(applyTimerRef.current);
      applyMjml(mjmlText);
    }
    setFocusIdx(idx);
  }, [focusIdx, setFocusIdx, applyMjml, mjmlText]);

  const blockType = focusBlock?.type || '';
  const blockName = blockType
    ? BlockManager.getBlockByType(blockType)?.name || blockType
    : '';

  if (!focusBlock) {
    return (
      <div style={{ padding: 16, color: '#999', fontSize: 13, textAlign: 'center' }}>
        Select a block to edit its MJML
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} className='block-mjml-editor-panel'>
      {/* Breadcrumb bar */}
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
              {i > 0 && <ChevronRight size={10} style={{ color: '#9ca3af', flexShrink: 0 }} />}
              <button
                onClick={() => handleBreadcrumbClick(crumb.idx)}
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
                  ...(isLast ? {} : { ':hover': { background: '#e5e7eb' } }),
                }}
                onMouseEnter={e => { if (!isLast) (e.currentTarget as HTMLElement).style.background = '#e5e7eb'; }}
                onMouseLeave={e => { if (!isLast) (e.currentTarget as HTMLElement).style.background = 'none'; }}
                title={isLast ? `Currently editing: ${crumb.name}` : `Jump to ${crumb.name}`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Block info bar with Jump Up button */}
      <div style={{
        padding: '5px 8px',
        background: '#fef3c7',
        borderBottom: '1px solid #fde68a',
        fontSize: 12,
        fontWeight: 600,
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        {canJumpUp && (
          <button
            onClick={handleJumpUp}
            title={`Jump to parent (${getBlockDisplayName(get(values, parentIdx))})`}
            style={{
              background: '#92400e',
              color: '#fef3c7',
              border: 'none',
              borderRadius: 3,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#78350f'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#92400e'; }}
          >
            <ChevronUp size={14} strokeWidth={2.5} />
          </button>
        )}
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          &lt;{blockName}&gt;
        </span>
      </div>

      {/* CodeMirror editor */}
      <style>{`
        .block-mjml-editor-panel .react-codemirror2 {
          flex: 1;
          overflow: hidden;
        }
        .block-mjml-editor-panel .react-codemirror2 .CodeMirror {
          height: 100% !important;
          font-size: 12px;
        }
      `}</style>
      <CodeMirror
        ref={(ref: any) => { editorRef.current = ref; }}
        value={mjmlText}
        options={{
          mode: 'xml',
          theme: 'material',
          lineNumbers: true,
          lineWrapping: true,
          smartIndent: true,
          indentWithTabs: false,
          indentUnit: 2,
          tabSize: 2,
          autoCloseTags: true,
          matchTags: { bothTags: true },
          autoCloseBrackets: true,
          matchBrackets: true,
          foldGutter: true,
          highlightSelectionMatches: { showToken: true, annotateScrollbar: true },
          gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        }}
        onBeforeChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
}
