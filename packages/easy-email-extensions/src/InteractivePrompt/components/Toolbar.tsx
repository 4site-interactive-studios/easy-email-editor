import React from 'react';
import { BasicType, getParentIdx, getSiblingIdx, isCommentBlock } from 'easy-email-core';
import { useBlock, useFocusIdx, useEditorProps, isTextBlock } from 'easy-email-editor';
import { classnames } from '@extensions/utils/classnames';
import { useAddToCollection } from '@extensions/hooks/useAddToCollection';
import { getBlockTitle } from '@extensions/utils/getBlockTitle';
import { get } from 'lodash';

export function Toolbar() {
  const { moveBlock, copyBlock, removeBlock, focusBlock, values } = useBlock();
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { modal, setModalVisible } = useAddToCollection();
  const props = useEditorProps();

  const isPage = focusBlock?.type === BasicType.PAGE;
  const isText = isTextBlock(focusBlock?.type);

  const handleMoveUp = () => {
    let offset = -1;
    const target = get(values, getSiblingIdx(focusIdx, offset));
    if (target && isCommentBlock(target)) offset = -2;
    moveBlock(focusIdx, getSiblingIdx(focusIdx, offset));
  };

  const handleMoveDown = () => {
    let offset = 1;
    const target = get(values, getSiblingIdx(focusIdx, offset));
    if (target && isCommentBlock(target)) offset = 2;
    moveBlock(focusIdx, getSiblingIdx(focusIdx, offset));
  };

  const handleAddToCollection = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setModalVisible(true);
  };

  const handleCopy: React.MouseEventHandler<HTMLDivElement> = (ev) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    copyBlock(focusIdx);
  };

  const handleDelete = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    removeBlock(focusIdx);
  };

  const handleSelectParent = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFocusIdx(getParentIdx(focusIdx)!);
  };

  if (isText) return null;
  return (
    <>
      <div
        id='easy-email-extensions-InteractivePrompt-Toolbar'
        style={{
          height: 0,

          zIndex: 100,
        }}
      >
        <div
          style={{
            fontSize: 14,
            lineHeight: '22px',
            pointerEvents: 'auto',
            color: '#ffffff',
            transform: 'translateY(-100%)',
            display: 'inline-flex',
            // justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              color: '#ffffff',
              backgroundColor: 'var(--selected-color)',
              height: '22px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              display: 'none',
              padding: '1px 5px',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              maxWidth: 300,
              overflow: 'hidden',
            }}
          >
            {focusBlock && getBlockTitle(focusBlock, false)}
          </div>
          <div
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(ev) => {
              ev.preventDefault();
            }}
            style={{
              display: isPage ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <ToolItem
              width={12}
              iconName='icon-back-parent'
              onClick={handleSelectParent}
            />
            <ToolItem iconName='icon-copy' onClick={handleCopy} />
            {props.onAddCollection && (
              <ToolItem
                iconName='icon-collection'
                onClick={handleAddToCollection}
              />
            )}
            <ToolItem iconName='icon-delete' onClick={handleDelete} />
          </div>
        </div>
      </div>
      {modal}
    </>
  );
}

function ToolItem(props: {
  iconName: string;
  onClick: React.MouseEventHandler<HTMLDivElement>;
  width?: number;
}) {
  return (
    <div
      onClick={props.onClick}
      style={{
        color: '#ffffff',
        backgroundColor: 'var(--selected-color)',
        height: 22,
        fontSize: props.width || 14,
        lineHeight: '22px',
        width: 22,
        display: 'flex',
        pointerEvents: 'auto',
        cursor: 'pointer',
        justifyContent: 'center',
      }}
      className={classnames('iconfont', props.iconName)}
    />
  );
}
