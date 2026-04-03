import { Input, Message } from '@arco-design/web-react';
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
import { cloneDeep } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { MjmlToJson } from '@extensions/utils/MjmlToJson';

/**
 * A panel that shows the MJML source of the currently focused block
 * in a full-height editable textarea. Changes are applied on blur.
 */
export function BlockMjmlPanel() {
  const { setValueByIdx, focusBlock, values } = useBlock();
  const { focusIdx } = useFocusIdx();
  const { pageData } = useEditorContext();
  const { mergeTags } = useEditorProps();
  const [mjmlText, setMjmlText] = useState('');

  // Re-generate MJML when the focused block changes
  useEffect(() => {
    if (focusBlock) {
      setMjmlText(
        JsonToMjml({
          idx: focusIdx,
          data: focusBlock,
          context: pageData,
          mode: 'production',
          dataSource: cloneDeep(mergeTags),
          beautify: true,
        }),
      );
    } else {
      setMjmlText('');
    }
  }, [focusBlock, focusIdx, pageData, mergeTags]);

  const onMjmlChange = useCallback(
    (event: React.FocusEvent<HTMLTextAreaElement>) => {
      try {
        const parseValue = MjmlToJson(event.target.value);
        if (parseValue.type !== BasicType.PAGE) {
          const parentBlock = getParentByIdx(values, focusIdx)!;
          const parseBlock = BlockManager.getBlockByType(parseValue.type);

          if (!parseBlock?.validParentType.includes(parentBlock?.type)) {
            throw new Error(t('Invalid content'));
          }
        } else if (focusIdx !== getPageIdx()) {
          throw new Error(t('Invalid content'));
        }

        setValueByIdx(focusIdx, parseValue);
      } catch (error) {
        Message.error(t('Invalid MJML'));
      }
    },
    [focusIdx, setValueByIdx, values],
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
        <span style={{ fontFamily: 'monospace' }}>&lt;{blockName}&gt;</span>
        <span style={{ fontWeight: 400, color: '#b45309', fontSize: 11 }}>
          {focusIdx}
        </span>
      </div>

      {/* MJML editor */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <Input.TextArea
          value={mjmlText}
          onChange={setMjmlText}
          onBlur={onMjmlChange}
          style={{
            width: '100%',
            minHeight: 400,
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: '1.5',
            resize: 'vertical',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
          }}
          autoSize={{ minRows: 20, maxRows: 60 }}
        />
      </div>
    </div>
  );
}
