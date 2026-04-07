import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { WrapText, Monitor, Smartphone, Maximize2, Minimize2 } from 'lucide-react';
import { useCodeMirrorControls } from '@demo/hooks/useCodeMirrorControls';

// CodeMirror core
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/xml/xml';

// Editing addons
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/matchtags';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/edit/matchbrackets';

// Autocomplete
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/show-hint.css';
import 'codemirror/addon/hint/xml-hint';

// Code folding
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/xml-fold';

// Search — enables Ctrl+F/Cmd+F within the editor
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/search/match-highlighter';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/dialog/dialog.css';

// ─── MJML schema for autocomplete ─────────────────────────────────────────────

const mjmlSchema: Record<string, any> = {
  '!top': ['mjml'],
  'mjml': { children: ['mj-head', 'mj-body'], attrs: {} },
  'mj-head': { children: ['mj-attributes', 'mj-breakpoint', 'mj-font', 'mj-preview', 'mj-style', 'mj-raw', 'mj-html-attributes'], attrs: {} },
  'mj-body': { children: ['mj-section', 'mj-wrapper', 'mj-hero', 'mj-raw'], attrs: { width: null, 'background-color': null, 'css-class': null } },
  'mj-section': {
    children: ['mj-column', 'mj-group'],
    attrs: {
      'background-color': null, 'background-url': null, 'background-repeat': ['repeat', 'no-repeat'],
      'background-size': null, 'background-position': null, border: null, 'border-radius': null,
      direction: ['ltr', 'rtl'], 'full-width': ['full-width'], padding: null, 'text-align': ['left', 'center', 'right'],
      'css-class': null,
    },
  },
  'mj-column': {
    children: ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer', 'mj-social', 'mj-navbar', 'mj-table', 'mj-raw', 'mj-accordion', 'mj-carousel', 'mj-hero'],
    attrs: {
      width: null, 'background-color': null, 'inner-background-color': null, border: null,
      'border-radius': null, 'inner-border': null, 'inner-border-radius': null, padding: null,
      'vertical-align': ['top', 'middle', 'bottom'], 'css-class': null,
    },
  },
  'mj-group': {
    children: ['mj-column'],
    attrs: { width: null, 'background-color': null, direction: ['ltr', 'rtl'], 'vertical-align': ['top', 'middle', 'bottom'], 'css-class': null },
  },
  'mj-wrapper': {
    children: ['mj-section', 'mj-hero'],
    attrs: {
      'background-color': null, 'background-url': null, 'background-repeat': ['repeat', 'no-repeat'],
      'background-size': null, 'background-position': null, border: null, 'border-radius': null,
      'full-width': ['full-width'], padding: null, 'text-align': ['left', 'center', 'right'], 'css-class': null,
    },
  },
  'mj-text': {
    children: [],
    attrs: {
      color: null, 'font-family': null, 'font-size': null, 'font-style': ['normal', 'italic', 'oblique'],
      'font-weight': null, 'line-height': null, 'letter-spacing': null, height: null,
      'text-decoration': ['underline', 'overline', 'none'], 'text-transform': ['capitalize', 'uppercase', 'lowercase', 'none'],
      align: ['left', 'center', 'right', 'justify'], 'container-background-color': null, padding: null, 'css-class': null,
    },
  },
  'mj-image': {
    children: [],
    attrs: {
      src: null, alt: null, width: null, height: null, href: null, target: ['_blank', '_self'],
      title: null, align: ['left', 'center', 'right'], border: null, 'border-radius': null,
      'container-background-color': null, 'fluid-on-mobile': ['true'], padding: null, 'css-class': null,
    },
  },
  'mj-button': {
    children: [],
    attrs: {
      href: null, target: ['_blank', '_self'], 'background-color': null, color: null,
      'font-family': null, 'font-size': null, 'font-weight': null, 'border-radius': null,
      border: null, 'inner-padding': null, padding: null, width: null, height: null,
      align: ['left', 'center', 'right'], 'vertical-align': ['top', 'middle', 'bottom'],
      'text-decoration': ['underline', 'overline', 'none'], 'text-transform': ['capitalize', 'uppercase', 'lowercase', 'none'],
      'line-height': null, 'letter-spacing': null, 'container-background-color': null, 'css-class': null,
    },
  },
  'mj-divider': {
    children: [],
    attrs: {
      'border-color': null, 'border-style': ['solid', 'dashed', 'dotted'], 'border-width': null,
      width: null, align: ['left', 'center', 'right'], 'container-background-color': null, padding: null, 'css-class': null,
    },
  },
  'mj-spacer': { children: [], attrs: { height: null, 'container-background-color': null, padding: null, 'css-class': null } },
  'mj-social': {
    children: ['mj-social-element'],
    attrs: {
      mode: ['horizontal', 'vertical'], align: ['left', 'center', 'right'], 'icon-size': null,
      'icon-height': null, 'icon-padding': null, 'text-padding': null, 'border-radius': null,
      color: null, 'font-family': null, 'font-size': null, 'font-style': ['normal', 'italic'],
      'font-weight': null, 'line-height': null, 'text-decoration': ['underline', 'overline', 'none'],
      'container-background-color': null, padding: null, 'inner-padding': null, 'css-class': null,
    },
  },
  'mj-social-element': {
    children: [],
    attrs: {
      name: ['facebook', 'twitter', 'x', 'google', 'pinterest', 'linkedin', 'tumblr', 'xing', 'github', 'instagram', 'web', 'snapchat', 'youtube', 'vimeo', 'medium', 'soundcloud', 'dribbble'],
      href: null, src: null, target: ['_blank', '_self'], alt: null, title: null,
      'background-color': null, color: null, 'border-radius': null, 'icon-size': null,
      'font-size': null, padding: null, 'css-class': null,
    },
  },
  'mj-navbar': {
    children: ['mj-navbar-link'],
    attrs: { align: ['left', 'center', 'right'], hamburger: ['hamburger'], 'ico-color': null, 'ico-font-size': null, 'css-class': null },
  },
  'mj-navbar-link': {
    children: [],
    attrs: {
      href: null, target: ['_blank', '_self'], color: null, 'font-family': null, 'font-size': null,
      'font-weight': null, 'line-height': null, 'letter-spacing': null,
      'text-decoration': ['underline', 'overline', 'none'], 'text-transform': ['capitalize', 'uppercase', 'lowercase', 'none'],
      padding: null, 'css-class': null,
    },
  },
  'mj-hero': {
    children: ['mj-text', 'mj-image', 'mj-button', 'mj-divider', 'mj-spacer'],
    attrs: {
      mode: ['fixed-height', 'fluid-height'], height: null, 'background-url': null,
      'background-width': null, 'background-height': null, 'background-color': null,
      'background-position': null, 'vertical-align': ['top', 'middle', 'bottom'],
      'border-radius': null, padding: null, 'css-class': null,
    },
  },
  'mj-table': { children: [], attrs: { width: null, align: ['left', 'center', 'right'], color: null, 'font-family': null, 'font-size': null, 'line-height': null, 'container-background-color': null, padding: null, border: null, cellpadding: null, cellspacing: null, 'table-layout': ['auto', 'fixed'], 'css-class': null } },
  'mj-accordion': {
    children: ['mj-accordion-element'],
    attrs: { border: null, 'icon-width': null, 'icon-height': null, 'icon-position': ['left', 'right'], 'icon-align': ['top', 'middle', 'bottom'], 'icon-wrapped-url': null, 'icon-unwrapped-url': null, 'font-family': null, padding: null, 'container-background-color': null, 'css-class': null },
  },
  'mj-accordion-element': { children: ['mj-accordion-title', 'mj-accordion-text'], attrs: { 'background-color': null, border: null, 'font-family': null, 'css-class': null } },
  'mj-accordion-title': { children: [], attrs: { 'background-color': null, color: null, 'font-family': null, 'font-size': null, padding: null, 'css-class': null } },
  'mj-accordion-text': { children: [], attrs: { 'background-color': null, color: null, 'font-family': null, 'font-size': null, 'font-weight': null, 'line-height': null, 'letter-spacing': null, padding: null, 'css-class': null } },
  'mj-carousel': {
    children: ['mj-carousel-image'],
    attrs: { align: ['left', 'center', 'right'], 'border-radius': null, 'icon-width': null, 'left-icon': null, 'right-icon': null, thumbnails: ['visible', 'hidden'], 'tb-width': null, 'tb-border': null, 'tb-border-radius': null, 'tb-hover-border-color': null, 'tb-selected-border-color': null, padding: null, 'css-class': null },
  },
  'mj-carousel-image': { children: [], attrs: { src: null, alt: null, title: null, href: null, target: ['_blank', '_self'], 'thumbnails-src': null, 'border-radius': null, 'css-class': null } },
  'mj-raw': { children: [], attrs: { position: ['file-start'] } },
  'mj-attributes': { children: ['mj-all', 'mj-text', 'mj-section', 'mj-column', 'mj-class', 'mj-image', 'mj-button', 'mj-divider', 'mj-table', 'mj-social', 'mj-social-element', 'mj-navbar', 'mj-navbar-link', 'mj-accordion', 'mj-hero', 'mj-wrapper', 'mj-carousel'], attrs: {} },
  'mj-all': { children: [], attrs: { 'font-family': null, color: null, 'font-size': null, padding: null } },
  'mj-breakpoint': { children: [], attrs: { width: null } },
  'mj-font': { children: [], attrs: { name: null, href: null } },
  'mj-preview': { children: [], attrs: {} },
  'mj-style': { children: [], attrs: { inline: ['inline'] } },
  'mj-class': { children: [], attrs: { name: null } },
};

