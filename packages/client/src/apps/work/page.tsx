import { ContentArea } from '../../components/ui/content-area';
import { WorkSidebar } from './components/work-sidebar';

export function WorkPage() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <WorkSidebar />
      <ContentArea>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-md)',
        }}>
          Coming soon
        </div>
      </ContentArea>
    </div>
  );
}
