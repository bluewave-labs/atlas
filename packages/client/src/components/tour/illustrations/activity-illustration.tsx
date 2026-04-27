import type { ActivityData } from '../tour-types';
import { BADGE_TONES } from '../badge-tones';

export function ActivityIllustration({ data }: { data: ActivityData }) {
  const visibleEvents = data.events.slice(0, 4);

  return (
    <div className="tour-illust tour-illust--activity">
      <div className="tour-illust-contact">
        <div
          className="tour-illust-avatar tour-illust-avatar--lg"
          style={{ background: data.contact.avatarColor }}
        >
          {data.contact.initials}
        </div>
        <div className="tour-illust-contact-text">
          <div className="tour-illust-contact-name">{data.contact.name}</div>
          <div className="tour-illust-contact-meta">{data.contact.meta}</div>
        </div>
        {data.contact.badge && (
          <span
            className="tour-illust-badge"
            style={{
              background: BADGE_TONES[data.contact.badge.tone].bg,
              color: BADGE_TONES[data.contact.badge.tone].fg,
            }}
          >
            {data.contact.badge.label}
          </span>
        )}
      </div>

      <div className="tour-illust-activity-label">Activity</div>

      <div className="tour-illust-activity-list">
        {visibleEvents.map((event, index) => {
          const opacity = index === 0 ? 1 : Math.max(0.3, 1 - index * 0.25);
          return (
            <div
              key={index}
              className="tour-illust-activity-item"
              style={{ opacity }}
            >
              <div
                className={`tour-illust-activity-dot${event.isLive ? ' tour-illust-activity-dot--live' : ''}`}
              />
              <div className="tour-illust-activity-text">
                <div className="tour-illust-activity-event">{event.text}</div>
                <div className="tour-illust-activity-time">{event.timestamp}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tour-illust-fade" />
    </div>
  );
}
