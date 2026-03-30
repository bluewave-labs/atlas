import { useState, useCallback, useRef } from 'react';
import { DollarSign } from 'lucide-react';
import type { CrmDeal, CrmDealStage } from '../hooks';
import { formatCurrencyCompact, formatNumber } from '../../../lib/format';
import { StatusDot } from '../../../components/ui/status-dot';

interface DealKanbanProps {
  deals: CrmDeal[];
  stages: CrmDealStage[];
  onMoveDeal: (dealId: string, newStageId: string) => void;
  onDealClick: (dealId: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function DealKanban({ deals, stages, onMoveDeal, onDealClick }: DealKanbanProps) {
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});

  const handleDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dealId);
    // Set a slight delay to ensure the drag image is captured
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedDealId(null);
    setDragOverStageId(null);
    dragCounterRef.current = {};
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    dragCounterRef.current[stageId] = (dragCounterRef.current[stageId] ?? 0) + 1;
    setDragOverStageId(stageId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    dragCounterRef.current[stageId] = (dragCounterRef.current[stageId] ?? 0) - 1;
    if (dragCounterRef.current[stageId] <= 0) {
      dragCounterRef.current[stageId] = 0;
      setDragOverStageId((prev) => (prev === stageId ? null : prev));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, stageId: string) => {
      e.preventDefault();
      const dealId = e.dataTransfer.getData('text/plain');
      if (dealId) {
        const deal = deals.find((d) => d.id === dealId);
        if (deal && deal.stageId !== stageId) {
          onMoveDeal(dealId, stageId);
        }
      }
      setDraggedDealId(null);
      setDragOverStageId(null);
      dragCounterRef.current = {};
    },
    [deals, onMoveDeal],
  );

  // Group deals by stage
  const dealsByStage: Record<string, CrmDeal[]> = {};
  for (const stage of stages) {
    dealsByStage[stage.id] = [];
  }
  for (const deal of deals) {
    if (dealsByStage[deal.stageId]) {
      dealsByStage[deal.stageId].push(deal);
    }
  }

  return (
    <div className="crm-kanban">
      {stages.map((stage) => {
        const stageDeals = dealsByStage[stage.id] || [];
        const totalValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
        const isOver = dragOverStageId === stage.id;

        return (
          <div
            key={stage.id}
            className={`crm-kanban-column${isOver ? ' drag-over' : ''}`}
            onDragEnter={(e) => handleDragEnter(e, stage.id)}
            onDragLeave={(e) => handleDragLeave(e, stage.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
          >
            {/* Column header */}
            <div className="crm-kanban-column-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <StatusDot color={stage.color} size={8} />
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  {stage.name}
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1px 6px',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {stageDeals.length}
                </span>
              </div>
              {totalValue > 0 && (
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatCurrencyCompact(totalValue)}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="crm-kanban-cards">
              {stageDeals.map((deal) => (
                <div
                  key={deal.id}
                  className={`crm-kanban-card${draggedDealId === deal.id ? ' dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, deal.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onDealClick(deal.id)}
                >
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                    marginBottom: 'var(--spacing-xs)',
                    lineHeight: 1.3,
                  }}>
                    {deal.title}
                  </div>
                  {deal.companyName && (
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-family)',
                      marginBottom: 'var(--spacing-sm)',
                    }}>
                      {deal.companyName}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-family)',
                      background: 'var(--color-bg-tertiary)',
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      <DollarSign size={10} />
                      {formatNumber(deal.value)}
                    </span>
                    {deal.contactName && (
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--color-accent-primary)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: 'var(--font-weight-semibold)',
                        fontFamily: 'var(--font-family)',
                        flexShrink: 0,
                      }}>
                        {getInitials(deal.contactName)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {stageDeals.length === 0 && (
                <div style={{
                  padding: 'var(--spacing-lg)',
                  textAlign: 'center',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  No deals
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
