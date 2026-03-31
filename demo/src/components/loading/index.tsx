import React, { useRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type LoadingProps = {
  loading: boolean;
  children?: React.ReactNode;
  color?: string;
};

export function Loading({ loading, children, color = '#3b82f6' }: LoadingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({
    width: 0,
    height: 0,
    fontSize: 12,
  });

  useEffect(() => {
    if (loading) {
      const node = ref.current;
      const parentNode = node && (node.parentNode as HTMLElement);
      if (node && parentNode) {
        const { width, height } = parentNode.getBoundingClientRect();
        setState({
          height,
          width,
          fontSize: Math.min(64, width * 0.15),
        });
      }
    }
  }, [loading]);

  return (
    <>
      {loading ? (
        <div
          ref={ref}
          className='flex items-center justify-center'
          style={{ height: state.height, width: state.width }}
        >
          <Loader2
            className='animate-spin'
            style={{ color }}
            size={state.fontSize}
          />
        </div>
      ) : (
        children
      )}
    </>
  );
}
