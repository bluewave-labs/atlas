import type { KanbanData } from '../tour-types';

export function KanbanIllustration({ data }: { data: KanbanData }) {
  const cols = data.columns.slice(0, 3);

  // Position the dragged card horizontally as the midpoint between source and target columns
  const draggedLeftPct = data.draggedCard
    ? ((data.draggedCard.fromColumn + data.draggedCard.toColumn) / 2) * (100 / cols.length) +
      100 / cols.length / 2 -
      18
    : 0;

  return (
    <div className="tour-illust tour-illust--kanban">
      <div className="tour-illust-kanban-grid">
        {cols.map((col, colIndex) => (
          <div key={colIndex} className="tour-illust-kanban-col">
            <div className="tour-illust-kanban-label">
              {col.label} · {col.count}
            </div>
            {col.cards.slice(0, 3).map((card, cardIndex) => {
              const showDropSlot =
                data.draggedCard &&
                data.draggedCard.toColumn === colIndex &&
                cardIndex === 1;
              return (
                <div key={cardIndex}>
                  {showDropSlot && <div className="tour-illust-kanban-slot" />}
                  <div className="tour-illust-kanban-card">
                    <div className="tour-illust-kanban-card-primary">{card.primary}</div>
                    <div className="tour-illust-kanban-card-secondary">{card.secondary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {data.draggedCard && (
        <>
          <div
            className="tour-illust-kanban-dragged"
            style={{ left: `${draggedLeftPct}%` }}
          >
            <div className="tour-illust-kanban-card-primary">{data.draggedCard.primary}</div>
            <div className="tour-illust-kanban-card-secondary">{data.draggedCard.secondary}</div>
          </div>
          {data.draggedCard.collaborator && (
            <>
              <svg
                className="tour-illust-cursor tour-illust-cursor--kanban"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                style={{ left: `calc(${draggedLeftPct}% + 60px)` }}
                aria-hidden="true"
              >
                <path
                  d="M2 1 L2 11 L5 8 L7 12 L9 11 L7 7 L11 7 Z"
                  fill={data.draggedCard.collaborator.color}
                  stroke="white"
                  strokeWidth="0.8"
                />
              </svg>
              <span
                className="tour-illust-cursor-flag tour-illust-cursor-flag--kanban"
                style={{
                  left: `calc(${draggedLeftPct}% + 76px)`,
                  background: data.draggedCard.collaborator.color,
                }}
              >
                {data.draggedCard.collaborator.name}
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
