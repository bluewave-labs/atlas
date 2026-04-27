import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { appRegistry } from '../../apps';
import { useMyAccessibleApps } from '../../hooks/use-app-permissions';
import { useTour } from './use-tour';
import type { TourStep } from './tour-types';

interface TourStatusResponse {
  tourCompletedAt: string | null;
}

function buildStep(app: ReturnType<typeof appRegistry.getAll>[number]): TourStep {
  return {
    appId: app.id,
    appColor: app.color,
    config: app.tour!,
    titleKey: `${app.id}.tour.title`,
    descriptionKey: `${app.id}.tour.description`,
  };
}

export function useTourBootstrap() {
  const { open, isOpen } = useTour();
  const accessibleQuery = useMyAccessibleApps();
  const tourStatusQuery = useQuery({
    queryKey: queryKeys.tour.status,
    queryFn: async () => {
      const { data } = await api.get('/system/tour');
      return data.data as TourStatusResponse;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isOpen) return;
    if (!tourStatusQuery.data || !accessibleQuery.data) return;
    if (tourStatusQuery.data.tourCompletedAt !== null) return;

    const accessibleAppIds = accessibleQuery.data.appIds;
    const tourApps = appRegistry
      .getAll()
      .filter((app) => app.tour !== undefined)
      .filter((app) => {
        if (accessibleAppIds === '__all__') return true;
        return Array.isArray(accessibleAppIds) && accessibleAppIds.includes(app.id);
      });

    if (tourApps.length === 0) return;

    const steps: TourStep[] = tourApps.map(buildStep);

    // Defer to after first paint so the dock renders before the overlay drops in
    const id = window.setTimeout(() => open(steps), 150);
    return () => window.clearTimeout(id);
  }, [tourStatusQuery.data, accessibleQuery.data, isOpen, open]);
}

/** Replay path used by the user-menu "Take the tour" entry. Ignores tourCompletedAt. */
export function replayTour() {
  const { open } = useTour.getState();
  const steps: TourStep[] = appRegistry
    .getAll()
    .filter((app) => app.tour !== undefined)
    .map(buildStep);
  if (steps.length > 0) open(steps);
}
