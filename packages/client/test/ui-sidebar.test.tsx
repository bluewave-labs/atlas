import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarItem, SidebarSection } from '../src/components/layout/app-sidebar';

// AppSidebar uses useNavigate and NotificationBell which need mocking,
// but SidebarItem and SidebarSection are standalone — test those directly.

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

describe('SidebarItem', () => {
  it('renders the label text', () => {
    render(<SidebarItem label="All items" />);
    expect(screen.getByText('All items')).toBeInTheDocument();
  });

  it('renders as a button element', () => {
    render(<SidebarItem label="Dashboard" />);
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('applies selected surface background when active', () => {
    render(<SidebarItem label="Active" isActive />);
    const button = screen.getByRole('button');
    const styleAttr = button.getAttribute('style') || '';
    expect(styleAttr).toContain('color-surface-selected');
  });

  it('applies transparent background when inactive', () => {
    render(<SidebarItem label="Inactive" />);
    const button = screen.getByRole('button');
    const styleAttr = button.getAttribute('style') || '';
    expect(styleAttr).toContain('transparent');
  });

  it('applies primary text color when active', () => {
    render(<SidebarItem label="Active" isActive />);
    const button = screen.getByRole('button');
    expect(button.style.color).toBe('var(--color-text-primary)');
  });

  it('applies secondary text color when inactive', () => {
    render(<SidebarItem label="Inactive" />);
    const button = screen.getByRole('button');
    expect(button.style.color).toBe('var(--color-text-secondary)');
  });

  it('renders icon when provided', () => {
    render(
      <SidebarItem label="With icon" icon={<span data-testid="sidebar-icon">I</span>} />,
    );
    expect(screen.getByTestId('sidebar-icon')).toBeInTheDocument();
  });

  it('renders count badge when count is provided', () => {
    render(<SidebarItem label="Inbox" count={42} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('does not render count badge when count is undefined', () => {
    const { container } = render(<SidebarItem label="Inbox" />);
    // No count span should be present
    const spans = container.querySelectorAll('span');
    const countSpan = Array.from(spans).find(
      (s) => s.style.fontVariantNumeric === 'tabular-nums',
    );
    expect(countSpan).toBeUndefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SidebarItem label="Clickable" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders count of 0 when count is 0', () => {
    render(<SidebarItem label="Empty" count={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('SidebarSection', () => {
  it('renders children content', () => {
    render(
      <SidebarSection>
        <span>Section content</span>
      </SidebarSection>,
    );
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <SidebarSection title="Navigation">
        <span>Items</span>
      </SidebarSection>,
    );
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('does not render title element when title is omitted', () => {
    const { container } = render(
      <SidebarSection>
        <span>Items</span>
      </SidebarSection>,
    );
    // The title div uses uppercase text-transform — should not exist
    const titleDiv = container.querySelector('[style*="text-transform: uppercase"]');
    expect(titleDiv).toBeNull();
  });
});
