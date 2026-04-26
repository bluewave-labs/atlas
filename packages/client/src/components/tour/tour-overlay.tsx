import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const modalRef = useRef<HTMLDivElement | null>(null);
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

    const recompute = () => {
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

    recompute();
    window.addEventListener('resize', recompute);
    const ro = new ResizeObserver(recompute);
    const dock = document.querySelector('[data-tour-target]');
    if (dock?.parentElement) ro.observe(dock.parentElement);

    return () => {
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

  const handleClose = handleSkip;

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

      <div
        className="tour-spotlight"
        style={{
          background: `radial-gradient(circle at ${position.spotlightX}px ${position.spotlightY}px, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.08) 60px, rgba(255,255,255,0) 130px, rgba(0,0,0,0) 100%)`,
        }}
      />

      <div
        className="tour-vignette"
        style={{
          background: `radial-gradient(circle at ${position.spotlightX}px ${position.spotlightY}px, transparent 0, transparent 140px, rgba(0,0,0,0.35) 320px)`,
        }}
      />

      <div
        className="tour-icon-ring"
        style={{
          left: position.iconRect.left - 4,
          top: position.iconRect.top - 4,
          width: position.iconRect.width + 8,
          height: position.iconRect.height + 8,
        }}
      />

      <div ref={modalRef}>
        <TourModal
          step={currentStep}
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
          modalLeft={position.modalLeft}
          modalTop={position.modalTop}
          caretLeft={position.caretLeft}
          onPrev={prev}
          onNext={handleNext}
          onSkip={handleSkip}
          onClose={handleClose}
        />
      </div>
    </>
  );
}
