import { Button, ConfigProvider, Layout, Tabs } from '@arco-design/web-react';
import { useEditorProps, useFocusIdx } from 'easy-email-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
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
const SIDEBAR_DEFAULT = 300;
const SIDEBAR_MAX = 900;
const LAYOUT_COL_MIN = 120;
const LAYOUT_COL_DEFAULT = 150;

// ─── SimpleLayout ──────────────────────────────────────────────────────────────

// ─── Sidebar preference persistence ───────────────────────────────────────────

const SIDEBAR_PREFS_KEY = 'mjml-editor-sidebar-prefs';

interface SidebarPrefs {
  sidebarWidth: number;
  layoutColumnWidth: number;
  showLayoutColumn: boolean;
}

function loadSidebarPrefs(): SidebarPrefs | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_PREFS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSidebarPrefs(prefs: SidebarPrefs) {
  try {
    localStorage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

export const SimpleLayout: React.FC<
  {
    defaultShowLayer?: boolean;
    showBlockLayer?: boolean;
    blockMjmlPanel?: React.ReactNode;
    children: React.ReactNode | React.ReactElement;
  } & BlockLayerProps
> = props => {
  const { height: containerHeight } = useEditorProps();
  const { width: viewportWidth } = useWindowSize();
  const isWide = viewportWidth > 1300;

  const savedPrefs = useRef(loadSidebarPrefs()).current;
  const initShowLayout = savedPrefs ? savedPrefs.showLayoutColumn : isWide;
  const initSidebarWidth = savedPrefs ? savedPrefs.sidebarWidth : (isWide ? SIDEBAR_DEFAULT + LAYOUT_COL_DEFAULT + 6 : SIDEBAR_DEFAULT);
  const initLayoutColWidth = savedPrefs ? savedPrefs.layoutColumnWidth : LAYOUT_COL_DEFAULT;

  const [sidebarHidden, setSidebarHidden] = useState(true);
  const [showLayoutColumn, setShowLayoutColumn] = useState(initShowLayout);
  const [sidebarWidth, setSidebarWidth] = useState(initSidebarWidth);
  const [layoutColumnWidth, setLayoutColumnWidth] = useState(initLayoutColWidth);

  const [autoCollapse, setAutoCollapse] = useState(true);

  const { focusIdx } = useFocusIdx();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSidebarPrefs({ sidebarWidth, layoutColumnWidth, showLayoutColumn });
    }, 300);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [sidebarWidth, layoutColumnWidth, showLayoutColumn]);

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
          minWidth: 0,
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
            borderTop: '1px solid #e5e7eb',
            boxShadow: 'none',
          }}
          width={sidebarWidth}
        >
          <div
            className={styles.customScrollBar}
            style={{ display: 'flex', height: '100%', position: 'relative', overflowY: 'auto', overflowX: 'hidden' }}
          >
            {/* Column 1: Layout tree */}
            {showLayoutColumn && (
              <div
                style={{
                  width: layoutColumnWidth,
                  flexShrink: 0,
                  minHeight: '100%',
                  borderRight: '1px solid #e5e7eb',
                }}
              >
                <Tabs
                  className={styles.layoutTabs}
                  extra={
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 10, color: '#6b7280', marginRight: 4 }}
                      title={autoCollapse ? t('Auto-collapse is on — unfocused sections collapse') : t('Auto-collapse is off — all sections stay expanded')}
                    >
                      <div style={{ position: 'relative', width: 24, height: 14 }}>
                        <input
                          type='checkbox'
                          checked={autoCollapse}
                          onChange={e => setAutoCollapse(e.target.checked)}
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        <div style={{
                          width: 24, height: 14, borderRadius: 7,
                          background: autoCollapse ? '#3b82f6' : '#d1d5db',
                          transition: 'background 0.15s',
                        }} />
                        <div style={{
                          position: 'absolute', top: 2, left: autoCollapse ? 12 : 2,
                          width: 10, height: 10, borderRadius: '50%',
                          background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          transition: 'left 0.15s',
                        }} />
                      </div>
                      <span style={{ userSelect: 'none', whiteSpace: 'nowrap' }}>{t('Focus')}</span>
                    </label>
                  }
                >
                  <Tabs.TabPane
                    title={
                      <div style={{ height: 31, lineHeight: '31px' }}>
                        {t('Layout')}
                      </div>
                    }
                  >
                    <BlockLayer renderTitle={props.renderTitle} autoCollapse={autoCollapse} />
                  </Tabs.TabPane>
                </Tabs>
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
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ flex: 1 }}>
                <Tabs
                  className={styles.layoutTabs}
                  extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 11, color: '#6b7280' }} title={showLayoutColumn ? t('Hide layout tree') : t('Show layout tree')}>
                        <div style={{ position: 'relative', width: 28, height: 16 }}>
                          <input
                            type='checkbox'
                            checked={showLayoutColumn}
                            onChange={e => {
                              const show = e.target.checked;
                              setShowLayoutColumn(show);
                              // Adjust sidebar width to keep config column proportional
                              setSidebarWidth(w => show
                                ? Math.min(SIDEBAR_MAX, w + layoutColumnWidth + 6)
                                : Math.max(SIDEBAR_MIN, w - layoutColumnWidth - 6)
                              );
                            }}
                            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                          />
                          <div style={{
                            width: 28, height: 16, borderRadius: 8,
                            background: showLayoutColumn ? '#3b82f6' : '#d1d5db',
                            transition: 'background 0.15s',
                          }} />
                          <div style={{
                            position: 'absolute', top: 2, left: showLayoutColumn ? 14 : 2,
                            width: 12, height: 12, borderRadius: '50%',
                            background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            transition: 'left 0.15s',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, userSelect: 'none' }}>{t('Layout')}</span>
                      </label>
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
                </Tabs>
              </div>
            </div>
          </div>

          {/* Outer resize handle (right edge of entire sidebar) */}
          <ResizeHandle side='left' onResize={onResizeSidebar} />
        </Layout.Sider>

        {/* ── Central content area ── */}
        <Layout
          style={{ height: containerHeight, position: 'relative', overflow: 'hidden' }}
          onDoubleClick={() => { if (sidebarHidden) setSidebarHidden(false); }}
        >
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
