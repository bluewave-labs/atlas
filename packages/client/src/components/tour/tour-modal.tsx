import { useTranslation } from 'react-i18next';
import type { TourStep } from './tour-types';
import { TourIllustration } from './tour-illustration';

interface TourModalProps {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  modalLeft: number;
  modalTop: number;
  caretLeft: number;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function TourModal({
  step,
  stepIndex,
  totalSteps,
  modalLeft,
  modalTop,
  caretLeft,
  onPrev,
  onNext,
  onSkip,
  onClose,
}: TourModalProps) {
  const { t } = useTranslation();
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      className="tour-modal"
      style={{ left: modalLeft, top: modalTop }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
    >
      <div className="tour-modal-header">
        <span
          className="tour-modal-app-color"
          style={{ background: step.appColor }}
          aria-hidden="true"
        />
        <span id="tour-modal-title" className="tour-modal-title">
          {t(step.titleKey)}
        </span>
        <button
          type="button"
          className="tour-modal-close"
          onClick={onClose}
          aria-label={t('tour.skip')}
        >
          ×
        </button>
      </div>

      <div className="tour-modal-body">
        <p className="tour-modal-description">{t(step.descriptionKey)}</p>
        <TourIllustration config={step.config} />
      </div>

      <div className="tour-modal-footer">
        <span className="tour-modal-step-counter">
          {t('tour.stepCounter', { current: stepIndex + 1, total: totalSteps })}
        </span>
        <div className="tour-modal-actions">
          {!isFirst && (
            <button type="button" className="tour-modal-btn tour-modal-btn--ghost" onClick={onPrev}>
              {t('tour.previous')}
            </button>
          )}
          <button type="button" className="tour-modal-btn tour-modal-btn--ghost tour-modal-btn--skip" onClick={onSkip}>
            {t('tour.skip')}
          </button>
          <button type="button" className="tour-modal-btn tour-modal-btn--primary" onClick={onNext}>
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>

      <span
        className="tour-modal-caret"
        style={{ left: caretLeft }}
        aria-hidden="true"
      />
    </div>
  );
}
