import { Button, Card, ConfigProvider, Layout, Tabs } from '@arco-design/web-react';
import { useEditorProps, useFocusIdx } from 'easy-email-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import { SourceCodePanel } from '../SourceCodePanel';
import { BlockMjmlPanel } from '../BlockMjmlPanel';
import { AttributePanel } from '../AttributePanel';
import { BreadcrumbBar } from '../BreadcrumbBar';
import { BlockLayer, BlockLayerProps } from '../BlockLayer';
import { InteractivePrompt } from '../InteractivePrompt';
import styles from './index.module.scss';
import enUS from '@arco-design/web-react/es/locale/en-US';
import { MergeTagBadgePrompt } from '@extensions/MergeTagBadgePrompt';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';

// ─── Resize handle ─────────────────────────────────────────────────────────────

function ResizeHandle({ side, onResize }: {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
}) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      // For the left panel, dragging right = wider (positive delta)
      // For the right panel, dragging left = wider (negative delta → invert)
      onResize(side === 'left' ? delta : -delta);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [onResize, side]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        [side === 'left' ? 'right' : 'left']: -3,
        width: 6,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 20,
      }}
    >
      {/* Visible line on hover */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 2,
          width: 2,
          height: '100%',
          borderRadius: 1,
          transition: 'opacity 0.15s',
          opacity: 0,
          backgroundColor: 'var(--selected-color, #1890ff)',
        }}
        className={styles.resizeHandleLine}
      />
    </div>
  );
}

// ─── SimpleLayout ──────────────────────────────────────────────────────────────

const LEFT_MIN = 76;
const LEFT_DEFAULT = 316;
const LEFT_MAX = 480;
const RIGHT_MIN = 260;
const RIGHT_DEFAULT = 350;
const RIGHT_MAX = 500;

// Persist right sidebar collapsed state across SimpleLayout re-mounts
// (e.g., when editorKey changes on code mode exit). Resets on page navigation.
let _rightCollapsedPersist: boolean | null = null;

/** Reset persisted sidebar state — call when leaving the editor page */
export function resetSidebarState() {
  _rightCollapsedPersist = null;
}

export const SimpleLayout: React.FC<
  {
    showSourceCode?: boolean;
    jsonReadOnly?: boolean;
    mjmlReadOnly?: boolean;
    defaultShowLayer?: boolean;
    showBlockLayer?: boolean;
    hoverExpandSidebars?: boolean;
    blockMjmlPanel?: React.ReactNode;
    children: React.ReactNode | React.ReactElement;
  } & BlockLayerProps
