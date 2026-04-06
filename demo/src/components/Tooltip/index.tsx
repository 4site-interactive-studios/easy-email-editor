import React, { useState, useRef, cloneElement, isValidElement } from 'react';
import {
  useFloating,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  offset,
  flip,
  shift,
  FloatingPortal,
  type Placement,
} from '@floating-ui/react';

interface TooltipProps {
  /** Tooltip content — string or ReactNode */
  content: React.ReactNode;
  /** Trigger element (must accept ref) */
  children: React.ReactElement;
  /** Preferred placement */
  placement?: Placement;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Don't show if content is falsy */
  disabled?: boolean;
}

/**
 * Floating UI powered tooltip — replaces native browser title attributes.
 * Positions automatically with flip/shift to stay in viewport.
 */
export function Tooltip({ content, children, placement = 'top', showDelay = 200, disabled }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  });

  const hover = useHover(context, { delay: { open: showDelay, close: 0 } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover, focus, dismiss, role,
  ]);

  if (!content || disabled) {
    return children;
  }

  return (
    <>
      {isValidElement(children) &&
        cloneElement(children, {
          ref: refs.setReference,
          ...getReferenceProps(),
        } as any)
      }
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              zIndex: 99999,
            }}
            {...getFloatingProps()}
          >
            <div
              style={{
                background: '#1f2937',
                color: '#fff',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                padding: '4px 8px',
                borderRadius: 4,
                lineHeight: '16px',
                maxWidth: 280,
                wordWrap: 'break-word',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                pointerEvents: 'none',
              }}
            >
              {content}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
