import React, { useCallback, useEffect, useState } from 'react';
import Frame from '@demo/components/Frame';
import { Key, Trash2, Check, ExternalLink, Settings2, Plus, ArrowRightLeft } from 'lucide-react';
import { api } from '@demo/utils/api';
import { useAppSettings, DEFAULT_SPACER_COLOR, ExportFindReplaceRule } from '@demo/hooks/useAppSettings';

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

        {/* ── Insert Block Types ── */}
        <div className='mt-10 pt-8 border-t border-gray-200'>
          <h3 className='text-base font-semibold text-gray-900 mb-1 flex items-center gap-2'>
            <Plus size={18} />
            Insert Block Types
          </h3>
          <p className='text-sm text-gray-500 mb-4'>
            Choose which block types appear in the insert menu. Disabled blocks won&apos;t
            show in the &ldquo;Insert above&rdquo; and &ldquo;Insert below&rdquo; flyouts.
          </p>
          <div className='grid grid-cols-2 gap-2'>
            {[
              { type: 'text', label: 'Text' },
              { type: 'image', label: 'Image' },
              { type: 'button', label: 'Button' },
              { type: 'divider', label: 'Divider' },
              { type: 'spacer', label: 'Spacer' },
              { type: 'section', label: 'Section' },
              { type: 'wrapper', label: 'Container' },
              { type: 'column', label: 'Column' },
              { type: 'group', label: 'Group' },
              { type: 'hero', label: 'Hero' },
              { type: 'carousel', label: 'Carousel' },
              { type: 'navbar', label: 'Navbar' },
              { type: 'social', label: 'Social' },
              { type: 'table', label: 'Table' },
              { type: 'accordion', label: 'Accordion' },
              { type: 'raw', label: 'Raw HTML' },
            ].map(({ type, label }) => {
              const disabled = (appSettings.disabledBlockTypes || []).includes(type);
              return (
                <label key={type} className='flex items-center gap-2 cursor-pointer select-none py-1 px-2 rounded hover:bg-gray-50'>
                  <input
                    type='checkbox'
                    className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    checked={!disabled}
                    onChange={e => {
                      const current = appSettings.disabledBlockTypes || [];
                      const next = e.target.checked
                        ? current.filter(t => t !== type)
                        : [...current, type];
                      updateAppSettings({ disabledBlockTypes: next });
                    }}
                  />
                  <span className='text-sm text-gray-700'>{label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Export Find & Replace ── */}
        <div className='mt-10 pt-8 border-t border-gray-200'>
          <h3 className='text-base font-semibold text-gray-900 mb-1 flex items-center gap-2'>
            <ArrowRightLeft size={18} />
            Export Find &amp; Replace
          </h3>
          <p className='text-sm text-gray-500 mb-4'>
            String replacements applied when exporting HTML or MJML. Useful for swapping
            placeholder URLs, tracking parameters, or rewriting domains on export.
          </p>

          <div className='space-y-3'>
            {(appSettings.exportFindReplace || []).map((rule, i) => (
              <div key={i} className='flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md'>
                <div className='flex-1 min-w-0 space-y-2'>
                  <div className='flex gap-2'>
                    <div className='flex-1'>
                      <label className='block text-xs font-medium text-gray-500 mb-0.5'>Find</label>
                      <input
                        type='text'
                        className='form-input w-full text-sm border border-gray-300 rounded px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                        value={rule.find}
                        placeholder='String to find...'
                        onChange={e => {
                          const rules = [...(appSettings.exportFindReplace || [])];
                          rules[i] = { ...rules[i], find: e.target.value };
                          updateAppSettings({ exportFindReplace: rules });
                        }}
                      />
                    </div>
                    <div className='flex-1'>
                      <label className='block text-xs font-medium text-gray-500 mb-0.5'>Replace with</label>
                      <input
                        type='text'
                        className='form-input w-full text-sm border border-gray-300 rounded px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                        value={rule.replace}
                        placeholder='Replacement...'
                        onChange={e => {
                          const rules = [...(appSettings.exportFindReplace || [])];
                          rules[i] = { ...rules[i], replace: e.target.value };
                          updateAppSettings({ exportFindReplace: rules });
                        }}
                      />
                    </div>
                  </div>
                  <div className='flex items-center gap-4'>
                    <div className='flex items-center gap-2'>
                      <label className='text-xs text-gray-500'>Apply to:</label>
                      <select
                        className='text-xs border border-gray-300 rounded px-1.5 py-1 bg-white focus:ring-2 focus:ring-blue-500 outline-none'
                        value={rule.applyTo}
                        onChange={e => {
                          const rules = [...(appSettings.exportFindReplace || [])];
                          rules[i] = { ...rules[i], applyTo: e.target.value as 'html' | 'mjml' | 'both' };
                          updateAppSettings({ exportFindReplace: rules });
                        }}
                      >
                        <option value='both'>Both</option>
                        <option value='html'>HTML only</option>
                        <option value='mjml'>MJML only</option>
                      </select>
                    </div>
                    <label className='flex items-center gap-1.5 cursor-pointer select-none'>
                      <input
                        type='checkbox'
                        className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                        checked={!!rule.useRegex}
                        onChange={e => {
                          const rules = [...(appSettings.exportFindReplace || [])];
                          rules[i] = { ...rules[i], useRegex: e.target.checked };
                          updateAppSettings({ exportFindReplace: rules });
                        }}
                      />
                      <span className='text-xs text-gray-500'>Regex</span>
                    </label>
                  </div>
                </div>
                <button
                  className='p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-4'
                  onClick={() => {
                    const rules = [...(appSettings.exportFindReplace || [])];
                    rules.splice(i, 1);
                    updateAppSettings({ exportFindReplace: rules });
                  }}
                  title='Remove rule'
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors'
              onClick={() => {
                const rules = [...(appSettings.exportFindReplace || []), { find: '', replace: '', applyTo: 'both' as const }];
                updateAppSettings({ exportFindReplace: rules });
              }}
            >
              <Plus size={14} />
              Add rule
            </button>
          </div>
        </div>
      </div>
    </Frame>
  );
}