> = props => {
  const { height: containerHeight } = useEditorProps();
  const { showSourceCode = true, defaultShowLayer = true, jsonReadOnly = false, mjmlReadOnly = true } = props;
  const showBlockLayer = props.showBlockLayer ?? false;
  const hoverExpand = props.hoverExpandSidebars ?? false;
  const { width: viewportWidth } = useWindowSize();
  const isNarrow = viewportWidth < 1280;

  const [collapsed, setCollapsed] = useState(() => showBlockLayer ? false : (!defaultShowLayer || isNarrow));
  const [layoutManuallyCollapsed, setLayoutManuallyCollapsed] = useState(false);
  const [leftHidden, setLeftHidden] = useState(!showBlockLayer);
  const [leftPeeking, setLeftPeeking] = useState(false);
  const leftPeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftCollapseHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rightCollapsed, _setRightCollapsed] = useState(() => _rightCollapsedPersist ?? isNarrow);
  const setRightCollapsed = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    _setRightCollapsed(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      _rightCollapsedPersist = next;
      return next;
    });
  }, []);
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);

  // Auto-expand right panel when a *different* block is focused
  const { focusIdx } = useFocusIdx();
  const prevFocusIdxRef = useRef(focusIdx);
  useEffect(() => {
    if (focusIdx && focusIdx !== prevFocusIdxRef.current) {
      setRightCollapsed(false);
    }
    prevFocusIdxRef.current = focusIdx;
  }, [focusIdx]);

  const onResizeLeft = useCallback((delta: number) => {
    setLeftWidth(w => Math.max(LEFT_MIN + 1, Math.min(LEFT_MAX, w + delta)));
  }, []);

  const onResizeRight = useCallback((delta: number) => {
    setRightWidth(w => Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, w + delta)));
  }, []);

  return (
    <ConfigProvider locale={enUS}>
      <Layout
        className={styles.SimpleLayout}
        style={{
          display: 'flex',
          width: '100%',
          overflow: 'hidden',
          minWidth: 960,
        }}
      >
        <Layout.Sider
          style={{
            paddingRight: 0,
            position: 'relative',
            display: (leftHidden || (showBlockLayer && layoutManuallyCollapsed)) ? 'none' : undefined,
          }}
          collapsed={collapsed}
          collapsible
          trigger={null}
          breakpoint='xl'
          collapsedWidth={0}
          width={leftWidth}
        >
          {showBlockLayer && (
            <Card
              bodyStyle={{ padding: 0 }}
              style={{ border: 'none' }}
            >
              <Card.Grid
                className={styles.customScrollBar}
                style={{
                  flex: 1,
                  paddingBottom: 50,
                  border: 'none',
                  height: containerHeight,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                }}
              >
                <Card
                  title={t('Layout')}
                  style={{ border: 'none' }}
                  headerStyle={{ height: 50 }}
                  extra={
                    <Button
                      size='mini'
                      icon={<IconLeft />}
                      onClick={() => setLayoutManuallyCollapsed(true)}
                      style={{ marginRight: 4 }}
                    />
                  }
                >
                  {!collapsed && <BlockLayer renderTitle={props.renderTitle} />}
                </Card>
              </Card.Grid>
            </Card>
          )}
          {!collapsed && <ResizeHandle side='left' onResize={onResizeLeft} />}
        </Layout.Sider>

        <Layout style={{ height: containerHeight, position: 'relative', overflow: 'hidden' }}>
          {/* Show expand tab when layout panel is manually collapsed */}
          {(showBlockLayer && layoutManuallyCollapsed) && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                cursor: 'pointer',
              }}
              onClick={() => setLayoutManuallyCollapsed(false)}
              onMouseEnter={() => {
                if (hoverExpand) {
                  leftCollapseHoverTimerRef.current = setTimeout(() => setLayoutManuallyCollapsed(false), 500);
                }
              }}
              onMouseLeave={() => {
                if (leftCollapseHoverTimerRef.current) { clearTimeout(leftCollapseHoverTimerRef.current); leftCollapseHoverTimerRef.current = null; }
              }}
              title={t('Show layout panel')}
            >
              <div style={{
                width: 12,
                height: 48,
                background: 'var(--selected-color, #1890ff)',
                borderRadius: '0 6px 6px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}>
                <IconRight style={{ color: '#fff', fontSize: 10 }} />
              </div>
            </div>
          )}
          {/* Flyout for layout panel when hidden */}
          {leftHidden && showBlockLayer && (
            <>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 12,
                  height: '100%',
                  zIndex: 100,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => {
                  leftPeekTimerRef.current = setTimeout(() => setLeftPeeking(true), 300);
                }}
                onMouseLeave={() => {
                  if (leftPeekTimerRef.current) clearTimeout(leftPeekTimerRef.current);
                }}
                onClick={() => { setLeftHidden(false); setLeftPeeking(false); }}
              >
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 12,
                  height: 48,
                  background: 'var(--selected-color, #1890ff)',
                  borderRadius: '0 6px 6px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  transition: 'opacity 0.15s',
                }}>
                  <IconRight style={{ color: '#fff', fontSize: 10 }} />
                </div>
              </div>
              {leftPeeking && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: 240,
                    height: '100%',
                    zIndex: 99,
                    background: '#fff',
                    boxShadow: '4px 0 16px rgba(0,0,0,0.15)',
                    borderRight: '1px solid #e5e7eb',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onMouseLeave={() => setLeftPeeking(false)}
                >
                  <Card
                    title={t('Layout')}
                    style={{ border: 'none', flex: 1 }}
                    headerStyle={{ height: 40 }}
                  >
                    <BlockLayer renderTitle={props.renderTitle} />
                  </Card>
                  <div style={{ padding: 8, textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                    <Button
                      size='small'
                      style={{ fontSize: 11 }}
                      onClick={() => { setLeftHidden(false); setLeftPeeking(false); }}
                    >
                      {t('Pin')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          {props.children}

          {/* Right sidebar expand tab — visible when sidebar is collapsed */}
          {rightCollapsed && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                cursor: 'pointer',
              }}
              onClick={() => setRightCollapsed(false)}
              onMouseEnter={() => {
                if (hoverExpand) {
                  rightHoverTimerRef.current = setTimeout(() => setRightCollapsed(false), 500);
                }
              }}
              onMouseLeave={() => {
                if (rightHoverTimerRef.current) { clearTimeout(rightHoverTimerRef.current); rightHoverTimerRef.current = null; }
              }}
              title={t('Show configuration panel')}
            >
              <div style={{
                width: 12,
                height: 48,
                background: 'var(--selected-color, #1890ff)',
                borderRadius: '6px 0 0 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}>
                <IconLeft style={{ color: '#fff', fontSize: 10 }} />
              </div>
            </div>
          )}
        </Layout>

        <Layout.Sider
          style={{
            height: containerHeight,
            minWidth: rightCollapsed ? 0 : RIGHT_MIN,
            maxWidth: rightCollapsed ? 0 : RIGHT_MAX,
            width: rightCollapsed ? 0 : rightWidth,
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
            zIndex: 20,
            display: rightCollapsed ? 'none' : undefined,
          }}
          className={styles.rightSide}
        >
          {!rightCollapsed && <ResizeHandle side='right' onResize={onResizeRight} />}
          {/* Always render AttributePanel so RichTextField stays mounted
              and listens for inline contenteditable edits in the shadow DOM.
              Hide visually when collapsed, but never unmount. */}
          <Card
            size='small'
            id='rightSide'
            style={{
              maxHeight: '100%',
              height: '100%',
              borderLeft: 'none',
            }}
            bodyStyle={{ padding: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
            className={styles.customScrollBarV2}
          >
            <Tabs
              className={styles.layoutTabs}
              extra={
                <Button
                  size='mini'
                  icon={<IconRight />}
                  onClick={() => setRightCollapsed(true)}
                  style={{ marginRight: 4 }}
                  title={t('Collapse panel')}
                />
              }
            >
              <Tabs.TabPane
                title={
                  <div style={{ height: 31, lineHeight: '31px' }}>
                    {t('Configuration')}
                  </div>
                }
              >
                <BreadcrumbBar />
                <AttributePanel />
              </Tabs.TabPane>
              <Tabs.TabPane
                destroyOnHide
                key='MJML'
                title={
                  <div style={{ height: 31, lineHeight: '31px' }}>
                    {t('MJML')}
                  </div>
                }
              >
                {props.blockMjmlPanel || <BlockMjmlPanel />}
              </Tabs.TabPane>
              {showSourceCode && (
                <Tabs.TabPane
                  destroyOnHide
                  key='Source code'
                  title={
                    <div style={{ height: 31, lineHeight: '31px' }}>
                      {t('Source code')}
                    </div>
                  }
                >
                  <SourceCodePanel jsonReadOnly={jsonReadOnly} mjmlReadOnly={mjmlReadOnly} />
                </Tabs.TabPane>
              )}
            </Tabs>
          </Card>
        </Layout.Sider>

        <InteractivePrompt />
        <MergeTagBadgePrompt />
      </Layout>
    </ConfigProvider>
  );
};
