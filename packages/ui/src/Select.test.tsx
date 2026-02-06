import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

const options = [
  { value: 'nat', label: 'NAT' },
  { value: 'bridged', label: 'Bridged' },
];

describe('Select', () => {
  it('renders options with label and error style', () => {
    render(
      <Select
        label="Network"
        options={options}
        error="Pick one"
        className="custom-select"
        defaultValue="nat"
      />
    );

    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('border-red-500');
    expect(screen.getByRole('combobox')).toHaveClass('custom-select');
    expect(screen.getByRole('option', { name: 'NAT' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bridged' })).toBeInTheDocument();
  });

  it('renders without label/error and forwards ref', () => {
    const ref = createRef<HTMLSelectElement>();
    render(<Select ref={ref} options={options} defaultValue="bridged" />);

    expect(screen.queryByText('Network')).not.toBeInTheDocument();
    expect(screen.queryByText('Pick one')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveClass('border-gray-300');
    expect(ref.current?.value).toBe('bridged');
  });
});
