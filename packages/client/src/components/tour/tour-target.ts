const MODAL_WIDTH = 340;
const MODAL_GAP = 32;        // distance between modal bottom edge and icon top edge
const VIEWPORT_PADDING = 12; // minimum gap between modal and viewport edges
const CARET_HALF_WIDTH = 8;
const MIN_CARET_OFFSET = 16; // caret can't get closer than this to modal edges

export interface TourPosition {
  /** Modal top-left position in viewport pixels */
  modalLeft: number;
  modalTop: number;
  /** Caret horizontal offset from modal's left edge (px) */
  caretLeft: number;
  /** Spotlight center for the radial gradient (viewport px) */
  spotlightX: number;
  spotlightY: number;
  /** Icon rect echoed back so the overlay can draw the white ring on it */
  iconRect: { left: number; top: number; width: number; height: number };
}

/**
 * Compute the modal/caret/spotlight positions for a target dock-icon rect.
 * Modal is always above the icon. Edge-clamps inward without ever going off-screen.
 * Caret tracks the icon center even when the modal is clamped.
 */
export function computeTourPosition(
  iconRect: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
  modalHeight: number,
): TourPosition {
  const iconCenterX = iconRect.left + iconRect.width / 2;
  const iconTop = iconRect.top;

  // Default: center modal horizontally on the icon
  let modalLeft = Math.round(iconCenterX - MODAL_WIDTH / 2);

  // Clamp horizontally
  const minLeft = VIEWPORT_PADDING;
  const maxLeft = viewport.width - MODAL_WIDTH - VIEWPORT_PADDING;
  if (modalLeft < minLeft) modalLeft = minLeft;
  if (modalLeft > maxLeft) modalLeft = maxLeft;

  // Modal sits above the icon
  let modalTop = Math.round(iconTop - modalHeight - MODAL_GAP);
  if (modalTop < VIEWPORT_PADDING) modalTop = VIEWPORT_PADDING;

  // Caret points down at the icon center; constrain so it doesn't run past modal edges
  const minCaret = MIN_CARET_OFFSET + CARET_HALF_WIDTH;
  const maxCaret = MODAL_WIDTH - MIN_CARET_OFFSET - CARET_HALF_WIDTH;
  let caretLeft = iconCenterX - modalLeft;
  if (caretLeft < minCaret) caretLeft = minCaret;
  if (caretLeft > maxCaret) caretLeft = maxCaret;

  return {
    modalLeft,
    modalTop,
    caretLeft,
    spotlightX: iconCenterX,
    spotlightY: iconRect.top + iconRect.height / 2,
    iconRect,
  };
}
