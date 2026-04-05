import { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCreateTask } from '../hooks';
import { Button } from '../../../components/ui/button';

export function NewHeadingCreator({
  projectId,
}: {
  projectId: string;
}) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  useEffect(() => {
    if (isCreating && inputRef.current) inputRef.current.focus();
  }, [isCreating]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setIsCreating(false);
      setTitle('');
      return;
    }
    createTask.mutate(
      { title: trimmed, type: 'heading', projectId },
      { onSuccess: () => { setTitle(''); setIsCreating(false); } },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setIsCreating(false); setTitle(''); }
  };

  if (!isCreating) {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus size={14} />}
        onClick={() => setIsCreating(true)}
      >
        {t('tasks.addSection')}
      </Button>
    );
  }

  return (
    <div className="task-new-heading-inline">
      <input
        ref={inputRef}
        className="task-new-heading-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={t('tasks.sectionNamePlaceholder')}
      />
    </div>
  );
}
