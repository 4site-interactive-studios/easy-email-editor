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

  /**
   * Get the preceding comment text for a block (if its previous sibling
   * is a comment-only mj-raw block).
   */
  const getPrecedingCommentForBlock = useCallback((data: IBlockDataWithId): string => {
    if (!data.parent) return '';
    const siblings = data.parent.children;
    const idx = siblings.indexOf(data);
    if (idx > 0) {
      const prev = siblings[idx - 1];
      if (isCommentBlock(prev)) {
        return getCommentText(prev);
      }
    }
    return '';
  }, []);

  const renderTitle = useCallback(
    (data: IBlockDataWithId) => {
      const isPage = data.type === BasicType.PAGE;
      const isComment = isCommentBlock(data);
      const commentText = isComment ? getCommentText(data) : '';
      const precedingComment = !isComment ? getPrecedingCommentForBlock(data) : '';

      const title = isComment
        ? 'Code Comment'
        : propsRenderTitle
          ? propsRenderTitle(data)
          : getBlockTitle(data);

      const fullTooltip = isComment
        ? commentText
        : precedingComment
          ? `${isString(title) ? title : ''} — ${precedingComment}`
          : (isString(title) ? title : '');

      return (
        <div
          data-tree-idx={data.id}
          data-tooltip={fullTooltip || undefined}
          className={classnames(
            styles.title,
            !isPage && getNodeIdxClassName(data.id),
            !isPage && 'email-block',
          )}
        >
          <Space
            align='center'
            size='mini'
          >
            <IconFont
              iconName={isComment ? 'icon-source-code' : getIconNameByBlockType(data.type)}
              style={{
                fontSize: 12,
                color: isComment ? '#9ca3af' : '#999',
              }}
            />
            <div
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                width: precedingComment ? '8em' : '5em',
                textOverflow: 'ellipsis',
              }}
            >
              {isComment ? (
                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                  {commentText || 'Code Comment'}
                </span>
              ) : (
                <>
                  <TextStyle size='smallest'>{title}</TextStyle>
                  {precedingComment && (
                    <span style={{
                      fontSize: 10,
                      color: '#9ca3af',
                      fontStyle: 'italic',
                      marginLeft: 4,
                    }}>
                      {precedingComment}
                    </span>
                  )}
                </>
              )}
            </div>
          </Space>
          {!isComment && (
            <div className={styles.eyeIcon}>
              <EyeIcon
                blockData={data}
                onToggleVisible={onToggleVisible}
              />
            </div>
          )}
        </div>
      );
    },
    [onToggleVisible, propsRenderTitle, getPrecedingCommentForBlock],
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
      item.children.map((child, index) => loop(child, getChildIdx(id, index), item));
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
      // Don't allow selecting comment-only blocks
      const block = get(values, selectedId) as IBlockData | null;
      if (block && isCommentBlock(block)) return;

      setFocusIdx(selectedId);
      setTimeout(() => {
        scrollBlockEleIntoView({ idx: selectedId });
      }, 50);
    },
    [setFocusIdx, values],
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
          // drop to parent
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
    // Delay to let the tree re-render with new treeData/expandedKeys
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
