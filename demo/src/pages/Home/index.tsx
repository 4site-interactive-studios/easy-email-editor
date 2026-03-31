import { useAppSelector } from '@demo/hooks/useAppSelector';
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Frame from '@demo/components/Frame';
import templateList from '@demo/store/templateList';
import { Plus, Search, X, FileCode } from 'lucide-react';
import { CardItem } from './components/CardItem';
import { history } from '@demo/utils/history';
import templates from '@demo/config/templates.json';
import { getTemplate } from '@demo/config/getTemplate';
import { generateThumbnail } from '@demo/utils/generateThumbnail';
import { IBlockData } from 'easy-email-core';
import { nowUnix } from '@demo/utils/time';
import { MjmlToJson } from 'easy-email-extensions';
import { api } from '@demo/utils/api';
import { IArticle } from '@demo/services/article';

const THUMB_CACHE_KEY = 'template_thumbnail_cache';

function readThumbCache(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(THUMB_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

export default function Home() {
  const dispatch = useDispatch();
  const list = useAppSelector('templateList');
  const [search, setSearch] = useState('');
  const [thumbs, setThumbs] = useState<Record<number, string>>(readThumbCache);
  const [presence, setPresence] = useState<Record<string, any[]>>({});

  // Import MJML modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [mjmlSource, setMjmlSource] = useState('');
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    dispatch(templateList.actions.fetch(undefined));
  }, [dispatch]);

  // Poll for presence (who's editing) and template list updates every 5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/presence');
        if (res.ok) setPresence(await res.json());
      } catch {}
      // Re-fetch template list so titles/thumbnails update
      dispatch(templateList.actions.fetch(undefined));
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [dispatch]);

  // Generate thumbnails for built-in templates that aren't cached yet
  useEffect(() => {
    const cache = readThumbCache();

    templates.forEach(async t => {
      if (cache[t.article_id]) return;
      try {
        const data = await getTemplate(t.article_id);
        if (!data) return;
        const content =
          typeof data.content === 'string'
            ? JSON.parse(data.content)
            : typeof data.content.content === 'string'
              ? JSON.parse(data.content.content)
              : data.content;
        const picture = await generateThumbnail(content as IBlockData);
        cache[t.article_id] = picture;
        localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(cache));
        setThumbs({ ...cache });
      } catch {
        // ignore
      }
    });
  }, []);

  // Generate thumbnails for saved templates that don't have one yet
  useEffect(() => {
    if (!list.length) return;

    list.forEach(async item => {
      if (item.picture) return;
      try {
        const raw = await api.getById(item.article_id);
        if (!raw) return;
        const content = JSON.parse(raw.content.content) as IBlockData;
        const picture = await generateThumbnail(content);
        const latest = await api.getById(item.article_id);
        if (latest) {
          await api.save({ ...latest, picture });
        }
        dispatch(templateList.actions.fetch(undefined));
      } catch {
        // ignore
      }
    });
  }, [list, dispatch]);

  const handleImport = useCallback(async () => {
    const name = importName.trim();
    const source = mjmlSource.trim();
    if (!name || !source) return;

    setImportError('');
    setImporting(true);

    try {
      // Parse MJML into block tree
      const content = MjmlToJson(source);

      // Save to localStorage
      const id = api.generateId();
      const now = nowUnix();
      const article: IArticle = {
        article_id: id,
        title: name,
        summary: '',
        picture: '',
        content: {
          article_id: id,
          content: JSON.stringify(content),
        },
        user_id: 0,
        category_id: 0,
        tags: [],
        secret: 0,
        readcount: 0,
        level: 0,
        created_at: now,
        updated_at: now,
      };
      await api.save(article);

      // Generate thumbnail in background
      generateThumbnail(content as any)
        .then(async picture => {
          const latest = await api.getById(id);
          if (latest) await api.save({ ...latest, picture });
          dispatch(templateList.actions.fetch(undefined));
        })
        .catch(() => {});

      // Reset modal and navigate to editor
      setShowImportModal(false);
      setMjmlSource('');
      setImportName('');
      history.push(`/editor?id=${id}`);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to parse MJML. Check your markup and try again.');
    } finally {
      setImporting(false);
    }
  }, [importName, mjmlSource, dispatch]);

  const filteredList = search.trim()
    ? list.filter(item =>
        item.title.toLowerCase().includes(search.toLowerCase()),
      )
    : list;

  return (
    <Frame
      title='My Emails'
      primaryAction={
        <div className='flex items-center gap-2'>
          <button
            className='inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
            onClick={() => {
              setShowImportModal(true);
              setImportError('');
              setMjmlSource('');
              setImportName('');
            }}
          >
            <FileCode size={16} />
            Import MJML
          </button>
          <button
            className='inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors'
            onClick={() => history.push('/editor')}
          >
            <Plus size={16} />
            New Email
          </button>
        </div>
      }
    >
      <>
        {/* Search */}
        <div className='relative max-w-xs mb-5'>
          <Search
            size={16}
            className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'
          />
          <input
            type='text'
            className='form-input w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
            placeholder='Search emails…'
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5'
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Saved emails */}
        {filteredList.length === 0 ? (
          <div className='py-10 text-center'>
            <div className='text-gray-400 text-5xl mb-3'>
              {search.trim() ? '🔍' : '📧'}
            </div>
            <p className='text-gray-500 text-base font-medium'>
              {search.trim()
                ? `No emails matching "${search}"`
                : 'No emails yet'}
            </p>
            {!search.trim() && (
              <>
                <p className='text-gray-400 text-sm mt-1 mb-4'>
                  Start from scratch, import MJML, or pick a template below
                </p>
                <div className='flex items-center justify-center gap-2'>
                  <button
                    className='inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                    onClick={() => {
                      setShowImportModal(true);
                      setImportError('');
                      setMjmlSource('');
                      setImportName('');
                    }}
                  >
                    <FileCode size={16} />
                    Import MJML
                  </button>
                  <button
                    className='inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors'
                    onClick={() => history.push('/editor')}
                  >
                    <Plus size={16} />
                    New Email
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className='flex flex-wrap gap-5 mb-2'>
            {filteredList.map(item => (
              <CardItem data={item} key={item.article_id} activeUsers={presence[String(item.article_id)]} />
            ))}
          </div>
        )}

        {/* Built-in templates */}
        {templates.length > 0 && (
          <>
            <div className='flex items-center gap-4 my-7'>
              <hr className='flex-1 border-gray-200' />
              <span className='text-gray-400 text-xs font-medium uppercase tracking-wide whitespace-nowrap'>
                Start from a template
              </span>
              <hr className='flex-1 border-gray-200' />
            </div>
            <div className='flex flex-wrap gap-5'>
              {templates.map(item => (
                <CardItem
                  data={{
                    ...(item as any),
                    picture: thumbs[item.article_id] || (item as any).picture,
                  }}
                  key={item.article_id}
                  isBuiltIn
                  activeUsers={presence[String(item.article_id)]}
                />
              ))}
            </div>
          </>
        )}

        {/* Import MJML modal */}
        {showImportModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* Backdrop */}
            <div
              className='absolute inset-0 bg-black/30'
              onClick={() => setShowImportModal(false)}
            />
            {/* Panel */}
            <div className='relative w-full max-w-2xl bg-white rounded-lg shadow-xl p-6'>
              <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                Import from MJML
              </h3>

              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    Email name
                  </label>
                  <input
                    type='text'
                    className='form-input w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                    placeholder='My imported email'
                    value={importName}
                    onChange={e => setImportName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    MJML source
                  </label>
                  <textarea
                    className='form-input w-full text-sm border border-gray-300 rounded-md px-3 py-2 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y'
                    rows={14}
                    placeholder={'<mjml>\n  <mj-body>\n    <mj-section>\n      <mj-column>\n        <mj-text>Hello world</mj-text>\n      </mj-column>\n    </mj-section>\n  </mj-body>\n</mjml>'}
                    value={mjmlSource}
                    onChange={e => {
                      setMjmlSource(e.target.value);
                      setImportError('');
                    }}
                  />
                </div>

                {importError && (
                  <div className='text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2'>
                    {importError}
                  </div>
                )}
              </div>

              <div className='flex justify-end gap-2 mt-5'>
                <button
                  className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors'
                  onClick={() => setShowImportModal(false)}
                >
                  Cancel
                </button>
                <button
                  className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  disabled={!importName.trim() || !mjmlSource.trim() || importing}
                  onClick={handleImport}
                >
                  {importing ? 'Importing…' : 'Import & Edit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </Frame>
  );
}
