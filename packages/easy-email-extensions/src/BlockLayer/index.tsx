import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DATA_ATTRIBUTE_DROP_CONTAINER,
  IconFont,
  scrollBlockEleIntoView,
  TextStyle,
  useBlock,
  useEditorContext,
  useFocusIdx,
  useHoverIdx,
  useRefState,
} from 'easy-email-editor';
import {
  BasicType,
  BlockManager,
  getChildIdx,
  getIndexByIdx,
  getNodeIdxClassName,
  getPageIdx,
  getParentIdx,
  IBlockData,
  isCommentBlock,
  getCommentText,
} from 'easy-email-core';
import styles from './index.module.scss';
import { cloneDeep, get, isString, isEqual } from 'lodash';
// EyeIcon removed
import { BlockTree, BlockTreeProps } from './components/BlockTree';
import { ContextMenu } from './components/ContextMenu';
import { classnames } from '@extensions/utils/classnames';
import { getDirectionFormDropPosition, useAvatarWrapperDrop } from './hooks/useAvatarWrapperDrop';
import { getIconNameByBlockType } from '@extensions/utils/getIconNameByBlockType';
import { Space } from '@arco-design/web-react';
import { getBlockTitle } from '@extensions/utils/getBlockTitle';

export interface IBlockDataWithId extends IBlockData {
  id: string;
  icon?: React.ReactElement;
  parent: IBlockDataWithId | null;
  children: IBlockDataWithId[];
  className?: string;
  /** Comment text from a preceding comment-only mj-raw sibling */
  commentLabel?: string;
}
export interface BlockLayerProps {
  renderTitle?: (block: IBlockDataWithId) => React.ReactNode;
}

