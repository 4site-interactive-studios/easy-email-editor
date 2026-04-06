import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { Message } from '@arco-design/web-react';
import { ChevronRight } from 'lucide-react';
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
  scrollBlockEleIntoView,
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
  const [mjmlValid, setMjmlValid] = useState(true);
  const { mergeTags } = useEditorProps();
  const [mjmlText, setMjmlText] = useState('');
  const editorRef = useRef<any>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditingRef = useRef(false); // suppress sync-back while user is typing

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

  // Re-generate MJML when the focused block changes — but NOT while user is typing
  const prevFocusIdxRef = useRef(focusIdx);
  useEffect(() => {
    // Always sync when switching to a different block
    if (focusIdx !== prevFocusIdxRef.current) {
      // If leaving with invalid MJML, warn
      if (!mjmlValid && userEditingRef.current) {
        if (!window.confirm('Your MJML changes are invalid and will be lost. Continue?')) {
          setFocusIdx(prevFocusIdxRef.current);
          return;
        }
      }
      userEditingRef.current = false;
      prevFocusIdxRef.current = focusIdx;
    }

    // Don't overwrite the editor while the user is actively editing
    if (userEditingRef.current) return;

    setMjmlValid(true);
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

  // Apply MJML changes back to the block tree.
  // silent=true: during typing, skip errors silently (don't update visual editor)
  // silent=false: on blur, show error if still invalid
  const applyMjml = useCallback((mjml: string, silent = false) => {
    try {
      const parseValue = MjmlToJson(mjml);
      if (parseValue.type !== BasicType.PAGE) {
        const parentBlock = getParentByIdx(values, focusIdx)!;
        const parseBlock = BlockManager.getBlockByType(parseValue.type);
        if (!parseBlock?.validParentType.includes(parentBlock?.type)) {
          setMjmlValid(false);
          if (!silent) Message.error('Invalid content for this position');
          return;
        }
      } else if (focusIdx !== getPageIdx()) {
        setMjmlValid(false);
        if (!silent) Message.error('Invalid content');
        return;
      }
      setMjmlValid(true);
      userEditingRef.current = false;
      setValueByIdx(focusIdx, parseValue);
    } catch (error) {
      setMjmlValid(false);
      if (!silent) Message.error('Invalid MJML');
    }
  }, [focusIdx, setValueByIdx, values]);

  // Handle code changes — short debounce, silent validation
  const handleChange = useCallback((_editor: any, _data: any, value: string) => {
    userEditingRef.current = true;
    setMjmlText(value);
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => applyMjml(value, true), 300);
  }, [applyMjml]);

  // Apply on blur — show error if invalid
  const handleBlur = useCallback(() => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyMjml(mjmlText, false);
  }, [applyMjml, mjmlText]);

  const handleBreadcrumbClick = useCallback((idx: string) => {
    if (idx === focusIdx) return;
    // Apply any pending changes before jumping
    if (applyTimerRef.current) {
      clearTimeout(applyTimerRef.current);
      applyMjml(mjmlText);
    }
    setFocusIdx(idx);
    scrollBlockEleIntoView({ idx });
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

      {/* Block info bar with Jump Up button + validity indicator */}
      <div style={{
        padding: '5px 8px',
        background: mjmlValid ? '#fef3c7' : '#fef2f2',
        borderBottom: `1px solid ${mjmlValid ? '#fde68a' : '#fecaca'}`,
        fontSize: 12,
        fontWeight: 600,
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: mjmlValid ? '#92400e' : '#991b1b' }}>
          &lt;{blockName}&gt;
        </span>
        {!mjmlValid && (
          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 500, marginLeft: 'auto' }}>
            Invalid — not applied
          </span>
        )}
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
