import { useEffect, useLayoutEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { useTour } from './use-tour';
import { TourModal } from './tour-modal';
import { computeTourPosition, type TourPosition } from './tour-target';
import './tour.css';

export function TourOverlay() {
  const { isOpen, steps, currentStepIndex, prev, next, skip, finish } = useTour();
  const [position, setPosition] = useState<TourPosition | null>(null);
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: async (skipped: boolean) => {
      await api.patch('/system/tour/complete', { skipped });
    },
    onSettled: () => {
      // Mark cache as completed regardless of network outcome so reload doesn't re-fire.
      queryClient.setQueryData(queryKeys.tour.status, { tourCompletedAt: new Date().toISOString() });
    },
  });

  const currentStep = steps[currentStepIndex];

  // Recompute position whenever the active step or viewport changes
  useLayoutEffect(() => {
    if (!isOpen || !currentStep) {
      setPosition(null);
      return;
    }

    // Reset all dock items to idle size before measuring — the dock's
    // magnification logic may have left transient inline styles behind that
    // would skew getBoundingClientRect() on the very first step.
    const resetDockItems = () => {
      document.querySelectorAll<HTMLElement>('.dock-item').forEach((el) => {
        // Kill the post-mouseleave CSS transition first — measuring during it
        // returns mid-flight rect values that misplace the spotlight ring.
        el.classList.remove('dock-resetting');
        el.style.width = '52px';
        el.style.height = '52px';
        el.style.marginTop = '0px';
        el.style.setProperty('--dock-icon-size', '30px');
      });
    };

    const recompute = () => {
      resetDockItems();
      const dockItem = document.querySelector<HTMLElement>(
        `[data-tour-target="${currentStep.appId}"]`,
      );
      if (!dockItem) {
        setPosition(null);
        return;
      }
      // Measure the visible rounded square (dock-icon-inner), not the wrapper
      const iconEl = dockItem.querySelector<HTMLElement>('.dock-icon-inner') ?? dockItem;
      const iconRect = iconEl.getBoundingClientRect();
      const modalEl = document.querySelector<HTMLElement>('.tour-modal');
      const measuredHeight = modalEl?.offsetHeight ?? 0;
      const modalHeight = measuredHeight > 0 ? measuredHeight : 380;
      setPosition(
        computeTourPosition(
          {
            left: iconRect.left,
            top: iconRect.top,
            width: iconRect.width,
            height: iconRect.height,
          },
          { width: window.innerWidth, height: window.innerHeight },
          modalHeight,
        ),
      );
    };

    // Initial recompute synchronously (gets us close), then schedule
    // follow-up recomputes at increasing delays. The very first measurement
    // happens while the dock is still settling its layout from the page
    // load, so we re-measure at 50ms, 200ms, and 500ms to catch the final
    // resting position. This mirrors what happens when the user navigates
    // Prev→Next and back: by then the dock has fully settled.
    recompute();
    const delays = [50, 200, 500];
    const timers = delays.map((d) => window.setTimeout(recompute, d));

    window.addEventListener('resize', recompute);
    const ro = new ResizeObserver(recompute);
    const dock = document.querySelector('[data-tour-target]');
    if (dock?.parentElement) ro.observe(dock.parentElement);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('resize', recompute);
      ro.disconnect();
    };
  }, [isOpen, currentStep, currentStepIndex]);

  // Re-measure once the modal has rendered (so we know the real height)
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    const modalEl = document.querySelector<HTMLElement>('.tour-modal');
    if (!modalEl) return;
    const dockItem = document.querySelector<HTMLElement>(
      `[data-tour-target="${currentStep.appId}"]`,
    );
    if (!dockItem) return;
    const iconEl = dockItem.querySelector<HTMLElement>('.dock-icon-inner') ?? dockItem;
    const iconRect = iconEl.getBoundingClientRect();
    setPosition(
      computeTourPosition(
        {
          left: iconRect.left,
          top: iconRect.top,
          width: iconRect.width,
          height: iconRect.height,
        },
        { width: window.innerWidth, height: window.innerHeight },
        modalEl.offsetHeight,
      ),
    );
    // Only depend on inputs, not on position — would create an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStepIndex, currentStep]);

  // Esc → skip
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeMutation.mutate(true);
        skip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, skip, completeMutation]);

  if (!isOpen || !currentStep || !position) return null;

  const handleSkip = () => {
    completeMutation.mutate(true);
    skip();
  };

  const handleNext = () => {
    const isLast = currentStepIndex === steps.length - 1;
    if (isLast) {
      completeMutation.mutate(false);
      finish();
    } else {
      next();
    }
  };

  return (
    <>
      <div className="tour-backdrop" onClick={handleSkip} />
      <TourModal
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={steps.length}
        position={position}
        onPrev={prev}
        onNext={handleNext}
        onSkip={handleSkip}
      />
    </>
  );
}
