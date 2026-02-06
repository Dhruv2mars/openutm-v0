import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

const TestComponent = () => {
  const { addToast, toasts } = useToast();

  return (
    <div>
      <button onClick={() => addToast('success', 'Success message')}>Add Success</button>
      <button onClick={() => addToast('error', 'Error message')}>Add Error</button>
      <button onClick={() => addToast('info', 'Sticky message', 0)}>Add Sticky</button>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
};

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders ToastProvider without crashing', () => {
    render(
      <ToastProvider>
        <div>Child content</div>
      </ToastProvider>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('adds toast when addToast is called', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('shows correct toast type', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Add Error'));
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('removes toast after duration', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Add Success'));
    expect(screen.getByText('Success message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Success message')).not.toBeInTheDocument();
  });

  it('throws error when useToast is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useToast must be used within a ToastProvider');

    consoleError.mockRestore();
  });

  it('removes toast when dismiss button is clicked', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Add Sticky'));
    expect(screen.getByText('Sticky message')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Sticky message')).not.toBeInTheDocument();
  });
});
