import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('renders label, error, and custom class', () => {
    render(
      <Input
        label="VM Name"
        error="Required"
        className="custom-input"
        defaultValue="demo"
      />
    );

    expect(screen.getByText('VM Name')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByDisplayValue('demo')).toHaveClass('border-red-500');
    expect(screen.getByDisplayValue('demo')).toHaveClass('custom-input');
  });

  it('uses explicit id and non-error styling', () => {
    render(<Input label="CPU" id="cpu-input" defaultValue="2" />);

    const input = screen.getByDisplayValue('2');
    const label = screen.getByText('CPU');

    expect(input).toHaveAttribute('id', 'cpu-input');
    expect(input).toHaveClass('border-gray-300');
    expect(label).toHaveAttribute('for', 'cpu-input');
  });

  it('forwards ref to input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="x" />);
    expect(ref.current?.value).toBe('x');
  });
});
