import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisplayControl } from './DisplayControl';
import React from 'react';

describe('DisplayControl', () => {
  it('renders Open Display button', () => {
    render(<DisplayControl onOpenDisplay={() => {}} status="stopped" />);
    // Basic check if button exists in DOM
    const button = screen.getByRole('button', { name: /open display/i });
    expect(button).toBeTruthy();
  });

  it('calls onOpenDisplay when clicked', () => {
    const handleOpen = vi.fn();
    render(<DisplayControl onOpenDisplay={handleOpen} status="running" />);
    const button = screen.getByRole('button', { name: /open display/i });
    fireEvent.click(button);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });

  it('is disabled when status is stopped', () => {
    render(<DisplayControl onOpenDisplay={() => {}} status="stopped" />);
    const button = screen.getByRole('button', { name: /open display/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
  
  it('is enabled when status is running', () => {
    render(<DisplayControl onOpenDisplay={() => {}} status="running" />);
    const button = screen.getByRole('button', { name: /open display/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });
});
