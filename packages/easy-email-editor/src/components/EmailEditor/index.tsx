import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { Stack } from '../UI/Stack';
import { ToolsPanel } from './components/ToolsPanel';
import { createPortal } from 'react-dom';
import { EASY_EMAIL_EDITOR_ID, FIXED_CONTAINER_ID } from '@/constants';
import { useActiveTab } from '@/hooks/useActiveTab';
import { ActiveTabKeys } from '../Provider/BlocksProvider';
import { DesktopEmailPreview } from './components/DesktopEmailPreview';
import { MobileEmailPreview } from './components/MobileEmailPreview';
import { EditEmailPreview } from './components/EditEmailPreview';
import { IconFont } from '../IconFont';
import { TabPane, Tabs } from '@/components/UI/Tabs';
import { useEditorProps } from '@/hooks/useEditorProps';
import { useEditorContext } from '@/hooks/useEditorContext';
import './index.scss';
import '@/assets/font/iconfont.css';
import { EventManager, EventType } from '@/utils/EventManager';

(window as any).global = window; // react-codemirror

export const EmailEditor = () => {
  const { height: containerHeight } = useEditorProps();
  const { setActiveTab, activeTab } = useActiveTab();
  const { pageData } = useEditorContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const userOverrideRef = useRef(false);

  // Auto-switch to mobile view when container is narrower than the email width.
  // Only auto-switch when the user hasn't manually picked a tab. Reset the
  // override when the container transitions back to wide (choice becomes viable).
  const wasNarrowRef = useRef(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const emailWidth = parseInt(pageData?.attributes?.width || '600', 10);
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      if (width <= 0) return;
      const isNarrow = width < emailWidth;
      if (isNarrow && !wasNarrowRef.current) {
        // Transitioned to narrow — auto-switch unless user overrode
        wasNarrowRef.current = true;
        if (!userOverrideRef.current) {
          setActiveTab(ActiveTabKeys.MOBILE);
        }
      } else if (!isNarrow && wasNarrowRef.current) {
        // Transitioned to wide — reset override, restore desktop
        wasNarrowRef.current = false;
        userOverrideRef.current = false;
        setActiveTab(ActiveTabKeys.EDIT);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageData?.attributes?.width, setActiveTab]);

  const fixedContainer = useMemo(() => {
    return createPortal(<div id={FIXED_CONTAINER_ID} />, document.body);
  }, []);

  const onBeforeChangeTab = useCallback((currentTab: any, nextTab: any) => {
    return EventManager.exec(EventType.ACTIVE_TAB_CHANGE, { currentTab, nextTab });
  }, []);

  const onChangeTab = useCallback((nextTab: string) => {
    userOverrideRef.current = true;
    setActiveTab(nextTab as any);
  }, [setActiveTab]);

  return useMemo(
    () => (
      <div
        ref={containerRef}
        id={EASY_EMAIL_EDITOR_ID}
        style={{
          display: 'flex',
          flex: '1',
          overflow: 'hidden',
          justifyContent: 'center',
          minWidth: 0,
          height: containerHeight,
        }}
      >
        <Tabs
          activeTab={activeTab}
          onBeforeChange={onBeforeChangeTab}
          onChange={onChangeTab}
          style={{ height: '100%', width: '100%' }}
          tabBarExtraContent={<ToolsPanel />}
        >
          <TabPane
            style={{ height: 'calc(100% - 50px)' }}
            tab={(
              <Stack spacing='tight'>
                <IconFont iconName='icon-editor' />
              </Stack>
            )}
            key={ActiveTabKeys.EDIT}
          >
            <EditEmailPreview />
          </TabPane>
          <TabPane
            style={{ height: 'calc(100% - 50px)' }}
            tab={(
              <Stack spacing='tight'>
                <IconFont iconName='icon-mobile' />
              </Stack>
            )}
            key={ActiveTabKeys.MOBILE}
          >
            <MobileEmailPreview />
          </TabPane>
        </Tabs>
        <>{fixedContainer}</>
      </div>
    ),
    [activeTab, containerHeight, fixedContainer, onBeforeChangeTab, onChangeTab]
  );
};
