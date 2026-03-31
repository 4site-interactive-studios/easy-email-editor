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
      {/* Header */}
      <header className='bg-gray-900 px-5 py-0 flex items-center h-[60px] shrink-0'>
        <h1 className='text-white text-lg font-semibold m-0'>MJML Editor</h1>
      </header>

      <div className='flex flex-1 overflow-hidden'>
        {/* Sidebar */}
        <aside className='w-[200px] bg-white border-r border-gray-200 shrink-0 hidden md:block'>
          <nav className='py-2'>
            <a
              href='/'
              className='block px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 border-r-2 border-blue-600'
            >
              Templates
            </a>
          </nav>
        </aside>

        {/* Main content */}
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
    </div>
  );
}
