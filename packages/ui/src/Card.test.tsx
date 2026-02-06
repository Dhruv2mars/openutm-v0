import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders title and children', () => {
    render(
      <Card title="Config">
        <div>Body</div>
      </Card>
    );

    expect(screen.getByText('Config')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('renders without title', () => {
    render(
      <Card>
        <div>Body</div>
      </Card>
    );

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('merges className', () => {
    const { container } = render(
      <Card className="custom-class">
        <div>Body</div>
      </Card>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
