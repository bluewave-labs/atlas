import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MapPin, Users, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { StatusDot } from '../../../components/ui/status-dot';
import { formatDate, formatDateTime } from '../../../lib/format';
import {
  useContactEvents,
  useDealEvents,
  useGoogleSyncStatus,
  type CrmCalendarEvent,
} from '../hooks';
import { ScheduleEventModal } from './schedule-event-modal';

function EventStatusDot({ status }: { status: string }) {
  const color =
    status === 'confirmed' ? 'var(--color-success)' :
    status === 'tentative' ? 'var(--color-warning)' :
    status === 'cancelled' ? 'var(--color-error)' :
    'var(--color-text-tertiary)';

  return <StatusDot color={color} size={8} />;
}

function EventItem({ event }: { event: CrmCalendarEvent }) {
  const { t } = useTranslation();
  const isCancelled = event.status === 'cancelled';
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const timeDisplay = event.isAllDay
    ? formatDate(event.startTime)
    : `${formatDateTime(event.startTime)} - ${formatDateTime(event.endTime)}`;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--spacing-sm)',
      padding: 'var(--spacing-sm) var(--spacing-md)',
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-md)',
      opacity: isCancelled ? 0.6 : 1,
    }}>
      <div style={{ paddingTop: 5, flexShrink: 0 }}>
        <EventStatusDot status={event.status} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}>
          {event.summary || t('common.noSubject')}
        </div>

        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          marginTop: 2,
        }}>
          {timeDisplay}
        </div>

        {event.location && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xs)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            marginTop: 2,
          }}>
            <MapPin size={11} />
            <span>{event.location}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 4 }}>
          {event.attendees && event.attendees.length > 0 && (
            <Badge variant="default">
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Users size={10} />
                {event.attendees.length}
              </span>
            </Badge>
          )}
        </div>
      </div>

      {event.htmlLink && (
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, paddingTop: 2 }}
          title={t('crm.calendar.openInGoogle')}
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

export function CalendarEvents({
  contactId,
  dealId,
  defaultAttendee,
}: {
  contactId?: string;
  dealId?: string;
  defaultAttendee?: string;
}) {
  const { t } = useTranslation();
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);

  const { data: status } = useGoogleSyncStatus();
  const { data: contactEvents, isLoading: contactLoading } = useContactEvents(contactId);
  const { data: dealEvents, isLoading: dealLoading } = useDealEvents(dealId);

  const events = contactId ? contactEvents : dealEvents;
  const isLoading = contactId ? contactLoading : dealLoading;
  const googleConnected = status?.connected ?? false;

  const now = useMemo(() => new Date(), []);

  const { upcoming, past } = useMemo(() => {
    if (!events) return { upcoming: [], past: [] };
    const up: CrmCalendarEvent[] = [];
    const pa: CrmCalendarEvent[] = [];
    for (const e of events) {
      if (new Date(e.startTime) > now) {
        up.push(e);
      } else {
        pa.push(e);
      }
    }
    up.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    pa.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return { upcoming: up, past: pa };
  }, [events, now]);

  if (!googleConnected) {
    return (
      <div style={{
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
      }}>
        <CalendarDays size={24} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
        <div>{t('crm.calendar.connectToView')}</div>
      </div>
    );
  }

  const displayedPast = showAllPast ? past : past.slice(0, 5);

  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-family)',
        }}>
          {t('crm.calendar.title')}
        </span>
        <Button variant="secondary" size="sm" icon={<CalendarDays size={14} />} onClick={() => setShowSchedule(true)}>
          {t('crm.calendar.schedule')}
        </Button>
      </div>

      {isLoading ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
          {t('common.loading')}
        </div>
      ) : (!events || events.length === 0) ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
          {t('crm.calendar.noEvents')}
        </div>
      ) : (
        <>
          {/* Upcoming events */}
          {upcoming.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: 'var(--font-family)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                {t('crm.calendar.upcoming')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {upcoming.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Past events */}
          {past.length > 0 && (
            <div>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: 'var(--font-family)',
                marginBottom: 'var(--spacing-sm)',
              }}>
                {t('crm.calendar.past')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                {displayedPast.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
              {past.length > 5 && !showAllPast && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<ChevronDown size={14} />}
                  onClick={() => setShowAllPast(true)}
                  style={{ marginTop: 'var(--spacing-sm)' }}
                >
                  {t('crm.calendar.showMore', { count: past.length - 5 })}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Schedule modal */}
      <ScheduleEventModal
        open={showSchedule}
        onClose={() => setShowSchedule(false)}
        defaultAttendee={defaultAttendee}
        contactId={contactId}
        dealId={dealId}
      />
    </div>
  );
}
