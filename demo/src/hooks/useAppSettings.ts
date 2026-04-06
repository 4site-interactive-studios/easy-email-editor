import { useState, useCallback, useEffect } from 'react';

const SETTINGS_KEY = 'easy-email-app-settings';

export interface AppSettings {
  multiUserEnabled: boolean;
  moveOutEnabled: boolean;
  moveInEnabled: boolean;
  hideEditorMetadata: boolean;
  showSpacerIndicator: boolean;
  spacerIndicatorColor: string;
  hoverExpandSidebars: boolean;
  autoSaveEnabled: boolean;
}

const DEFAULT_SPACER_COLOR = '147, 197, 253';

const defaults: AppSettings = {
  multiUserEnabled: false,
  moveOutEnabled: false,
  moveInEnabled: false,
  hideEditorMetadata: false,
  showSpacerIndicator: true,
  spacerIndicatorColor: DEFAULT_SPACER_COLOR,
  hoverExpandSidebars: true,
  autoSaveEnabled: true,
};

export { DEFAULT_SPACER_COLOR };

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
  }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Static listeners so all hook instances stay in sync
const listeners = new Set<(s: AppSettings) => void>();
let currentSettings = loadSettings();

function notify() {
  listeners.forEach(fn => fn(currentSettings));
}

export function getAppSettings(): AppSettings {
  return currentSettings;
}

export function useAppSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    const handler = (s: AppSettings) => setSettings({ ...s });
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    currentSettings = { ...currentSettings, ...patch };
    saveSettings(currentSettings);
    notify();
  }, []);

  return [settings, update];
}
