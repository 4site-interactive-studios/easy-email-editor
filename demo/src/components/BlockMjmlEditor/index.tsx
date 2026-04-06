import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { Message } from '@arco-design/web-react';
import { ChevronRight, AlertTriangle, X, WrapText, Maximize2, Minimize2 } from 'lucide-react';
import mjml from 'mjml-browser';
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
  const validateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditingRef = useRef(false); // suppress sync-back while user is typing

  // Editor options
  const [lineWrap, setLineWrap] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Validation state
  type MjmlError = { line: number; message: string; tagName: string; formattedMessage: string };
  const [mjmlErrors, setMjmlErrors] = useState<MjmlError[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  // Build breadcrumb trail from page root to current block (skip Page itself)
  const breadcrumbs = useMemo(() => {
    if (!focusIdx) return [];
    const crumbs: Array<{ idx: string; name: string }> = [];
    let idx: string | undefined = focusIdx;
    while (idx) {
      const block = get(values, idx);
      if (block && block.type !== BasicType.PAGE) {
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
    setMjmlErrors([]);
    setShowErrors(false);
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
      if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    };
  }, [focusBlock, focusIdx, pageData, mergeTags]);

  // Run MJML validation to capture errors (does not apply changes)
  const runValidation = useCallback((mjmlStr: string) => {
    try {
      // Wrap partial MJML in a full document so mjml-browser can validate it
      const fullDoc = mjmlStr.trim().startsWith('<mjml')
        ? mjmlStr
        : `<mjml><mj-body><mj-section><mj-column>${mjmlStr}</mj-column></mj-section></mj-body></mjml>`;
      const result = mjml(fullDoc, { validationLevel: 'soft' });
      setMjmlErrors(result.errors || []);
    } catch (err: any) {
      setMjmlErrors([{
        line: 0,
        message: err?.message || 'MJML failed to parse',
        tagName: 'mjml',
        formattedMessage: err?.message || 'The MJML could not be parsed.',
      }]);
    }
  }, []);

  // Apply MJML changes back to the block tree.
  // silent=true: during typing, skip errors silently (don't update visual editor)
  // silent=false: on blur, show error if still invalid
  const applyMjml = useCallback((mjmlStr: string, silent = false) => {
    try {
      const parseValue = MjmlToJson(mjmlStr, true);
      if (parseValue.type !== BasicType.PAGE) {
        const parentBlock = getParentByIdx(values, focusIdx)!;
        const parseBlock = BlockManager.getBlockByType(parseValue.type);
        if (!parseBlock?.validParentType.includes(parentBlock?.type)) {
          setMjmlValid(false);
          const parentName = BlockManager.getBlockByType(parentBlock?.type)?.name || parentBlock?.type || 'parent';
          const childName = BlockManager.getBlockByType(parseValue.type)?.name || parseValue.type || 'block';
          setMjmlErrors([{
            line: 0,
            message: `<${childName}> is not valid inside <${parentName}>`,
            tagName: parseValue.type,
            formattedMessage: `A <${childName}> block cannot be placed inside a <${parentName}> block at this position.`,
          }]);
          if (!silent) Message.error('Invalid content for this position');
          return;
        }
      } else if (focusIdx !== getPageIdx()) {
        setMjmlValid(false);
        setMjmlErrors([{
          line: 0,
          message: 'Page-level content cannot replace a non-page block',
          tagName: 'page',
          formattedMessage: 'This MJML defines a full page, but the current block is not the page root.',
        }]);
        if (!silent) Message.error('Invalid content');
        return;
      }
      setMjmlValid(true);
      setMjmlErrors([]);
      setValueByIdx(focusIdx, parseValue);
    } catch (error: any) {
      setMjmlValid(false);
      // Try mjml-browser validation for structured errors
      try {
        const fullDoc = mjmlStr.trim().startsWith('<mjml')
          ? mjmlStr
          : `<mjml><mj-body><mj-section><mj-column>${mjmlStr}</mj-column></mj-section></mj-body></mjml>`;
        const result = mjml(fullDoc, { validationLevel: 'soft' });
        if (result.errors && result.errors.length > 0) {
          setMjmlErrors(result.errors);
        } else {
          setMjmlErrors([{
            line: 0,
            message: error?.message || 'Invalid MJML',
            tagName: '',
            formattedMessage: error?.message || 'The MJML could not be parsed.',
          }]);
        }
      } catch (parseErr: any) {
        setMjmlErrors([{
          line: 0,
          message: error?.message || parseErr?.message || 'Invalid MJML',
          tagName: '',
          formattedMessage: error?.message || parseErr?.message || 'The MJML could not be parsed.',
        }]);
      }
      if (!silent) Message.error('Invalid MJML');
    }
  }, [focusIdx, setValueByIdx, values]);

  // Handle code changes — short debounce for apply + validation
  const handleChange = useCallback((_editor: any, _data: any, value: string) => {
    userEditingRef.current = true;
    setMjmlText(value);
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = setTimeout(() => applyMjml(value, true), 300);
    // Debounced validation (300ms)
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    validateTimerRef.current = setTimeout(() => runValidation(value), 300);
  }, [applyMjml, runValidation]);

  // Instant validation on cursor activity (cursor move, click, etc.)
  const handleCursorActivity = useCallback((_editor: any) => {
    if (!userEditingRef.current) return;
    // Run validation immediately on cursor move
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    runValidation(mjmlText);
  }, [runValidation, mjmlText]);

  // Apply on blur — show error if invalid
  const handleBlur = useCallback(() => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    if (validateTimerRef.current) clearTimeout(validateTimerRef.current);
    applyMjml(mjmlText, false);
    runValidation(mjmlText);
  }, [applyMjml, runValidation, mjmlText]);

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

  const toggleLineWrap = useCallback(() => {
    setLineWrap(w => {
      const next = !w;
      if (editorRef.current) {
        const cm = editorRef.current.editor || editorRef.current;
        if (cm?.setOption) cm.setOption('lineWrapping', next);
      }
      return next;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen(f => !f);
    // Refresh CodeMirror after layout change
    setTimeout(() => {
      if (editorRef.current) {
        const cm = editorRef.current.editor || editorRef.current;
        if (cm?.refresh) cm.refresh();
      }
    }, 50);
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
        setTimeout(() => {
          if (editorRef.current) {
            const cm = editorRef.current.editor || editorRef.current;
            if (cm?.refresh) cm.refresh();
          }
        }, 50);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen]);

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...(fullscreen ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: '#fff',
        } : {}),
      }}
      className='block-mjml-editor-panel'
    >
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

      {/* Block info bar with validity indicator */}
      <div style={{
        padding: '5px 8px',
        background: mjmlValid && mjmlErrors.length === 0 ? '#fef3c7' : '#fef2f2',
        borderBottom: `1px solid ${mjmlValid && mjmlErrors.length === 0 ? '#fde68a' : '#fecaca'}`,
        fontSize: 12,
        fontWeight: 600,
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', color: mjmlValid && mjmlErrors.length === 0 ? '#92400e' : '#991b1b' }}>
          &lt;{blockName}&gt;
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={toggleLineWrap}
            title={lineWrap ? 'Disable line wrapping' : 'Enable line wrapping'}
            style={{
              background: lineWrap ? 'rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              borderRadius: 3,
              padding: '2px 5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              color: lineWrap ? '#4b5563' : '#9ca3af',
              fontSize: 10,
              fontWeight: 500,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = lineWrap ? 'rgba(0,0,0,0.08)' : 'none'; }}
          >
            <WrapText size={10} />
            Wrap
          </button>
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            style={{
              background: fullscreen ? 'rgba(0,0,0,0.08)' : 'none',
              border: 'none',
              borderRadius: 3,
              padding: '2px 4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: fullscreen ? '#4b5563' : '#9ca3af',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = fullscreen ? 'rgba(0,0,0,0.08)' : 'none'; }}
          >
            {fullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </span>
        {(!mjmlValid || mjmlErrors.length > 0) && (
          <button
            onClick={() => setShowErrors(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 10,
              color: '#dc2626',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '1px 4px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fecaca'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <AlertTriangle size={10} />
            {mjmlErrors.length > 0
              ? `${mjmlErrors.length} issue${mjmlErrors.length > 1 ? 's' : ''}`
              : 'Invalid — not applied'
            }
          </button>
        )}

        {/* Error popup (dropdown from info bar) */}
        {showErrors && (!mjmlValid || mjmlErrors.length > 0) && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderTop: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxHeight: 240,
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                {mjmlErrors.length > 0
                  ? `${mjmlErrors.length} issue${mjmlErrors.length > 1 ? 's' : ''} found`
                  : 'Validation Error'
                }
              </span>
              <button
                onClick={() => setShowErrors(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9ca3af', borderRadius: 3 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; }}
              >
                <X size={14} />
              </button>
            </div>
            {mjmlErrors.length === 0 ? (
              <div style={{ padding: '12px 10px', fontSize: 12, color: '#dc2626' }}>
                MJML could not be parsed — check syntax.
              </div>
            ) : (
              <div style={{ padding: '4px 0' }}>
                {mjmlErrors.map((err, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 8,
                    padding: '6px 10px',
                    borderBottom: i < mjmlErrors.length - 1 ? '1px solid #f9fafb' : 'none',
                  }}>
                    <AlertTriangle size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: '16px' }}>
                        {err.formattedMessage || err.message}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, fontSize: 10, color: '#9ca3af' }}>
                        {err.tagName && (
                          <span style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                            background: '#f3f4f6',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}>
                            &lt;{err.tagName.startsWith('mj-') ? err.tagName : `mj-${err.tagName}`}&gt;
                          </span>
                        )}
                        {err.line > 0 && <span>Line {err.line}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          lineWrapping: lineWrap,
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
        onCursor={handleCursorActivity}
      />
    </div>
  );
}
