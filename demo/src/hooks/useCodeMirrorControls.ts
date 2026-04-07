import { useCallback, useEffect, useRef, useState } from 'react';

/** Get the CodeMirror instance from a react-codemirror2 ref */
function getCmInstance(editorRef: React.RefObject<any>) {
  if (!editorRef.current) return null;
  return editorRef.current.editor || editorRef.current;
}

/** Refresh CodeMirror layout (call after container resize) */
function refreshCm(editorRef: React.RefObject<any>) {
  const cm = getCmInstance(editorRef);
  if (cm?.refresh) cm.refresh();
}

/**
 * Shared controls for CodeMirror editors: line wrap toggle + fullscreen mode.
 * Handles Escape key to exit fullscreen and refreshes CodeMirror after layout changes.
 */
export function useCodeMirrorControls(
  editorRef: React.RefObject<any>,
  defaultLineWrap: boolean,
) {
  const [lineWrap, setLineWrap] = useState(defaultLineWrap);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleLineWrap = useCallback(() => {
    setLineWrap(w => {
      const next = !w;
      const cm = getCmInstance(editorRef);
      if (cm?.setOption) cm.setOption('lineWrapping', next);
      return next;
    });
  }, [editorRef]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen(f => !f);
    setTimeout(() => refreshCm(editorRef), 50);
  }, [editorRef]);

  useEffect(() => {
    if (!fullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFullscreen(false);
        setTimeout(() => refreshCm(editorRef), 50);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen, editorRef]);

  return { lineWrap, toggleLineWrap, fullscreen, toggleFullscreen };
}
