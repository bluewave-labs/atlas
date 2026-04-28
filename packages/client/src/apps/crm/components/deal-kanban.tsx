import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, AlertTriangle, ChevronRight } from 'lucide-react';
import { Tooltip } from '../../../components/ui/tooltip';
import type { CrmDeal, CrmDealStage } from '../hooks';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '../../../lib/format';
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

const COLLAPSED_KEY = 'crm-collapsed-stages';
function loadCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]')); } catch { return new Set(); }
}

export function DealKanban({ deals, stages, onMoveDeal, onDealClick }: DealKanbanProps) {
  const { t } = useTranslation();
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const dragCounterRef = useRef<Record<string, number>>({});
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(loadCollapsed);

  const toggleCollapse = useCallback((stageId: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      next.has(stageId) ? next.delete(stageId) : next.add(stageId);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

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
        const isCollapsed = collapsedStages.has(stage.id);

        if (isCollapsed) {
          return (
            <div
              key={stage.id}
              className="crm-kanban-column crm-kanban-column-collapsed"
              onClick={() => toggleCollapse(stage.id)}
              onDragEnter={(e) => handleDragEnter(e, stage.id)}
              onDragLeave={(e) => handleDragLeave(e, stage.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
              style={{ minWidth: 48, maxWidth: 48, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-md) var(--spacing-xs)' }}
            >
              <StatusDot color={stage.color} size={8} />
              <span style={{
                writingMode: 'vertical-rl', textOrientation: 'mixed',
                fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                maxHeight: 120,
              }}>
                {stage.name}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {stageDeals.length}
              </span>
              {totalValue > 0 && (
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', writingMode: 'vertical-rl' }}>
                  {formatCurrencyCompact(totalValue)}
                </span>
              )}
            </div>
          );
        }

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <button onClick={(e) => { e.stopPropagation(); toggleCollapse(stage.id); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}>
                  <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} />
                </button>
                <StatusDot color={stage.color} size={8} />
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  {stage.name}
                </span>
              </div>
              <span style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {stageDeals.length} {stageDeals.length === 1 ? t('crm.deals.deal') : t('crm.sidebar.deals').toLowerCase()}{totalValue > 0 ? ` \u00B7 ${formatCurrencyCompact(totalValue)}` : ''}
              </span>
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
                    marginBottom: 2,
                    lineHeight: 1.3,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 4,
                  }}>
                    <span style={{ flex: 1 }}>{deal.title}</span>
                    {(() => {
                      const rottingDays = deal.stageRottingDays;
                      if (!rottingDays || !deal.stageEnteredAt) return null;
                      const daysInStage = Math.floor((Date.now() - new Date(deal.stageEnteredAt).getTime()) / 86400000);
                      if (daysInStage <= rottingDays) return null;
                      return (
                        <Tooltip content={t('crm.deals.rottingWarning', { days: daysInStage, limit: rottingDays })}>
                          <span style={{ color: daysInStage > rottingDays * 1.5 ? 'var(--color-error)' : 'var(--color-warning)', flexShrink: 0, marginTop: 1 }}>
                            <AlertTriangle size={12} />
                          </span>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  {deal.value > 0 && (
                    <div style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-secondary)',
                      fontFamily: 'var(--font-family)',
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: 'var(--spacing-xs)',
                    }}>
                      {formatCurrency(deal.value, deal.currency)}
                    </div>
                  )}
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
                        color: 'var(--color-text-inverse)',
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
                  {t('crm.empty.noDeals')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
