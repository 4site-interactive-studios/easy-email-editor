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
import { EyeIcon } from './components/EyeIcon';
import { BlockTree, BlockTreeProps } from './components/BlockTree';
import { ContextMenu } from './components/ContextMenu';
import { classnames } from '@extensions/utils/classnames';
import { getDirectionFormDropPosition, useAvatarWrapperDrop } from './hooks/useAvatarWrapperDrop';
import { getIconNameByBlockType } from '@extensions/utils/getIconNameByBlockType';
import { Space, Switch } from '@arco-design/web-react';
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

  const [focusOnly, setFocusOnly] = useState(true);

  const onToggleVisible = useCallback(
    ({ id }: IBlockDataWithId, e: React.MouseEvent) => {
      e.stopPropagation();
      const blockData = get(valueRef.current, id) as IBlockData | null;

      if (blockData) {
        blockData.data.hidden = !Boolean(blockData.data.hidden);
        setValueByIdx(id, blockData);
      }
    },
    [setValueByIdx, valueRef],
  );

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
          <div className={styles.eyeIcon}>
            <EyeIcon
              blockData={data}
              onToggleVisible={onToggleVisible}
            />
          </div>
        </div>
      );
    },
    [onToggleVisible, propsRenderTitle],
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

  const treeData = useMemo(() => {
    if (!focusOnly || !focusIdx) return fullTreeData;

    const findNode = (node: IBlockDataWithId, targetId: string): IBlockDataWithId | null => {
      if (node.id === targetId) return node;
      for (const child of node.children) {
        const found = findNode(child, targetId);
        if (found) return found;
      }
      return null;
    };

    const root = fullTreeData[0];
    if (!root) return fullTreeData;

    const focusedNode = findNode(root, focusIdx);
    if (!focusedNode) return fullTreeData;

    // Walk up to the nearest wrapper/container (or page if none)
    const containerTypes = new Set([
      BasicType.WRAPPER, BasicType.PAGE,
      'advanced_wrapper',
    ]);

    let container: IBlockDataWithId = focusedNode;
    while (container.parent && !containerTypes.has(container.type)) {
      container = container.parent;
    }

    return [container];
  }, [fullTreeData, focusOnly, focusIdx]);

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
    let currentIdx = getParentIdx(focusIdx);
    const keys: string[] = [];
    while (currentIdx) {
      keys.push(currentIdx);
      currentIdx = getParentIdx(currentIdx);
    }
    return keys;
  }, [focusIdx]);

  // Scroll the focused tree node into view (centered) within the sidebar
  useEffect(() => {
    if (!focusIdx) return;
    const timer = setTimeout(() => {
      const node = document.querySelector(`[data-tree-idx="${focusIdx}"]`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
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
        <span>{t('Selected only')}</span>
        <Switch
          size='small'
          checked={focusOnly}
          onChange={setFocusOnly}
        />
      </div>
      <BlockTree<IBlockDataWithId>
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        defaultExpandAll
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
