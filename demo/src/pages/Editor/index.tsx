/* eslint-disable react/jsx-wrap-multilines */
import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import template from '@demo/store/template';
import { useAppSelector } from '@demo/hooks/useAppSelector';
import { useLoading } from '@demo/hooks/useLoading';
import { ConfigProvider, Message } from '@arco-design/web-react';
import { Dialog, Transition, Menu as HMenu } from '@headlessui/react';
import {
  ArrowLeft, Download, Copy, ChevronDown,
  AlertTriangle, CheckCircle, X, History, RotateCcw, Check,
  Code, Eye, FileCode, StickyNote,
} from 'lucide-react';
import { useQuery } from '@demo/hooks/useQuery';
import { useHistory, Prompt } from 'react-router-dom';
import { cloneDeep } from 'lodash';
import { Loading } from '@demo/components/loading';
import { getTemplate } from '@demo/config/getTemplate';
import { generateThumbnail } from '@demo/utils/generateThumbnail';
import { api, Revision } from '@demo/utils/api';
import { MjmlCodeEditor } from '@demo/components/MjmlCodeEditor';
import { MjmlToJson } from 'easy-email-extensions';
import { IArticle } from '@demo/services/article';
import { FormApi } from 'final-form';
import { nowUnix, timeAgo } from '@demo/utils/time';
import { downloadFile } from '@demo/utils/download';
import { useCollaboration, ContentPatch } from '@demo/hooks/useCollaboration';
import { AvatarBar } from '@demo/components/AvatarBar';
import { getUserIdentity } from '@demo/utils/user-identity';
import { RemoteCursors } from '@demo/components/RemoteCursors';

import {
  EmailEditor,
  useFocusIdx,
  EmailEditorProvider,
  IEmailTemplate,
} from 'easy-email-editor';

import { AdvancedType, IBlockData, JsonToMjml } from 'easy-email-core';
import { ExtensionProps, SimpleLayout } from 'easy-email-extensions';

import 'easy-email-editor/lib/style.css';
import 'easy-email-extensions/lib/style.css';
import blueTheme from '@arco-themes/react-easy-email-theme/css/arco.css?inline';

