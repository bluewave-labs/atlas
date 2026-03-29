import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import type { SignatureField, SignatureFieldType } from '@atlasmail/shared';

// ─── Color map ──────────────────────────────────────────────────────

const FIELD_COLORS: Record<SignatureFieldType, { border: string; bg: string; label: string }> = {
  signature: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', label: 'Signature' },
  initials: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', label: 'Initials' },
  date: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', label: 'Date' },
  text: { border: '#6b7280', bg: 'rgba(107, 114, 128, 0.08)', label: 'Text' },
};

// ─── Types ──────────────────────────────────────────────────────────

interface FieldOverlayProps {
  fields: SignatureField[];
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  onFieldMove?: (id: string, x: number, y: number) => void;
  onFieldResize?: (id: string, w: number, h: number) => void;
  onFieldClick?: (id: string) => void;
  onFieldDelete?: (id: string) => void;
  selectedFieldId?: string;
  highlightFieldId?: string;
  editable?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export function FieldOverlay({
  fields,
  pageNumber,
  pageWidth,
  pageHeight,
  onFieldMove,
  onFieldResize,
  onFieldClick,
  onFieldDelete,
  selectedFieldId,
  highlightFieldId,
  editable = false,
}: FieldOverlayProps) {
  const pageFields = fields.filter((f) => f.pageNumber === pageNumber);

  return (
    <>
      {pageFields.map((field) => (
        <FieldBox
          key={field.id}
          field={field}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          isSelected={selectedFieldId === field.id}
          isHighlighted={highlightFieldId === field.id}
          editable={editable}
          onMove={onFieldMove}
          onResize={onFieldResize}
          onClick={onFieldClick}
          onDelete={onFieldDelete}
        />
      ))}
    </>
  );
}

// ─── Individual field box ───────────────────────────────────────────

interface FieldBoxProps {
  field: SignatureField;
  pageWidth: number;
  pageHeight: number;
  isSelected: boolean;
  isHighlighted?: boolean;
  editable: boolean;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, w: number, h: number) => void;
  onClick?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function FieldBox({
  field,
  pageWidth,
  pageHeight,
  isSelected,
  isHighlighted = false,
  editable,
  onMove,
  onResize,
  onClick,
  onDelete,
}: FieldBoxProps) {
  const colors = FIELD_COLORS[field.type] || FIELD_COLORS.text;
  const boxRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; fieldX: number; fieldY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; fieldW: number; fieldH: number } | null>(null);

  // Pixel positions from percentage-based x/y/width/height
  const left = (field.x / 100) * pageWidth;
  const top = (field.y / 100) * pageHeight;
  const width = (field.width / 100) * pageWidth;
  const height = (field.height / 100) * pageHeight;

  // ─── Drag handler ─────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!editable || !onMove) return;
      e.preventDefault();
      e.stopPropagation();
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        fieldX: field.x,
        fieldY: field.y,
      };

      function handleMouseMove(ev: globalThis.MouseEvent) {
        if (!dragState.current) return;
        const dx = ev.clientX - dragState.current.startX;
        const dy = ev.clientY - dragState.current.startY;
        const newX = dragState.current.fieldX + (dx / pageWidth) * 100;
        const newY = dragState.current.fieldY + (dy / pageHeight) * 100;
        onMove!(field.id, Math.max(0, Math.min(100 - field.width, newX)), Math.max(0, Math.min(100 - field.height, newY)));
      }

      function handleMouseUp() {
        dragState.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [editable, onMove, field.id, field.x, field.y, field.width, field.height, pageWidth, pageHeight],
  );

  // ─── Resize handler ───────────────────────────────────────────────

  const handleResizeMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      if (!editable || !onResize) return;
      e.preventDefault();
      e.stopPropagation();
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        fieldW: field.width,
        fieldH: field.height,
      };

      function handleMouseMove(ev: globalThis.MouseEvent) {
        if (!resizeState.current) return;
        const dx = ev.clientX - resizeState.current.startX;
        const dy = ev.clientY - resizeState.current.startY;
        const newW = resizeState.current.fieldW + (dx / pageWidth) * 100;
        const newH = resizeState.current.fieldH + (dy / pageHeight) * 100;
        onResize!(field.id, Math.max(3, Math.min(100 - field.x, newW)), Math.max(2, Math.min(100 - field.y, newH)));
      }

      function handleMouseUp() {
        resizeState.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [editable, onResize, field.id, field.x, field.y, field.width, field.height, pageWidth, pageHeight],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      dragState.current = null;
      resizeState.current = null;
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className="sign-field"
      data-field-id={field.id}
      onMouseDown={editable ? handleMouseDown : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(field.id);
      }}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: `2px ${isSelected || isHighlighted ? 'solid' : 'dashed'} ${colors.border}`,
        background: isHighlighted ? `${colors.border}20` : colors.bg,
        borderRadius: 'var(--radius-sm)',
        cursor: editable ? 'move' : 'pointer',
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: isHighlighted ? `0 0 0 3px ${colors.border}40, 0 0 12px ${colors.border}30` : 'none',
        animation: isHighlighted ? 'sign-field-pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      {/* Field content: signature image or label */}
      {field.signatureData ? (
        <img
          src={field.signatureData}
          alt="Signature"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: colors.border,
            fontFamily: 'var(--font-family)',
            fontWeight: 500,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {colors.label}
        </span>
      )}

      {/* Delete button (top-right) */}
      {editable && isSelected && (
        <button
          aria-label="Delete field"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(field.id);
          }}
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--color-error)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            zIndex: 10,
          }}
        >
          <Trash2 size={10} />
        </button>
      )}

      {/* Resize handle (bottom-right corner) */}
      {editable && isSelected && (
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 8,
            height: 8,
            background: colors.border,
            borderRadius: 'var(--radius-sm)',
            cursor: 'nwse-resize',
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