// Tags whose inner content should be preserved verbatim (not reformatted)
const CONTENT_TAGS = new Set([
  'mj-text', 'mj-button', 'mj-style', 'mj-raw', 'mj-title', 'mj-preview',
  'mj-accordion-title', 'mj-accordion-text',
]);

// Tags that increase indent depth when opened
const INDENT_TAGS = new Set([
  'mjml', 'mj-head', 'mj-body', 'mj-attributes', 'mj-html-attributes',
  'mj-section', 'mj-column', 'mj-group', 'mj-wrapper', 'mj-hero',
  'mj-social', 'mj-navbar', 'mj-accordion', 'mj-accordion-element',
  'mj-carousel', 'mj-selector', 'mj-table',
  'mj-text', 'mj-button', 'mj-style', 'mj-raw',
  'mj-accordion-title', 'mj-accordion-text',
]);

function formatMjml(mjml: string): string {
  const TAB = '\t';
  let depth = 0;
  const output: string[] = [];

  // Tokenize: split into tags and text segments
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)(\s*\/?)>/g;
  let lastIndex = 0;

  const indent = () => TAB.repeat(depth);

  const addBlankLine = () => {
    if (output.length > 0 && output[output.length - 1].trim() !== '') {
      output.push('');
    }
  };

  // Track previous tag for blank line rules
  let prevClosingTag = '';
  let prevOpeningTag = '';
  let inBody = false;

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(mjml)) !== null) {
    const [fullMatch, closingSlash, tagName, attrs, selfClosingSlash] = match;
    const tagLower = tagName.toLowerCase();
    const isClosing = closingSlash === '/';
    const isSelfClosing = selfClosingSlash.trim() === '/' || fullMatch.endsWith('/>');
    const isMjTag = tagLower.startsWith('mj-') || tagLower === 'mjml';

    // Text between tags (non-mj content or whitespace)
    const textBefore = mjml.substring(lastIndex, match.index);
    lastIndex = match.index + fullMatch.length;

    // If we're NOT inside a content tag, skip whitespace-only text
    // If there IS meaningful text, emit it (shouldn't happen outside content tags in MJML)
    if (textBefore.trim() && !isMjTag) {
      output.push(indent() + textBefore.trim());
    }

    if (!isMjTag) {
      // Non-MJML tag (HTML inside content) — already handled by content preservation
      continue;
    }

    // Content tags: emit opening tag, preserve inner content, emit closing tag
    if (!isClosing && !isSelfClosing && CONTENT_TAGS.has(tagLower)) {
      // Find the matching closing tag
      const closeTag = `</${tagName}>`;
      const closeIdx = mjml.indexOf(closeTag, lastIndex);
      if (closeIdx === -1) {
        // No closing tag found — emit as self-closing
        output.push(indent() + fullMatch);
        continue;
      }

      const innerContent = mjml.substring(lastIndex, closeIdx);
      lastIndex = closeIdx + closeTag.length;
      tagRegex.lastIndex = lastIndex;

      // Blank line rules for specific tags
      if (tagLower === 'mj-style' || tagLower === 'mj-raw') {
        addBlankLine();
      }

      if (innerContent.trim() === '') {
        // Empty content tag — single line
        output.push(indent() + fullMatch + closeTag);
      } else if (!innerContent.includes('\n') && innerContent.trim().length < 80) {
        // Short single-line content
        output.push(indent() + fullMatch + innerContent.trim() + closeTag);
      } else {
        // Multi-line content — preserve with one extra indent
        output.push(indent() + fullMatch);
        const contentLines = innerContent.split('\n');
        // Find minimum indentation in content to normalize
        const nonEmptyLines = contentLines.filter(l => l.trim());
        const minIndent = nonEmptyLines.reduce((min, l) => {
          const leading = l.match(/^(\s*)/)?.[1]?.length || 0;
          return Math.min(min, leading);
        }, Infinity);
        const contentIndent = indent() + TAB;
        for (const cl of contentLines) {
          const trimmed = cl.trim();
          if (!trimmed) {
            // Preserve intentional blank lines within content
            if (output.length > 0 && output[output.length - 1].trim() !== '') {
              output.push('');
            }
          } else {
            // Re-indent: strip original indent, add new indent
            const stripped = cl.substring(Math.min(minIndent, cl.length - cl.trimStart().length));
            output.push(contentIndent + stripped.trim());
          }
        }
        output.push(indent() + closeTag);
      }

      // Blank line after closing style/raw
      if (tagLower === 'mj-style') {
        addBlankLine();
      }
      if (tagLower === 'mj-raw' && !inBody) {
        addBlankLine();
      }

      prevClosingTag = tagLower;
      prevOpeningTag = '';
      continue;
    }

    // Closing tag
    if (isClosing) {
      if (INDENT_TAGS.has(tagLower)) {
        depth = Math.max(0, depth - 1);
      }

      // Blank line before </mj-body> and </mjml>
      if (tagLower === 'mj-body' || tagLower === 'mjml') {
        addBlankLine();
      }

      output.push(indent() + fullMatch);

      // Blank line after </mj-head>, </mj-attributes>, </mj-html-attributes>
      if (tagLower === 'mj-head' || tagLower === 'mj-attributes' || tagLower === 'mj-html-attributes') {
        addBlankLine();
      }

      prevClosingTag = tagLower;
      prevOpeningTag = '';
      if (tagLower === 'mj-head') inBody = false;
      continue;
    }

    // Self-closing tag
    if (isSelfClosing) {
      output.push(indent() + fullMatch);
      prevOpeningTag = tagLower;
      prevClosingTag = '';
      continue;
    }

    // Opening tag — blank line rules
    if (inBody) {
      // Blank line before <mj-raw> that acts as a comment separator in body
      if (tagLower === 'mj-raw') {
        addBlankLine();
      }
      // Blank line between sibling sections/wrappers
      if ((tagLower === 'mj-section' || tagLower === 'mj-wrapper') &&
          (prevClosingTag === 'mj-section' || prevClosingTag === 'mj-wrapper')) {
        addBlankLine();
      }
    }

    // Blank line before <mj-attributes>, <mj-style>, <mj-html-attributes>
    if (tagLower === 'mj-attributes' || tagLower === 'mj-html-attributes') {
      addBlankLine();
    }

    output.push(indent() + fullMatch);

    if (INDENT_TAGS.has(tagLower)) {
      depth++;
    }

    // Blank line after <mjml>, <mj-head>, <mj-body>
    if (tagLower === 'mjml' || tagLower === 'mj-head') {
      addBlankLine();
    }
    if (tagLower === 'mj-body') {
      inBody = true;
    }

    prevOpeningTag = tagLower;
    prevClosingTag = '';
  }

  // Any remaining text after the last tag
  const remaining = mjml.substring(lastIndex).trim();
  if (remaining) {
    output.push(remaining);
  }

  // Final cleanup: collapse triple+ blank lines
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface MjmlCodeEditorProps {
  mjmlString: string;
  onMjmlChange: (mjml: string) => void;
  height: string;
  jumpToLine?: number;
}

