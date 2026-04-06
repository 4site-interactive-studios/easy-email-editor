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

// ─── Resize handle (reused for outer edge + inner column divider) ───────────

function ResizeHandle({ side, onResize, inner }: {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
  inner?: boolean; // inner = between columns (not positioned absolute to edge)
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

  if (inner) {
    // Inner divider between columns — inline flow, not absolute
    return (
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 6,
          flexShrink: 0,
          cursor: 'col-resize',
          position: 'relative',
          zIndex: 5,
        }}
      >
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

// ─── Constants ──────────────────────────────────────────────────────────────────

const SIDEBAR_MIN = 300;
const SIDEBAR_DEFAULT = 600;
const SIDEBAR_MAX = 900;
const LAYOUT_COL_MIN = 150;
const LAYOUT_COL_DEFAULT = 220;

// ─── SimpleLayout ──────────────────────────────────────────────────────────────

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
  const { showSourceCode = true, jsonReadOnly = false, mjmlReadOnly = true } = props;
  const hoverExpand = props.hoverExpandSidebars ?? false;
  const { width: viewportWidth } = useWindowSize();
  const isNarrow = viewportWidth < 1280;

  // Sidebar states
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(isNarrow ? SIDEBAR_MIN : SIDEBAR_DEFAULT);
  const [showLayoutColumn, setShowLayoutColumn] = useState(props.showBlockLayer ?? true);
  const [layoutColumnWidth, setLayoutColumnWidth] = useState(LAYOUT_COL_DEFAULT);
  const sidebarHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-expand sidebar when a different block is focused
  const { focusIdx } = useFocusIdx();
  const prevFocusIdxRef = useRef(focusIdx);
  useEffect(() => {
    if (focusIdx && focusIdx !== prevFocusIdxRef.current) {
      setSidebarHidden(false);
    }
    prevFocusIdxRef.current = focusIdx;
  }, [focusIdx]);

  const onResizeSidebar = useCallback((delta: number) => {
    setSidebarWidth(w => Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + delta)));
  }, []);

  const onResizeLayoutColumn = useCallback((delta: number) => {
    setLayoutColumnWidth(w => {
      const newW = w + delta;
      return Math.max(LAYOUT_COL_MIN, Math.min(sidebarWidth - 200, newW));
    });
  }, [sidebarWidth]);

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
        {/* ── Combined sidebar: Layout column + Config/MJML tabs ── */}
        <Layout.Sider
          style={{
            height: containerHeight,
            position: 'relative',
            display: sidebarHidden ? 'none' : undefined,
            flexShrink: 0,
            overflow: 'hidden',
          }}
          width={sidebarWidth}
        >
          <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
            {/* Column 1: Layout tree */}
            {showLayoutColumn && (
              <div
                className={styles.customScrollBar}
                style={{
                  width: layoutColumnWidth,
                  flexShrink: 0,
                  height: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  borderRight: '1px solid #e5e7eb',
                }}
              >
                <Card
                  title={t('Layout')}
                  style={{ border: 'none' }}
                  headerStyle={{ height: 40, padding: '0 8px' }}
                  bodyStyle={{ padding: 0 }}
                  extra={
                    <Button
                      size='mini'
                      icon={<IconLeft />}
                      onClick={() => setShowLayoutColumn(false)}
                      title={t('Hide layout')}
                    />
                  }
                >
                  <BlockLayer renderTitle={props.renderTitle} />
                </Card>
              </div>
            )}

            {/* Inner resize handle between columns */}
            {showLayoutColumn && (
              <ResizeHandle side='left' onResize={onResizeLayoutColumn} inner />
            )}

            {/* Column 2: Configuration + MJML tabs */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Card
                size='small'
                style={{ height: '100%', border: 'none' }}
                bodyStyle={{ padding: 0, height: '100%', overflowY: 'auto', overflowX: 'hidden' }}
                className={styles.customScrollBarV2}
              >
                <Tabs
                  className={styles.layoutTabs}
                  extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 4 }}>
                      {!showLayoutColumn && (
                        <Button
                          size='mini'
                          icon={<IconLeft />}
                          onClick={() => setShowLayoutColumn(true)}
                          title={t('Show layout')}
                        />
                      )}
                      <Button
                        size='mini'
                        icon={<IconLeft />}
                        onClick={() => setSidebarHidden(true)}
                        title={t('Collapse sidebar')}
                      />
                    </div>
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
            </div>
          </div>

          {/* Outer resize handle (right edge of entire sidebar) */}
          <ResizeHandle side='left' onResize={onResizeSidebar} />
        </Layout.Sider>

        {/* ── Central content area ── */}
        <Layout style={{ height: containerHeight, position: 'relative', overflow: 'hidden' }}>
          {/* Sidebar expand tab — visible when sidebar is hidden */}
          {sidebarHidden && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 100,
                cursor: 'pointer',
              }}
              onClick={() => setSidebarHidden(false)}
              onMouseEnter={() => {
                if (hoverExpand) {
                  sidebarHoverTimerRef.current = setTimeout(() => setSidebarHidden(false), 500);
                }
              }}
              onMouseLeave={() => {
                if (sidebarHoverTimerRef.current) { clearTimeout(sidebarHoverTimerRef.current); sidebarHoverTimerRef.current = null; }
              }}
              title={t('Show sidebar')}
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

          {props.children}
        </Layout>

        <InteractivePrompt />
        <MergeTagBadgePrompt />
      </Layout>
    </ConfigProvider>
  );
};