import enUS from '@arco-design/web-react/es/locale/en-US';
import { useWindowSize } from 'react-use';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Write an IEmailTemplate to the server database. */
async function saveTemplate(articleId: number, values: IEmailTemplate): Promise<void> {
  const now = nowUnix();
  const article: IArticle = {
    article_id: articleId,
    title: values.subject || 'Untitled',
    summary: values.subTitle || '',
    picture: '',
    content: {
      article_id: articleId,
      content: JSON.stringify(values.content),
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
}

/** Generate thumbnail in background and patch into the database. */
function generateThumbnailInBackground(articleId: number, content: IBlockData): void {
  generateThumbnail(content)
    .then(async picture => {
      const latest = await api.getById(articleId);
      if (latest) await api.save({ ...latest, picture });
    })
    .catch(() => {});
}

/**
 * Read the CURRENT form values, guaranteed fresh.
 * Blurs active elements (including shadow DOM contenteditable), waits for
 * all debounces to flush (500ms), then reads formApi.getState().values.
 */
function readFormValuesAfterFlush(formApi: FormApi<IEmailTemplate>): Promise<IEmailTemplate> {
  (document.activeElement as HTMLElement)?.blur?.();
  try {
    const editorRoot = document.getElementById('VisualEditorEditMode');
    const shadowActive = editorRoot?.shadowRoot?.activeElement as HTMLElement | null;
    shadowActive?.blur?.();
  } catch {}
  return new Promise(resolve => {
    setTimeout(() => resolve(formApi.getState().values), 500);
  });
}

// ─── Config ────────────────────────────────────────────────────────────────────

const defaultFontList = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: 'Helvetica Neue' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Tahoma', label: 'Tahoma' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS' },
  { value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", label: 'Segoe UI' },
  { value: 'Roboto, Arial, sans-serif', label: 'Roboto' },
  { value: "'Open Sans', Arial, sans-serif", label: 'Open Sans' },
  { value: 'Lato, Arial, sans-serif', label: 'Lato' },
  { value: "'Source Sans Pro', Arial, sans-serif", label: 'Source Sans Pro' },
  { value: 'Montserrat, Arial, sans-serif', label: 'Montserrat' },
  { value: 'Raleway, Arial, sans-serif', label: 'Raleway' },
  { value: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif", label: 'Lucida Sans' },
];

const defaultCategories: ExtensionProps['categories'] = [
  {
    label: 'Content', active: true,
    blocks: [
      { type: AdvancedType.TEXT }, { type: AdvancedType.IMAGE },
      { type: AdvancedType.BUTTON }, { type: AdvancedType.DIVIDER },
      { type: AdvancedType.SPACER }, { type: AdvancedType.SOCIAL },
      { type: AdvancedType.NAVBAR }, { type: AdvancedType.TABLE },
    ],
  },
  {
    label: 'Layout', active: true, displayType: 'column',
    blocks: [
      { title: '2 columns', payload: [['50%','50%'],['33%','67%'],['67%','33%'],['25%','75%'],['75%','25%']] },
      { title: '3 columns', payload: [['33.33%','33.33%','33.33%'],['25%','25%','50%'],['50%','25%','25%']] },
      { title: '4 columns', payload: [['25%','25%','25%','25%']] },
    ],
  },
  {
    label: 'Interactive', active: true,
    blocks: [
      { type: AdvancedType.HERO }, { type: AdvancedType.ACCORDION }, { type: AdvancedType.CAROUSEL },
    ],
  },
  {
    label: 'Structure', active: true,
    blocks: [
      { type: AdvancedType.WRAPPER }, { type: AdvancedType.SECTION },
      { type: AdvancedType.GROUP }, { type: AdvancedType.COLUMN },
    ],
  },
];

// ─── Editor ────────────────────────────────────────────────────────────────────

/** Renders inside EmailEditorProvider to sync focus + text cursor ↔ collaboration. */
function CollaborationSync({ collab }: { collab: ReturnType<typeof useCollaboration> }) {
  const { focusIdx } = useFocusIdx();
  const prevIdx = useRef('');

  useEffect(() => {
    if (!collab.connected) return;
    if (focusIdx === prevIdx.current) return;

    if (prevIdx.current) collab.unlockBlock(prevIdx.current);
    if (focusIdx) {
      collab.sendCursor(focusIdx);
      collab.lockBlock(focusIdx);
    } else {
      collab.sendCursor('');
    }
    prevIdx.current = focusIdx;
  }, [focusIdx, collab]);

  // Track text cursor position within contenteditable (shadow DOM)
  useEffect(() => {
    if (!collab.connected) return;
    const editorRoot = document.getElementById('VisualEditorEditMode');
    const shadowRoot = editorRoot?.shadowRoot;
    if (!shadowRoot) return;

    const handleSelection = () => {
      const sel = shadowRoot.getSelection ? (shadowRoot as any).getSelection() : document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!range.collapsed) return; // Only track caret, not selections

      // Find which contenteditable this is in
      let node = range.startContainer as HTMLElement;
      while (node && !node.getAttribute?.('data-content_editable-idx')) {
        node = node.parentElement as HTMLElement;
      }
      if (!node) return;

      const blockIdx = node.getAttribute('data-content_editable-idx');
      if (!blockIdx) return;

      // Calculate offset within the contenteditable's text content
      const treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
      let offset = 0;
      let nodeIndex = 0;
      while (treeWalker.nextNode()) {
        if (treeWalker.currentNode === range.startContainer) {
          offset += range.startOffset;
          break;
        }
        offset += (treeWalker.currentNode as Text).length;
        nodeIndex++;
      }

      collab.sendTextCursor({ focusIdx: blockIdx, offset, nodeIndex });
    };

    // selectionchange fires on the document, not the shadow root
    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [collab]);

  return null;
}

export default function Editor() {
  const dispatch = useDispatch();
  const history = useHistory();
  const templateData = useAppSelector('template');
  const { width } = useWindowSize();
  const compact = width > 1280;
  const { id } = useQuery();
  const loading = useLoading(template.loadings.fetchById);

  const [savedArticleId, setSavedArticleId] = useState<number | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number>(0); // unix seconds
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, setTick] = useState(0); // forces re-render for live tooltip
  const thumbnailBackfilled = useRef(false);

  // MJML validation
  const [validationErrors, setValidationErrors] = useState<Array<{ line: number; message: string; tagName: string; formattedMessage: string }>>([]);
  const [showValidation, setShowValidation] = useState(false);
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Revision history
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Code mode
  const [codeMode, setCodeMode] = useState(false);
  const [showCursors, setShowCursors] = useState(true);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [codeMjml, setCodeMjml] = useState('');
  const codeMjmlRef = useRef('');
  const [editorKey, setEditorKey] = useState(0);
  const [showCodeModeConfirm, setShowCodeModeConfirm] = useState(false);

  // Autosave refs
  const formApiRef = useRef<FormApi<IEmailTemplate> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const lastScheduledContentRef = useRef<string>('');
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastContentRef = useRef<string>('');
  const applyingRemotePatchRef = useRef(false);
  const prevFocusIdxRef = useRef<string>('');
  const currentUserIdRef = useRef<string>(getUserIdentity().userId);

  // ── Collaboration callbacks (defined before the hook) ──
  const onCollabContentUpdate = useCallback((patch: ContentPatch) => {
    if (!formApiRef.current) return;
    // Apply the patch directly to the form state — no database round-trip
    applyingRemotePatchRef.current = true;
    formApiRef.current.change(patch.path as any, patch.value);
    // Update refs so this change doesn't trigger our own broadcast or autosave
    const contentJson = JSON.stringify(formApiRef.current.getState().values.content);
    lastSavedContentRef.current = contentJson;
    lastScheduledContentRef.current = contentJson;
    lastBroadcastContentRef.current = contentJson;
    applyingRemotePatchRef.current = false;
  }, []);

  const onCollabCodeModeEntered = useCallback(() => {
    if (!formApiRef.current) return;
    const values = formApiRef.current.getState().values;
    const mjml = JsonToMjml({
      data: values.content,
      mode: 'production',
      context: values.content,
      beautify: true,
    });
    setCodeMjml(mjml);
    codeMjmlRef.current = mjml;
    setCodeMode(true);
  }, []);

  const onCollabCodeModeExited = useCallback((content: string, userId: string) => {
    if (!formApiRef.current) return;
    if (userId === currentUserIdRef.current) return;
    try {
      const parsed = MjmlToJson(content);
      dispatch(template.actions.set({ ...formApiRef.current.getState().values, content: parsed as any }));
      setCodeMode(false);
      setEditorKey(k => k + 1);
    } catch {}
  }, [dispatch]);

  const collab = useCollaboration(
    savedArticleId ? String(savedArticleId) : null,
    onCollabContentUpdate,
    onCollabCodeModeEntered,
    onCollabCodeModeExited,
  );

  currentUserIdRef.current = collab.currentUser.userId;

  // ── Tick every second for live "saved X seconds ago" tooltip ──
  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // ── Core save function (used by both autosave and manual save) ──
  const performSave = useCallback(async (articleId: number, values: IEmailTemplate, label: string) => {
    try {
      const contentJson = JSON.stringify(values.content);
      await saveTemplate(articleId, values);
      await api.addRevision(articleId, {
        timestamp: nowUnix(),
        label,
        content: contentJson,
        subject: values.subject || '',
        note: '',
      });
      lastSavedContentRef.current = contentJson;
      lastScheduledContentRef.current = contentJson;
      setLastSavedAt(nowUnix());
      setSaveError(null);
      generateThumbnailInBackground(articleId, values.content as any);
    } catch (err: any) {
      setSaveError(err?.message || 'Save failed');
    }
  }, []);

  // ── Autosave — called from render prop debounce ──
  const autosave = useCallback((articleId: number, values: IEmailTemplate) => {
    performSave(articleId, values, 'Auto-saved');
  }, [performSave]);

  // ── MJML validation ──
  const runValidation = useCallback(async (content: IBlockData) => {
    try {
      const mjml = (await import('mjml-browser')).default;
      const mjmlStr = JsonToMjml({ data: content, mode: 'production', context: content });
      const result = mjml(mjmlStr, { validationLevel: 'soft' });
      setValidationErrors(result.errors || []);
    } catch {
      setValidationErrors([{ line: 0, message: 'MJML failed to compile', tagName: 'mjml', formattedMessage: 'The template could not be compiled.' }]);
    }
  }, []);

  // ── Load template ──
  useEffect(() => {
    if (id) {
      dispatch(template.actions.fetchById({ id: +id }));
      getTemplate(+id).then(builtIn => {
        if (!builtIn) setSavedArticleId(+id);
      });
    } else {
      dispatch(template.actions.fetchDefaultTemplate(undefined));
    }
    return () => {
      dispatch(template.actions.set(null));
    };
  }, [dispatch, id]);

  // ── Clean up timers on unmount ──
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
      if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
    };
  }, []);

  // ── Warn on browser close/refresh if there are pending unsaved changes ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Check if there are unsaved changes by comparing current content to last saved
      if (!formApiRef.current) return;
      const currentContent = JSON.stringify(formApiRef.current.getState().values.content);
      if (currentContent !== lastSavedContentRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Initialize lastSavedContentRef when template loads ──
  useEffect(() => {
    if (templateData?.content) {
      lastSavedContentRef.current = JSON.stringify(templateData.content);
    }
  }, [templateData]);

  // ── Backfill thumbnail ──
  useEffect(() => {
    if (!savedArticleId || !templateData || thumbnailBackfilled.current) return;
    (async () => {
      const existing = await api.getById(savedArticleId);
      if (existing && !existing.picture) {
        thumbnailBackfilled.current = true;
        generateThumbnailInBackground(savedArticleId, templateData.content as any);
      }
    })();
  }, [savedArticleId, templateData]);

  const initialValues: IEmailTemplate | null = useMemo(() => {
    if (!templateData) return null;
    return { ...templateData, content: cloneDeep(templateData.content) as IBlockData };
  }, [templateData]);

  // ── Manual save (existing template) ──
  const handleSave = useCallback(async () => {
    if (!formApiRef.current) return;
    if (!savedArticleId) {
      const vals = formApiRef.current.getState().values;
      setTemplateName(vals.subject || '');
      setShowNameModal(true);
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const values = await readFormValuesAfterFlush(formApiRef.current);
    performSave(savedArticleId, values, 'Manual save');
  }, [savedArticleId, performSave]);

  // ── First save (name modal confirmed) ──
  const handleNameConfirm = useCallback(async () => {
    if (!formApiRef.current || !templateName.trim()) return;
    setShowNameModal(false);
    const values = await readFormValuesAfterFlush(formApiRef.current);
    const newId = api.generateId();
    const namedValues = { ...values, subject: templateName.trim() };
    performSave(newId, namedValues, 'Manual save');
    setSavedArticleId(newId);
    history.replace(`/editor?id=${newId}`);
  }, [history, templateName, performSave]);

  // ── Restore revision ──
  const handleRestore = useCallback(async (rev: Revision) => {
    if (!savedArticleId || !formApiRef.current) return;
    // Save current state as a "before restore" revision
    const currentValues = formApiRef.current.getState().values;
    const currentContentJson = JSON.stringify(currentValues.content);
    await api.addRevision(savedArticleId, {
      timestamp: nowUnix(),
      label: 'Before restore',
      content: currentContentJson,
      subject: currentValues.subject || '',
      note: '',
    });
    // Apply the restored content to localStorage
    const restoredContent = JSON.parse(rev.content);
    const restoredValues: IEmailTemplate = {
      ...currentValues,
      content: restoredContent,
      subject: rev.subject || currentValues.subject,
    };
    await saveTemplate(savedArticleId, restoredValues);
    // Add "Restored" revision
    await api.addRevision(savedArticleId, {
      timestamp: nowUnix(),
      label: 'Restored from revision',
      content: rev.content,
      subject: rev.subject,
      note: '',
    });
    lastSavedContentRef.current = rev.content;
    // Reload the editor
    setShowHistory(false);
    dispatch(template.actions.fetchById({ id: savedArticleId }));
    Message.success(`Restored to version from ${timeAgo(rev.timestamp)}`);
  }, [savedArticleId, dispatch]);

  // ── Export ──
  const compileToHtml = useCallback(async (): Promise<string | null> => {
    if (!formApiRef.current) return null;
    const values = formApiRef.current.getState().values;
    const mjml = (await import('mjml-browser')).default;
    const mjmlStr = JsonToMjml({ data: values.content, mode: 'production', context: values.content });
    return mjml(mjmlStr, { validationLevel: 'skip' }).html;
  }, []);

  const handleExportHtml = useCallback(async () => {
    try {
      const html = await compileToHtml();
      if (!html) return;
      const subject = formApiRef.current?.getState().values.subject || 'email';
      downloadFile(html, `${subject}.html`, 'text/html');
    } catch {
      Message.error('Export failed.');
    }
  }, [compileToHtml]);

  const handleCopyHtml = useCallback(async () => {
    try {
      const html = await compileToHtml();
      if (!html) return;
      await navigator.clipboard.writeText(html);
      Message.success('HTML copied to clipboard.');
    } catch {
      Message.error('Copy failed.');
    }
  }, [compileToHtml]);

  // ── Code mode ──
  const enterCodeMode = useCallback(() => {
    if (!formApiRef.current) return;
    const otherUsers = collab.roomUsers.filter(u => u.userId !== collab.currentUser.userId);
    if (otherUsers.length > 0) {
      // Others are present — need consensus
      setShowCodeModeConfirm(true);
    } else {
      // Alone — enter directly
      const values = formApiRef.current.getState().values;
      const mjml = JsonToMjml({
        data: values.content,
        mode: 'production',
        context: values.content,
        beautify: true,
      });
      setCodeMjml(mjml);
      codeMjmlRef.current = mjml;
      setCodeMode(true);
    }
  }, [collab.roomUsers, collab.currentUser.userId]);

  const exitCodeMode = useCallback(() => {
    if (!formApiRef.current) return;
    const currentMjml = codeMjmlRef.current;
    try {
      const parsed = MjmlToJson(currentMjml);
      const values = formApiRef.current.getState().values;
      const newTemplate: IEmailTemplate = {
        ...values,
        content: parsed as any,
      };

      // Persist to localStorage if saved
      if (savedArticleId) {
        saveTemplate(savedArticleId, newTemplate);
        lastSavedContentRef.current = JSON.stringify(parsed);
      }

      // Update Redux store and bump key to re-mount provider
      dispatch(template.actions.set(newTemplate));
      setCodeMode(false);
      setEditorKey(k => k + 1);

      // Broadcast to other users
      collab.exitCodeMode(currentMjml);
    } catch (err: any) {
      Message.error('Invalid MJML — fix errors before switching to visual mode');
    }
  }, [savedArticleId, dispatch]);

  const handleCodeMjmlChange = useCallback((mjml: string) => {
    codeMjmlRef.current = mjml;
  }, []);

  const handleExportMjml = useCallback(() => {
    const mjml = codeMode
      ? codeMjmlRef.current
      : formApiRef.current
        ? JsonToMjml({ data: formApiRef.current.getState().values.content, mode: 'production', context: formApiRef.current.getState().values.content, beautify: true })
        : '';
    if (!mjml) return;
    const subject = formApiRef.current?.getState().values.subject || 'email';
    downloadFile(mjml, `${subject}.mjml`, 'text/xml');
  }, [codeMode]);

  // ── Loading ──
  if (!templateData && loading) {
    return (
      <Loading loading={loading}>
        <div style={{ height: '100vh' }} />
      </Loading>
    );
  }
  if (!initialValues) return null;

  return (
    <ConfigProvider locale={enUS}>
      <div>
        <style>{blueTheme}</style>

        <EmailEditorProvider
          key={editorKey}
          height={'calc(100vh - 52px)'}
          data={initialValues}
          onSubmit={() => {}}
          dashed={false}
          compact={compact}
          fontList={defaultFontList}
        >
          {({ values }, helper) => {
            formApiRef.current = helper;

            // ── Real-time broadcast (300ms debounce) ──
            // Batches rapid keystrokes into single updates to reduce partial-render flicker.
            // The 300ms window lets the editor's internal debounces (200-300ms) settle so
            // each broadcast contains the fully-formed text, not intermediate states.
            const contentJson = JSON.stringify(values.content);
            if (savedArticleId && !applyingRemotePatchRef.current && contentJson !== lastBroadcastContentRef.current) {
              lastBroadcastContentRef.current = contentJson;
              if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
              broadcastTimerRef.current = setTimeout(() => {
                collab.sendContentChange({ path: 'content', value: values.content, timestamp: Date.now() });
              }, 300);
            }

            // ── Autosave to database (2s debounce) ──
            if (savedArticleId && contentJson !== lastSavedContentRef.current && contentJson !== lastScheduledContentRef.current) {
              lastScheduledContentRef.current = contentJson;
              if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
              autosaveTimerRef.current = setTimeout(() => {
                if (formApiRef.current) {
                  const freshValues = formApiRef.current.getState().values;
                  autosave(savedArticleId, freshValues);
                }
              }, 2000);
            }

            // ── Validation debounce (1s) ──
            if (validationTimerRef.current) clearTimeout(validationTimerRef.current);
            validationTimerRef.current = setTimeout(() => {
              runValidation(values.content as any);
            }, 1000);

            const errorCount = validationErrors.length;
            const hasErrors = errorCount > 0;
            const isDirty = savedArticleId
              ? contentJson !== lastSavedContentRef.current
              : true;

            // Save status for tooltip
            const savedSecondsAgo = lastSavedAt ? Math.max(0, nowUnix() - lastSavedAt) : -1;
            const savedTooltip = saveError
              ? `Save failed: ${saveError}`
              : savedSecondsAgo < 0
                ? 'Not yet saved'
                : !isDirty
                  ? 'All changes saved'
                  : savedSecondsAgo < 5
                    ? 'Saved just now'
                    : savedSecondsAgo < 60
                      ? `Last saved ${savedSecondsAgo}s ago`
                      : `Last saved ${Math.floor(savedSecondsAgo / 60)}m ago`;

            return (
              <>
                <Prompt
                  when={isDirty}
                  message='You have unsaved changes. Are you sure you want to leave?'
                />

                {/* Header */}
                <header className='flex items-center justify-between px-5 py-1.5 bg-white border-b border-gray-200'>
                  <div className='flex items-center gap-3'>
                    <button
                      className='p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors'
                      onClick={() => history.push('/')}
                      title='Back to dashboard'
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <input
                      type='text'
                      className='form-input w-64 text-sm font-semibold border border-transparent rounded px-2 py-1.5 hover:border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors'
                      value={values.subject}
                      placeholder='Untitled email'
                      onChange={e => helper.change('subject', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    />
                    {/* Avatars */}
                    <AvatarBar
                      currentUser={collab.currentUser}
                      roomUsers={collab.roomUsers}
                      connected={collab.connected}
                      onUpdateIdentity={collab.updateIdentity}
                    />
                  </div>

                  <div className='flex items-center gap-2'>
                    {/* Save status */}
                    {!savedArticleId ? (
                      <button
                        className='px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors'
                        onClick={handleSave}
                      >
                        Save
                      </button>
                    ) : (
                      <span className='relative group inline-flex items-center'>
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium cursor-default ${
                            saveError ? 'text-amber-600' : 'text-green-600'
                          }`}
                        >
                          {saveError ? (
                            <><AlertTriangle size={14} /> Save failed</>
                          ) : (
                            <><Check size={14} /> Saved</>
                          )}
                        </span>
                        <span className='pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 text-xs font-medium text-white bg-gray-800 rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50'>
                          {savedTooltip}
                        </span>
                      </span>
                    )}

                    {/* Validation */}
                    <button
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                        hasErrors
                          ? 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                          : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                      }`}
                      onClick={() => setShowValidation(true)}
                      title='MJML validation report'
                    >
                      {hasErrors ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                      {hasErrors ? `${errorCount} issue${errorCount > 1 ? 's' : ''}` : 'Valid'}
                    </button>

                    {/* History */}
                    {savedArticleId && (
                      <button
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'
                        onClick={() => {
                          api.getRevisions(savedArticleId).then(setRevisions);
                          setShowHistory(true);
                        }}
                        title='Revision history'
                      >
                        <History size={14} />
                        History
                      </button>
                    )}

                    {/* Export */}
                    <HMenu as='div' className='relative'>
                      <HMenu.Button className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors'>
                        <Download size={14} />
                        Export
                        <ChevronDown size={12} />
                      </HMenu.Button>
                      <Transition as={Fragment} enter='transition ease-out duration-100' enterFrom='transform opacity-0 scale-95' enterTo='transform opacity-100 scale-100' leave='transition ease-in duration-75' leaveFrom='transform opacity-100 scale-100' leaveTo='transform opacity-0 scale-95'>
                        <HMenu.Items className='absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg ring-1 ring-black/5 focus:outline-none z-50'>
                          <div className='py-1'>
                            <HMenu.Item>
                              {({ active }) => (
                                <button className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700`} onClick={handleExportHtml}>
                                  <Download size={14} /> Download .html file
                                </button>
                              )}
                            </HMenu.Item>
                            <HMenu.Item>
                              {({ active }) => (
                                <button className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700`} onClick={handleCopyHtml}>
                                  <Copy size={14} /> Copy HTML to clipboard
                                </button>
                              )}
                            </HMenu.Item>
                            <HMenu.Item>
                              {({ active }) => (
                                <button className={`${active ? 'bg-gray-100' : ''} flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700`} onClick={handleExportMjml}>
                                  <FileCode size={14} /> Download .mjml file
                                </button>
                              )}
                            </HMenu.Item>
                          </div>
                        </HMenu.Items>
                      </Transition>
                    </HMenu>

                    {/* Mode toggle */}
                    <div className='inline-flex rounded-md border border-gray-300 overflow-hidden'>
                      <button
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                          !codeMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => codeMode && exitCodeMode()}
                        title='Visual editor'
                      >
                        <Eye size={14} />
                        Visual
                      </button>
                      <button
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                          codeMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => !codeMode && enterCodeMode()}
                        title='MJML code editor'
                      >
                        <Code size={14} />
                        Code
                      </button>
                    </div>
                  </div>
                </header>

                <CollaborationSync collab={collab} />
                {codeMode ? (
                  <MjmlCodeEditor
                    mjmlString={codeMjml}
                    onMjmlChange={handleCodeMjmlChange}
                    height='calc(100vh - 52px)'
                  />
                ) : (
                  <div ref={editorContainerRef as any} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                    <SimpleLayout showSourceCode={false}>
                      <EmailEditor />
                    </SimpleLayout>
                    <RemoteCursors
                      remoteCursors={collab.remoteCursors}
                      lockedBlocks={collab.lockedBlocks}
                      remoteMousePositions={collab.remoteMousePositions}
                      remoteTextCursors={collab.remoteTextCursors}
                      currentUserId={collab.currentUser.userId}
                      roomUsers={collab.roomUsers}
                      showCursors={showCursors}
                      onToggleCursors={() => setShowCursors(v => !v)}
                      editorContainerRef={editorContainerRef as any}
                      onMouseMove={(x, y) => collab.sendMousePosition(x, y)}
                    />
                  </div>
                )}
              </>
            );
          }}
        </EmailEditorProvider>

        {/* ── Name modal ── */}
        <Transition appear show={showNameModal} as={Fragment}>
          <Dialog as='div' className='relative z-50' onClose={() => setShowNameModal(false)}>
            <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0' enterTo='opacity-100' leave='ease-in duration-150' leaveFrom='opacity-100' leaveTo='opacity-0'>
              <div className='fixed inset-0 bg-black/30' />
            </Transition.Child>
            <div className='fixed inset-0 flex items-center justify-center p-4'>
              <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0 scale-95' enterTo='opacity-100 scale-100' leave='ease-in duration-150' leaveFrom='opacity-100 scale-100' leaveTo='opacity-0 scale-95'>
                <Dialog.Panel className='w-full max-w-md bg-white rounded-lg shadow-xl p-6'>
                  <Dialog.Title className='text-lg font-semibold text-gray-900 mb-4'>Name your email</Dialog.Title>
                  <input
                    type='text'
                    className='form-input w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                    placeholder='Enter a name for this email'
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleNameConfirm()}
                    autoFocus
                  />
                  <div className='flex justify-end gap-2 mt-5'>
                    <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors' onClick={() => setShowNameModal(false)}>Cancel</button>
                    <button className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed' disabled={!templateName.trim()} onClick={handleNameConfirm}>Save</button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* ── Validation report ── */}
        <Transition appear show={showValidation} as={Fragment}>
          <Dialog as='div' className='relative z-50' onClose={() => setShowValidation(false)}>
            <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0' enterTo='opacity-100' leave='ease-in duration-150' leaveFrom='opacity-100' leaveTo='opacity-0'>
              <div className='fixed inset-0 bg-black/30' />
            </Transition.Child>
            <div className='fixed inset-0 flex items-center justify-center p-4'>
              <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0 scale-95' enterTo='opacity-100 scale-100' leave='ease-in duration-150' leaveFrom='opacity-100 scale-100' leaveTo='opacity-0 scale-95'>
                <Dialog.Panel className='w-full max-w-lg bg-white rounded-lg shadow-xl'>
                  <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                    <Dialog.Title className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                      {validationErrors.length > 0 ? <><AlertTriangle size={18} className='text-amber-500' /> Validation Report</> : <><CheckCircle size={18} className='text-green-500' /> Validation Report</>}
                    </Dialog.Title>
                    <button className='p-1 text-gray-400 hover:text-gray-600 rounded transition-colors' onClick={() => setShowValidation(false)}><X size={18} /></button>
                  </div>
                  <div className='px-6 py-4 max-h-[60vh] overflow-y-auto'>
                    {validationErrors.length === 0 ? (
                      <div className='py-8 text-center'>
                        <CheckCircle size={40} className='text-green-400 mx-auto mb-3' />
                        <p className='text-gray-600 font-medium'>No issues found</p>
                        <p className='text-gray-400 text-sm mt-1'>Your email passes MJML validation</p>
                      </div>
                    ) : (
                      <div className='space-y-3'>
                        <p className='text-sm text-gray-500'>{validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''} found:</p>
                        {validationErrors.map((err, i) => (
                          <div key={i} className='flex gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md'>
                            <AlertTriangle size={16} className='text-amber-500 mt-0.5 shrink-0' />
                            <div className='min-w-0'>
                              <p className='text-sm text-gray-800'>{err.formattedMessage || err.message}</p>
                              <div className='flex gap-3 mt-1 text-xs text-gray-500'>
                                {err.tagName && <span className='font-mono bg-gray-100 px-1.5 py-0.5 rounded'>{'<'}mj-{err.tagName}{'>'}</span>}
                                {err.line > 0 && <span>Line {err.line}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className='flex justify-end px-6 py-3 border-t border-gray-200'>
                    <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors' onClick={() => setShowValidation(false)}>Close</button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>

        {/* ── Revision history ── */}
        <Transition appear show={showHistory} as={Fragment}>
          <Dialog as='div' className='relative z-50' onClose={() => setShowHistory(false)}>
            <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0' enterTo='opacity-100' leave='ease-in duration-150' leaveFrom='opacity-100' leaveTo='opacity-0'>
              <div className='fixed inset-0 bg-black/30' />
            </Transition.Child>
            <div className='fixed inset-0 flex items-center justify-center p-4'>
              <Transition.Child as={Fragment} enter='ease-out duration-200' enterFrom='opacity-0 scale-95' enterTo='opacity-100 scale-100' leave='ease-in duration-150' leaveFrom='opacity-100 scale-100' leaveTo='opacity-0 scale-95'>
                <Dialog.Panel className='w-full max-w-lg bg-white rounded-lg shadow-xl'>
                  <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                    <Dialog.Title className='text-lg font-semibold text-gray-900 flex items-center gap-2'>
                      <History size={18} /> Revision History
                    </Dialog.Title>
                    <button className='p-1 text-gray-400 hover:text-gray-600 rounded transition-colors' onClick={() => setShowHistory(false)}><X size={18} /></button>
                  </div>

                  <div className='px-6 py-4 max-h-[60vh] overflow-y-auto'>
                    {revisions.length === 0 ? (
                      <div className='py-8 text-center'>
                        <History size={40} className='text-gray-300 mx-auto mb-3' />
                        <p className='text-gray-500 font-medium'>No revisions yet</p>
                        <p className='text-gray-400 text-sm mt-1'>Changes will be tracked automatically as you edit</p>
                      </div>
                    ) : (
                      <div className='space-y-2'>
                        {revisions.map((rev, i) => {
                          const isCurrent = i === 0;
                          const isEditingNote = editingNoteId === rev.id;
                          return (
                            <div
                              key={rev.id}
                              className={`p-3 rounded-md border transition-colors ${
                                isCurrent
                                  ? 'border-blue-300 bg-blue-50/50 ring-1 ring-blue-200'
                                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              <div className='flex items-center gap-3'>
                                <span className='text-xs font-mono text-gray-400 w-6 text-right shrink-0'>#{rev.id}</span>
                                <div className={`w-2 h-2 rounded-full shrink-0 ${
                                  rev.label === 'Manual save' ? 'bg-blue-500'
                                    : rev.label === 'Restored from revision' ? 'bg-purple-500'
                                      : rev.label === 'Before restore' ? 'bg-orange-400'
                                        : 'bg-gray-400'
                                }`} />
                                <div className='flex-1 min-w-0'>
                                  <div className='flex items-center gap-2'>
                                    <span className='text-sm font-medium text-gray-800'>{rev.label}</span>
                                    {isCurrent && (
                                      <span className='text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded'>Current</span>
                                    )}
                                    <span className='text-xs text-gray-400'>{timeAgo(rev.timestamp)}</span>
                                  </div>
                                  {rev.subject && (
                                    <p className='text-xs text-gray-500 truncate mt-0.5'>"{rev.subject}"</p>
                                  )}
                                </div>
                                <div className='flex items-center gap-1 shrink-0'>
                                  <button
                                    className='p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors'
                                    title={rev.note ? 'Edit note' : 'Add note'}
                                    onClick={() => {
                                      if (isEditingNote) {
                                        setEditingNoteId(null);
                                      } else {
                                        setEditingNoteId(rev.id);
                                        setEditingNoteText(rev.note || '');
                                      }
                                    }}
                                  >
                                    <StickyNote size={13} className={rev.note ? 'text-amber-500' : ''} />
                                  </button>
                                  {!isCurrent && (
                                    <button
                                      className='inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors'
                                      onClick={() => handleRestore(rev)}
                                    >
                                      <RotateCcw size={12} />
                                      Restore
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Note display */}
                              {rev.note && !isEditingNote && (
                                <p className='text-xs text-gray-600 mt-2 ml-9 pl-3 border-l-2 border-amber-200 italic'>{rev.note}</p>
                              )}
                              {/* Note editor */}
                              {isEditingNote && (
                                <div className='mt-2 ml-9 flex gap-1.5'>
                                  <input
                                    type='text'
                                    className='flex-1 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none'
                                    placeholder='Add a note about this revision…'
                                    value={editingNoteText}
                                    onChange={e => setEditingNoteText(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && savedArticleId) {
                                        api.updateRevisionNote(rev.id, editingNoteText);
                                        api.getRevisions(savedArticleId).then(setRevisions);
                                        setEditingNoteId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingNoteId(null);
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    className='px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors'
                                    onClick={() => {
                                      if (savedArticleId) {
                                        api.updateRevisionNote(rev.id, editingNoteText);
                                        api.getRevisions(savedArticleId).then(setRevisions);
                                        setEditingNoteId(null);
                                      }
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className='px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors'
                                    onClick={() => setEditingNoteId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className='flex justify-end px-6 py-3 border-t border-gray-200'>
                    <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors' onClick={() => setShowHistory(false)}>Close</button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition>
        {/* ── Code mode consensus: my proposal confirmation ── */}
        {showCodeModeConfirm && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <div className='absolute inset-0 bg-black/30' onClick={() => setShowCodeModeConfirm(false)} />
            <div className='relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Switch to Code Mode?</h3>
              <p className='text-sm text-gray-600 mb-4'>
                This will switch <strong>all {collab.roomUsers.length - 1} other editor{collab.roomUsers.length > 2 ? 's' : ''}</strong> to code view and unlock all blocks. They will need to approve this change.
              </p>
              <div className='flex justify-end gap-2'>
                <button className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors' onClick={() => setShowCodeModeConfirm(false)}>Cancel</button>
                <button
                  className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors'
                  onClick={() => {
                    setShowCodeModeConfirm(false);
                    collab.proposeCodeMode();
                    Message.info('Waiting for other editors to approve...');
                  }}
                >
                  Request Switch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Code mode consensus: remote proposal received ── */}
        {collab.codeModeProposal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <div className='absolute inset-0 bg-black/30' />
            <div className='relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full'>
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>Code Mode Requested</h3>
              <p className='text-sm text-gray-600 mb-4'>
                <strong>{collab.codeModeProposal.userName}</strong> wants to switch everyone to code mode. This will change your view and unlock all blocks.
              </p>
              <div className='flex justify-end gap-2'>
                <button
                  className='px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors'
                  onClick={() => collab.rejectCodeMode()}
                >
                  Deny
                </button>
                <button
                  className='px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors'
                  onClick={() => collab.confirmCodeMode()}
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
}
