import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { Message } from '@arco-design/web-react';
import {
  BasicType,
  BlockManager,
  getPageIdx,
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
import { cloneDeep } from 'lodash';

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

/**
 * A CodeMirror-based MJML editor for the currently focused block.
 * Designed to be used as a sidebar tab in the right panel.
 */
export function BlockMjmlEditor() {
  const { setValueByIdx, focusBlock, values } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { pageData } = useEditorContext();
  const { mergeTags } = useEditorProps();
  const [mjmlText, setMjmlText] = useState('');
  const editorRef = useRef<any>(null);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      {/* Block info bar */}
      <div style={{
        padding: '6px 12px',
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
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          &lt;{blockName}&gt;
        </span>
        <span style={{ fontWeight: 400, color: '#b45309', fontSize: 11, opacity: 0.7 }}>
          {focusIdx}
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
          gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        }}
        onBeforeChange={handleChange}
        onBlur={handleBlur}
      />
    </div>
  );
}
