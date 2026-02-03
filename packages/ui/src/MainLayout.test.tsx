import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MainLayout from './MainLayout';
import React from 'react';

describe('MainLayout', () => {
  it('renders sidebar, toolbar, and main content', () => {
    render(
      <MainLayout
        sidebar={<div>Sidebar Content</div>}
        toolbar={<div>Toolbar Content</div>}
        isDarkMode={false}
        onThemeToggle={() => {}}
      >
        <div>Main Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Sidebar Content')).toBeInTheDocument();
    expect(screen.getByText('Toolbar Content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('has a resizable sidebar handle', () => {
    render(
      <MainLayout
        sidebar={<div>Sidebar</div>}
        toolbar={<div>Toolbar</div>}
        isDarkMode={false}
        onThemeToggle={() => {}}
      >
        <div>Main</div>
      </MainLayout>
    );

    const handle = screen.getByTestId('sidebar-resize-handle');
    expect(handle).toBeInTheDocument();
  });

  it('applies dark mode class when isDarkMode is true', () => {
      const { container } = render(
      <MainLayout
        sidebar={<div>Sidebar</div>}
        toolbar={<div>Toolbar</div>}
        isDarkMode={true}
        onThemeToggle={() => {}}
      >
        <div>Main</div>
      </MainLayout>
    );
    expect(container.firstChild).toHaveClass('dark');
  });
});