export function BlockLayer(props: BlockLayerProps) {
  const { pageData } = useEditorContext();
  const { renderTitle: propsRenderTitle } = props;
  const { focusIdx, setFocusIdx } = useFocusIdx();
  const { setHoverIdx, setIsDragging, setDirection } = useHoverIdx();
  const { moveBlock, setValueByIdx, copyBlock, removeBlock, values } = useBlock();

  const { setBlockLayerRef, allowDrop, removeHightLightClassName } =
    useAvatarWrapperDrop();

  const valueRef = useRefState(values);

  const [contextMenuData, setContextMenuData] = useState<{
    blockData: IBlockDataWithId;
    left: number;
    top: number;
  } | null>(null);

  // Removed "Selected only" toggle — always show the full tree
  // null = no forced state; string[] = force these keys
  const [forceExpandedKeys, setForceExpandedKeys] = useState<string[] | null>(null);

  const renderTitle = useCallback(
    (data: IBlockDataWithId) => {
      const isPage = data.type === BasicType.PAGE;
      const title = propsRenderTitle ? propsRenderTitle(data) : getBlockTitle(data);
      const commentLabel = data.commentLabel || '';

      // Build display: "Section: Intro text + CTA" when comment present
      const displayTitle = commentLabel
        ? `${isString(title) ? title : ''}: ${commentLabel}`
        : title;

      const tooltipText = isString(displayTitle) ? displayTitle : (isString(title) ? title : '');

      return (
        <div
          data-tree-idx={data.id}
          data-tooltip={tooltipText || undefined}
          className={classnames(
            styles.title,
            !isPage && getNodeIdxClassName(data.id),
            !isPage && 'email-block',
          )}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
            <IconFont
              iconName={getIconNameByBlockType(data.type)}
              style={{ fontSize: 12, color: '#999', flexShrink: 0 }}
            />
            <div
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              <TextStyle size='smallest'>
                {isString(title) ? title : title}
              </TextStyle>
              {commentLabel && (
                <span style={{
                  fontSize: 10,
                  color: '#6b7280',
                  marginLeft: 2,
                }}>
                  : {commentLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    },
    [propsRenderTitle],
  );

  const fullTreeData = useMemo(() => {
    const copyData = cloneDeep(pageData) as IBlockDataWithId;
    const loop = (
      item: IBlockDataWithId,
      id: string,
      parent: IBlockDataWithId | null,
    ) => {
      item.id = id;
      item.parent = parent;

      // Build filtered children list, skipping comment-only raw blocks
      // and attaching their text as labels on the next real sibling.
      // Track original indices so the tree node IDs match the real block positions.
      const originalChildren = [...item.children] as IBlockDataWithId[];
      const filteredChildren: { child: IBlockDataWithId; originalIndex: number }[] = [];
      let pendingComment = '';

      for (let i = 0; i < originalChildren.length; i++) {
        const child = originalChildren[i];
        if (isCommentBlock(child)) {
          pendingComment = getCommentText(child);
        } else {
          if (pendingComment) {
            child.commentLabel = pendingComment;
            pendingComment = '';
          }
          filteredChildren.push({ child, originalIndex: i });
        }
      }

      // Replace children with filtered list and recurse with correct indices
      item.children = filteredChildren.map(({ child, originalIndex }) => {
        loop(child, getChildIdx(id, originalIndex), item);
        return child;
      });
    };

    loop(copyData, getPageIdx(), null);

    return [copyData];
  }, [pageData]);

  const treeData = fullTreeData;

  const handleExpandAll = useCallback(() => {
    const ids: string[] = [];
    const walk = (node: IBlockDataWithId) => { ids.push(node.id); node.children?.forEach(walk); };
    treeData.forEach(walk);
    setForceExpandedKeys(ids);
    setTimeout(() => setForceExpandedKeys(null), 50);
  }, [treeData]);

  const handleCollapseAll = useCallback(() => {
    // Keep just the root expanded so the tree isn't completely empty
    setForceExpandedKeys(treeData.length > 0 ? [treeData[0].id] : []);
    setTimeout(() => setForceExpandedKeys(null), 50);
  }, [treeData]);

  const onSelect = useCallback(
    (selectedId: string) => {
      setFocusIdx(selectedId);
      setTimeout(() => {
        scrollBlockEleIntoView({ idx: selectedId });
      }, 50);
    },
    [setFocusIdx],
  );

  const onContextMenu = useCallback(
    (blockData: IBlockDataWithId, ev: React.MouseEvent) => {
      ev.preventDefault();
      setContextMenuData({ blockData, left: ev.clientX, top: ev.clientY });
    },
    [],
  );

  const onCloseContextMenu = useCallback((ev?: React.MouseEvent) => {
    setContextMenuData(null);
  }, []);

  const onMouseEnter = useCallback(
    (id: string) => {
      setHoverIdx(id);
    },
    [setHoverIdx],
  );

  const onMouseLeave = useCallback(() => {
    setHoverIdx('');
  }, [setHoverIdx]);

  const onDragStart = useCallback(() => {
    setIsDragging(true);
  }, [setIsDragging]);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);
  }, [setIsDragging]);

  const onDrop: BlockTreeProps<IBlockDataWithId>['onDrop'] = useCallback(
    params => {
      const { dragNode, dropNode, dropPosition } = params;
      const dragBlock = BlockManager.getBlockByType(dragNode.dataRef.type);
      if (!dragBlock) return false;
      const dropIndex = getIndexByIdx(dropNode.key);

      if (dropPosition === 0) {
        if (
          dragBlock.validParentType.includes(dropNode.dataRef.type) &&
          dropNode.dataRef.children.length === 0
        ) {
          moveBlock(dragNode.key, getChildIdx(dropNode.key, 0));
        } else if (
          dropNode.parent &&
          dragBlock.validParentType.includes(dropNode.parent.type)
        ) {
          moveBlock(dragNode.key, getChildIdx(dropNode.parentKey, dropIndex));
        }
      } else {
        moveBlock(
          dragNode.key,
          getChildIdx(dropNode.parentKey, dropPosition > 0 ? dropIndex + 1 : dropIndex),
        );
      }
    },
    [moveBlock],
  );

  const blockTreeAllowDrop: BlockTreeProps<IBlockDataWithId>['allowDrop'] = useCallback(
    (() => {
      let lastDropResult: ReturnType<typeof allowDrop> = false;
      return (data: Parameters<typeof allowDrop>[0]) => {
        const dropResult = allowDrop(data);
        if (isEqual(lastDropResult, dropResult)) {
          return dropResult;
        }
        lastDropResult = dropResult;
        if (dropResult) {
          const node = document.querySelector(`[data-tree-idx="${dropResult.key}"]`)
            ?.parentNode?.parentNode;
          if (node instanceof HTMLElement) {
            removeHightLightClassName();
            node.classList.add('arco-tree-node-title-gap-bottom');
          }
          setDirection(getDirectionFormDropPosition(dropResult.position));
          setHoverIdx(dropResult.key);
        }

        return dropResult;
      };
    })(),
    [allowDrop, removeHightLightClassName, setDirection, setHoverIdx],
  );

  const selectedKeys = useMemo(() => {
    if (!focusIdx) return [];
    return [focusIdx];
  }, [focusIdx]);

  const expandedKeys = useMemo(() => {
    if (!focusIdx) return [];
    // Include the focused node itself (to expand its children)
    // plus all ancestors up to the root
    const keys: string[] = [focusIdx];
    let currentIdx = getParentIdx(focusIdx);
    while (currentIdx) {
      keys.push(currentIdx);
      currentIdx = getParentIdx(currentIdx);
    }
    return keys;
  }, [focusIdx]);

  // Scroll the focused tree node into view (centered) within the sidebar.
  // Retry a few times because the tree needs to expand nodes first.
  useEffect(() => {
    if (!focusIdx) return;
    let attempt = 0;
    const maxAttempts = 5;
    const tryScroll = () => {
      const node = document.querySelector(`[data-tree-idx="${focusIdx}"]`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (attempt < maxAttempts) {
        attempt++;
        setTimeout(tryScroll, 150);
      }
    };
    const timer = setTimeout(tryScroll, 100);
    return () => clearTimeout(timer);
  }, [focusIdx]);

  return (
    <div
      ref={setBlockLayerRef}
      id='BlockLayerManager'
      {...{
        [DATA_ATTRIBUTE_DROP_CONTAINER]: 'true',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px 6px',
        fontSize: 12,
        color: '#86909c',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span
            style={{ cursor: 'pointer', fontSize: 11, color: '#4b7cf3' }}
            onClick={handleExpandAll}
            title={t('Expand all')}
          >
            {t('Expand')}
          </span>
          <span style={{ color: '#d1d5db' }}>|</span>
          <span
            style={{ cursor: 'pointer', fontSize: 11, color: '#4b7cf3' }}
            onClick={handleCollapseAll}
            title={t('Collapse all')}
          >
            {t('Collapse')}
          </span>
        </div>
      </div>
      <BlockTree<IBlockDataWithId>
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        forceExpandedKeys={forceExpandedKeys}
        treeData={treeData}
        renderTitle={renderTitle}
        allowDrop={blockTreeAllowDrop}
        onContextMenu={onContextMenu}
        onDrop={onDrop}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onSelect={onSelect}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      {contextMenuData && (
        <ContextMenu
          onClose={onCloseContextMenu}
          moveBlock={moveBlock}
          copyBlock={copyBlock}
          removeBlock={removeBlock}
          contextMenuData={contextMenuData}
        />
      )}
    </div>
  );
}
