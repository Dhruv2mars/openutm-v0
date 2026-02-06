import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceBar } from './ResourceBar';

describe('ResourceBar', () => {
  it('renders green bar when usage below 60%', () => {
    const { container } = render(<ResourceBar label="Disk" used={2} total={10} />);
    expect(screen.getByText('20% used')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('renders yellow bar when usage between 60% and 79%', () => {
    const { container } = render(<ResourceBar label="Disk" used={6} total={10} />);
    expect(screen.getByText('60% used')).toBeInTheDocument();
    expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
  });

  it('renders red bar when usage >= 80%', () => {
    const { container } = render(
      <ResourceBar label="Disk" used={8} total={10} className="resource-wrapper" />
    );
    expect(screen.getByText('8.0 / 10.0 GB')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('resource-wrapper');
  });
});
