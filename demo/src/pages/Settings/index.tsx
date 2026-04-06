import React, { useCallback, useEffect, useState } from 'react';
import Frame from '@demo/components/Frame';
import { Key, Trash2, Check, ExternalLink, Settings2 } from 'lucide-react';
import { api } from '@demo/utils/api';
import { useAppSettings, DEFAULT_SPACER_COLOR } from '@demo/hooks/useAppSettings';

/** Convert "r, g, b" string to "#rrggbb" hex */
function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
  if (parts.length !== 3 || parts.some(isNaN)) return '#93c5fd';
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
}

/** Convert "#rrggbb" hex to "r, g, b" string */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<{ configured: boolean; masked: string }>({ configured: false, masked: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [appSettings, updateAppSettings] = useAppSettings();

  useEffect(() => {
    api.getApiKeyStatus().then(setStatus).catch(() => {});
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.setApiKey(apiKey.trim());
      setStatus(await api.getApiKeyStatus());
      setApiKey('');
      setMessage({ type: 'success', text: 'API key saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save API key.' });
    } finally {
      setSaving(false);
    }
  }, [apiKey]);

  const handleRemove = useCallback(async () => {
    try {
      await api.removeApiKey();
      setStatus({ configured: false, masked: '' });
      setMessage({ type: 'success', text: 'API key removed.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to remove API key.' });
    }
  }, []);

  return (
    <Frame title='Settings' primaryAction={<span />}>
      <div className='max-w-xl'>
        <h3 className='text-base font-semibold text-gray-900 mb-1 flex items-center gap-2'>
          <Key size={18} />
          Anthropic API Key
        </h3>
        <p className='text-sm text-gray-500 mb-4'>
          Required for the "Fix with AI" feature in the validation report.
          Your key is stored on the server and used to call the Claude API.
          {' '}
          <a
            href='https://console.anthropic.com/settings/keys'
            target='_blank'
            rel='noopener noreferrer'
            className='text-blue-600 hover:underline inline-flex items-center gap-0.5'
          >
            Get an API key <ExternalLink size={12} />
          </a>
        </p>

        {status.configured && (
          <div className='flex items-center gap-3 mb-4 p-3 bg-green-50 border border-green-200 rounded-md'>
            <Check size={16} className='text-green-600 shrink-0' />
            <div className='flex-1 min-w-0'>
              <span className='text-sm font-medium text-green-800'>API key configured</span>
              <span className='text-sm text-green-600 ml-2 font-mono'>{status.masked}</span>
            </div>
            <button
              className='p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors'
              onClick={handleRemove}
              title='Remove API key'
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <div className='flex gap-2'>
          <input
            type='password'
            className='form-input flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono'
            placeholder={status.configured ? 'Enter new key to replace...' : 'sk-ant-api03-...'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {message && (
          <div className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {message.text}
          </div>
        )}

        {/* ── UI Preferences ── */}
        <div className='mt-10 pt-8 border-t border-gray-200'>
          <h3 className='text-base font-semibold text-gray-900 mb-1 flex items-center gap-2'>
            <Settings2 size={18} />
            UI Preferences
          </h3>
          <p className='text-sm text-gray-500 mb-4'>
            Customize the editor layout and appearance.
          </p>

          <div className='space-y-4'>
            <label className='flex items-center gap-3 cursor-pointer select-none group'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={appSettings.multiUserEnabled}
                  onChange={e => updateAppSettings({ multiUserEnabled: e.target.checked })}
                />
                <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors' />
                <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4' />
              </div>
              <div>
                <span className='text-sm font-medium text-gray-700 group-hover:text-gray-900'>
                  Multi-user editing
                </span>
                <span className='block text-xs text-gray-400'>
                  Show collaborator cursors, presence indicators, and real-time syncing
                </span>
              </div>
            </label>

            <label className='flex items-center gap-3 cursor-pointer select-none group'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={appSettings.moveOutEnabled}
                  onChange={e => updateAppSettings({ moveOutEnabled: e.target.checked })}
                />
                <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors' />
                <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4' />
              </div>
              <div>
                <span className='text-sm font-medium text-gray-700 group-hover:text-gray-900'>
                  Move out of container
                </span>
                <span className='block text-xs text-gray-400'>
                  Show a button to move blocks out of their parent container
                </span>
              </div>
            </label>

            <label className='flex items-center gap-3 cursor-pointer select-none group'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={appSettings.moveInEnabled}
                  onChange={e => updateAppSettings({ moveInEnabled: e.target.checked })}
                />
                <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors' />
                <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4' />
              </div>
              <div>
                <span className='text-sm font-medium text-gray-700 group-hover:text-gray-900'>
                  Move into container
                </span>
                <span className='block text-xs text-gray-400'>
                  Show a button to move blocks into adjacent sibling containers
                </span>
              </div>
            </label>

            <label className='flex items-center gap-3 cursor-pointer select-none group'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={appSettings.hideEditorMetadata}
                  onChange={e => updateAppSettings({ hideEditorMetadata: e.target.checked })}
                />
                <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors' />
                <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4' />
              </div>
              <div>
                <span className='text-sm font-medium text-gray-700 group-hover:text-gray-900'>
                  Hide editor metadata in MJML
                </span>
                <span className='block text-xs text-gray-400'>
                  Strip internal mj-html-attributes tags when viewing or exporting MJML source
                </span>
              </div>
            </label>

            <label className='flex items-center gap-3 cursor-pointer select-none group'>
              <div className='relative'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={appSettings.showSpacerIndicator}
                  onChange={e => updateAppSettings({ showSpacerIndicator: e.target.checked })}
                />
                <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-blue-600 transition-colors' />
                <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4' />
              </div>
              <div className='flex-1'>
                <span className='text-sm font-medium text-gray-700 group-hover:text-gray-900'>
                  Highlight spacers
                </span>
                <span className='block text-xs text-gray-400'>
                  Show diagonal stripes on spacer blocks in the visual editor
                </span>
              </div>
              {appSettings.showSpacerIndicator && (
                <div className='flex items-center gap-2 ml-2'>
                  <input
                    type='color'
                    value={rgbToHex(appSettings.spacerIndicatorColor)}
                    onChange={e => updateAppSettings({ spacerIndicatorColor: hexToRgb(e.target.value) })}
                    className='w-7 h-7 rounded border border-gray-300 cursor-pointer p-0'
                    title='Spacer highlight color'
                  />
                  {appSettings.spacerIndicatorColor !== DEFAULT_SPACER_COLOR && (
                    <button
                      className='text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap'
                      onClick={e => { e.preventDefault(); updateAppSettings({ spacerIndicatorColor: DEFAULT_SPACER_COLOR }); }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
            </label>
          </div>
        </div>
      </div>
    </Frame>
  );
}