export function MjmlCodeEditor({ mjmlString, onMjmlChange, height, jumpToLine }: MjmlCodeEditorProps) {
  const [code, setCode] = useState(() => formatMjml(mjmlString));
  const [previewHtml, setPreviewHtml] = useState('');
  const compileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [splitPos, setSplitPos] = useState(50);
  const { lineWrap, toggleLineWrap, fullscreen, toggleFullscreen } =
    useCodeMirrorControls(editorRef, false);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');

  // Sync incoming mjmlString when it changes (e.g., entering code mode)
  useEffect(() => {
    const formatted = formatMjml(mjmlString);
    setCode(formatted);
    onMjmlChange(formatted);
    compile(formatted, true);
    return () => {
      if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
    };
  }, [mjmlString]);

  // Jump to a specific line when requested
  useEffect(() => {
    if (!jumpToLine || jumpToLine <= 0) return;
    setTimeout(() => {
      const cm = editorRef.current?.editor || editorRef.current;
      if (cm) {
        const line = Math.round(jumpToLine) - 1; // CodeMirror is 0-indexed
        cm.setCursor({ line, ch: 0 });
        cm.scrollIntoView({ line, ch: 0 }, 100);
        cm.focus();
      }
    }, 200);
  }, [jumpToLine]);

  // Compile MJML → HTML for preview. Writes into iframe without destroying it
  // to preserve scroll position.
  const compile = useCallback(async (mjml: string, isInitial?: boolean) => {
    try {
      const mjmlLib = (await import('mjml-browser')).default;
      const result = mjmlLib(mjml, { validationLevel: 'soft' });
      const html = result.html || '';
      setPreviewHtml(html);

      // Write directly into the iframe document to preserve scroll position
      const iframe = iframeRef.current;
      if (iframe) {
        const doc = iframe.contentDocument;
        if (doc) {
          // On initial load, use srcdoc to set up the document cleanly
          if (isInitial) {
            iframe.srcdoc = html;
          } else {
            // Preserve scroll position by writing into existing document
            const scrollEl = doc.scrollingElement || doc.documentElement;
            const scrollTop = scrollEl?.scrollTop || 0;
            doc.open();
            doc.write(html);
            doc.close();
            // Restore scroll after the browser has laid out the new content
            requestAnimationFrame(() => {
              const newScrollEl = doc.scrollingElement || doc.documentElement;
              if (newScrollEl) newScrollEl.scrollTop = scrollTop;
            });
          }
        }
      }
    } catch {
      // Compilation errors handled by the nav validation indicator
    }
  }, []);

  // Handle code changes — debounce compilation
  const handleChange = useCallback((editor: any, data: any, value: string) => {
    setCode(value);
    onMjmlChange(value);
    if (compileTimerRef.current) clearTimeout(compileTimerRef.current);
    compileTimerRef.current = setTimeout(() => compile(value), 500);
    // Trigger autocomplete when '<' is typed
    if (data.text && data.text[0] === '<') {
      setTimeout(() => {
        editor.showHint?.({ schemaInfo: mjmlSchema, completeSingle: false });
      }, 10);
    }
  }, [compile, onMjmlChange]);

  // Splitter drag
  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startPos = splitPos;
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newPos = startPos + (delta / containerWidth) * 100;
      setSplitPos(Math.max(25, Math.min(75, newPos)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [splitPos]);

  return (
    <div style={{
      height: fullscreen ? '100vh' : height,
      display: 'flex',
      flexDirection: 'column',
      ...(fullscreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 } : {}),
    }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Code editor panel */}
        <div
          className='mjml-code-editor-panel'
          style={{ width: `${splitPos}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
        >
          {/* Force react-codemirror2 wrapper to fill and clip */}
          <style>{`
            .mjml-code-editor-panel .react-codemirror2 {
              flex: 1;
              overflow: hidden;
            }
            .mjml-code-editor-panel .react-codemirror2 .CodeMirror {
              height: 100% !important;
            }
          `}</style>
          {/* Toolbar: Wrap + Fullscreen */}
          <div style={{
            position: 'absolute',
            top: 8,
            right: 12,
            zIndex: 10,
            display: 'flex',
            gap: 4,
          }}>
            <button
              onClick={toggleLineWrap}
              title={lineWrap ? 'Disable line wrapping' : 'Enable line wrapping'}
              style={{
                background: lineWrap ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 11,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              <WrapText size={12} />
              Wrap
            </button>
            <button
              onClick={toggleFullscreen}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
              style={{
                background: fullscreen ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 4,
                padding: '3px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>

          <CodeMirror
            ref={(ref: any) => { editorRef.current = ref; }}
            value={code}
            options={{
              mode: 'xml',
              theme: 'material',
              lineNumbers: true,
              lineWrapping: lineWrap,
              smartIndent: true,
              indentWithTabs: false,
              indentUnit: 2,
              tabSize: 2,
              autoCloseTags: true,
              matchTags: { bothTags: true },
              autoCloseBrackets: true,
              matchBrackets: true,
              foldGutter: true,
              highlightSelectionMatches: { showToken: true, annotateScrollbar: true },
              gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
              extraKeys: {
                'Ctrl-Space': (cm: any) => {
                  (cm as any).showHint({
                    schemaInfo: mjmlSchema,
                    completeSingle: false,
                  });
                },
              },
              hintOptions: {
                schemaInfo: mjmlSchema,
                completeSingle: false,
              },
            }}
            onBeforeChange={handleChange}
          />
        </div>

        {/* Splitter */}
        <div
          onMouseDown={handleSplitterMouseDown}
          style={{
            width: 6,
            cursor: 'col-resize',
            background: '#1e1e1e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{
            width: 2,
            height: 40,
            borderRadius: 1,
            background: 'rgba(255,255,255,0.3)',
          }} />
        </div>

        {/* Preview panel */}
        <div style={{ flex: 1, background: '#f5f5f5', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '4px 12px',
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            fontSize: 12,
            fontWeight: 600,
            color: '#6b7280',
            flexShrink: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Live Preview</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => setPreviewWidth('desktop')}
                title='Desktop width'
                style={{
                  padding: '3px 6px',
                  border: '1px solid',
                  borderColor: previewWidth === 'desktop' ? '#3b82f6' : '#d1d5db',
                  borderRadius: '4px 0 0 4px',
                  background: previewWidth === 'desktop' ? '#eff6ff' : '#fff',
                  color: previewWidth === 'desktop' ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Monitor size={12} />
              </button>
              <button
                onClick={() => setPreviewWidth('mobile')}
                title='Mobile width (375px)'
                style={{
                  padding: '3px 6px',
                  border: '1px solid',
                  borderColor: previewWidth === 'mobile' ? '#3b82f6' : '#d1d5db',
                  borderRadius: '0 4px 4px 0',
                  background: previewWidth === 'mobile' ? '#eff6ff' : '#fff',
                  color: previewWidth === 'mobile' ? '#3b82f6' : '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Smartphone size={12} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', background: previewWidth === 'mobile' ? '#e5e7eb' : '#fff' }}>
            <iframe
              ref={iframeRef}
              style={{
                width: previewWidth === 'mobile' ? 375 : '100%',
                maxWidth: '100%',
                height: '100%',
                border: 'none',
                background: '#fff',
                boxShadow: previewWidth === 'mobile' ? '0 0 20px rgba(0,0,0,0.1)' : 'none',
              }}
              sandbox='allow-same-origin'
              title='MJML Preview'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
