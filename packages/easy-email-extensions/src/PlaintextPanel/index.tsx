import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { BasicType } from 'easy-email-core';
import { useBlock, useFocusIdx, useEditorContext } from 'easy-email-editor';

const CodeMirrorEditorPromise = import(
  '../components/Form/CodemirrorEditor'
);
const CodeMirrorEditor = React.lazy(() => CodeMirrorEditorPromise);

/**
 * A panel that shows the raw HTML content of the currently focused
 * text/button/raw block in a CodeMirror editor. Changes apply on blur.
 */
export function PlaintextPanel() {
  const { focusBlock, setValueByIdx } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { pageData } = useEditorContext();

  const [content, setContent] = useState('');

  const hasContent = focusBlock && (
    focusBlock.type === BasicType.TEXT ||
    focusBlock.type === BasicType.BUTTON ||
    focusBlock.type === BasicType.RAW ||
    focusBlock.type === BasicType.TABLE ||
    focusBlock.type === BasicType.ACCORDION_TITLE ||
    focusBlock.type === BasicType.ACCORDION_TEXT
  );

  const blockName = focusBlock
    ? (focusBlock.type === BasicType.TEXT ? 'Text'
      : focusBlock.type === BasicType.BUTTON ? 'Button'
      : focusBlock.type === BasicType.RAW ? 'Raw'
      : focusBlock.type === BasicType.TABLE ? 'Table'
      : 'Block')
    : '';

  // Sync content when focus changes
  useEffect(() => {
    if (hasContent && focusBlock) {
      setContent(focusBlock.data.value.content || '');
    } else {
      setContent('');
    }
  }, [focusBlock, focusIdx, hasContent]);

  const onContentChange = (val: string) => {
    setContent(val);
  };

  const onBlur = () => {
    if (!focusBlock || !hasContent) return;
    if (content !== focusBlock.data.value.content) {
      focusBlock.data.value.content = content;
      setValueByIdx(focusIdx, { ...focusBlock });
    }
  };

  if (!focusBlock) {
    return (
      <div style={{ padding: 16, color: '#999', fontSize: 13, textAlign: 'center' }}>
        Select a block to edit its content
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div style={{ padding: 16, color: '#999', fontSize: 13, textAlign: 'center' }}>
        This block type ({blockName || focusBlock.type}) does not have editable HTML content.
        <br /><br />
        Select a Text, Button, or Raw block to edit its HTML here.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Block info bar */}
      <div style={{
        padding: '5px 8px',
        background: '#ecfdf5',
        borderBottom: '1px solid #a7f3d0',
        fontSize: 12,
        fontWeight: 600,
        color: '#065f46',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {blockName} HTML
        </span>
      </div>

      {/* CodeMirror editor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense
          fallback={
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: '#263238', color: '#fff',
              fontSize: 13,
            }}>
              Loading editor...
            </div>
          }
        >
          <CodeMirrorEditor
            value={content}
            onChange={onContentChange}
            onBlur={onBlur}
          />
        </Suspense>
      </div>
    </div>
  );
}
