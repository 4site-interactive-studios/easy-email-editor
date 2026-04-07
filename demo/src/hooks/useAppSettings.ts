import { useState, useCallback, useEffect } from 'react';

const SETTINGS_KEY = 'easy-email-app-settings';

export interface ExportFindReplaceRule {
  find: string;
  replace: string;
  applyTo: 'html' | 'mjml' | 'both';
  useRegex?: boolean;
}

export interface AppSettings {
  multiUserEnabled: boolean;
  hideEditorMetadata: boolean;
  showSpacerIndicator: boolean;
  spacerIndicatorColor: string;
  autoSaveEnabled: boolean;
  exportFindReplace: ExportFindReplaceRule[];
  disabledBlockTypes: string[];
}

const DEFAULT_SPACER_COLOR = '147, 197, 253';

const defaults: AppSettings = {
  multiUserEnabled: false,
  hideEditorMetadata: false,
  showSpacerIndicator: true,
  spacerIndicatorColor: DEFAULT_SPACER_COLOR,
  autoSaveEnabled: true,
  exportFindReplace: [],
  disabledBlockTypes: [],
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

/**
 * Apply export find/replace rules to a string.
 * @param content - The string to transform
 * @param format - 'html' or 'mjml' — controls which rules apply
 */
export function applyExportFindReplace(content: string, format: 'html' | 'mjml'): string {
  const rules = currentSettings.exportFindReplace;
  if (!rules || rules.length === 0) return content;
  let result = content;
  for (const rule of rules) {
    if (!rule.find) continue;
    if (rule.applyTo !== 'both' && rule.applyTo !== format) continue;
    try {
      const pattern = rule.useRegex
        ? new RegExp(rule.find, 'g')
        : new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(pattern, rule.replace);
    } catch {
      // Skip invalid regex patterns
    }
  }
  return result;
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
