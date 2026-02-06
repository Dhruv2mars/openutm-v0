import React, { useState, useCallback, useRef, useEffect } from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  toolbar: React.ReactNode;
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 500;
const DEFAULT_SIDEBAR_WIDTH = 280;

const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  sidebar, 
  toolbar, 
  isDarkMode,
  onThemeToggle 
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, e.clientX));
    setSidebarWidth(newWidth);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className={`flex h-screen w-full overflow-hidden ${isDarkMode ? 'dark' : ''}`}
      data-testid="main-layout"
    >
      <aside 
        className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col"
        style={{ width: sidebarWidth }}
        data-testid="sidebar"
      >
        <div className="flex-1 overflow-y-auto">
          {sidebar}
        </div>
        
        <div
          data-testid="sidebar-resize-handle"
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500 z-10"
          style={{ left: sidebarWidth - 2 }}
          onMouseDown={handleMouseDown}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900">
        <header 
          className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 bg-gray-50 dark:bg-gray-800"
          data-testid="toolbar"
        >
          {toolbar}
        </header>

        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
