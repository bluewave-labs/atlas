import { AppSidebar } from '../../../components/layout/app-sidebar';

export function WorkSidebar() {
  return (
    <AppSidebar storageKey="atlas_work_sidebar" title="Work">
      <div style={{
        padding: 'var(--spacing-lg)',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--font-size-sm)',
      }}>
        Coming soon
      </div>
    </AppSidebar>
  );
}
