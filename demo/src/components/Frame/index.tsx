import React from 'react';

interface FrameProps {
  title: string;
  breadcrumb?: React.ReactElement;
  primaryAction?: React.ReactElement;
  children: React.ReactElement;
}

export default function Frame({
  children,
  title,
  primaryAction,
  breadcrumb,
}: FrameProps) {
  return (
    <div className='min-h-screen flex flex-col bg-gray-50'>
      {/* Header with nav */}
      <header className='bg-gray-900 px-5 py-0 flex items-center h-[60px] shrink-0'>
        <a href='/' className='text-white text-lg font-semibold m-0 hover:text-white no-underline'>
          4Site's MJML Editor
        </a>
        <nav className='flex items-center ml-8 gap-1'>
          <a
            href='/'
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors no-underline ${
              window.location.pathname === '/'
                ? 'text-white bg-white/15'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Templates
          </a>
          <a
            href='/settings'
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors no-underline ${
              window.location.pathname === '/settings'
                ? 'text-white bg-white/15'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            }`}
          >
            Settings
          </a>
        </nav>
      </header>

      {/* Main content — no sidebar */}
      <main className='flex-1 p-6 overflow-auto'>
        {breadcrumb && (
          <div className='text-sm text-gray-500 mb-2'>{breadcrumb}</div>
        )}

        <div className='flex items-center justify-between mb-5'>
          <h2 className='text-xl font-bold text-gray-900 m-0'>{title}</h2>
          {primaryAction}
        </div>

        <div className='bg-white rounded-lg p-6 shadow-sm'>
          {children}
        </div>
      </main>
    </div>
  );
}
