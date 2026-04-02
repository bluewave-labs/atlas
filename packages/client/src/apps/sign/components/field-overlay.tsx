import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { Rnd } from 'react-rnd';
import { Trash2, CheckSquare, ChevronDown, PenTool, Type, Calendar, AlignLeft, User, Mail } from 'lucide-react';
import type { SignatureField, SignatureFieldType } from '@atlasmail/shared';

// ─── Color map ──────────────────────────────────────────────────────

const FIELD_COLORS: Record<SignatureFieldType, { border: string; bg: string; label: string }> = {
  signature: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', label: 'Signature' },
  initials: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', label: 'Initials' },
  date: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', label: 'Date' },
  text: { border: '#6b7280', bg: 'rgba(107, 114, 128, 0.08)', label: 'Text' },
  checkbox: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'Checkbox' },
  dropdown: { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.08)', label: 'Dropdown' },
  name: { border: '#0891b2', bg: 'rgba(8, 145, 178, 0.08)', label: 'Name' },
  email: { border: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', label: 'Email' },
};

const FIELD_ICONS: Record<SignatureFieldType, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  signature: PenTool,
  initials: Type,
  date: Calendar,
  text: AlignLeft,
  checkbox: CheckSquare,
  dropdown: ChevronDown,
  name: User,
  email: Mail,
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
  /** Enable click-to-sign on fields without enabling drag/resize (for public signing) */
  signable?: boolean;
  /** Signer color override (used to tint fields by signer) */
  signerColor?: string;
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
  signable = false,
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
          signable={signable}
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
  signable?: boolean;
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
  signable = false,
  onMove,
  onResize,
  onClick,
  onDelete,
}: FieldBoxProps) {
  const colors = FIELD_COLORS[field.type] || FIELD_COLORS.text;
  const FieldIcon = FIELD_ICONS[field.type] || AlignLeft;

  // Pixel positions from percentage-based x/y/width/height
  const left = (field.x / 100) * pageWidth;
  const top = (field.y / 100) * pageHeight;
  const width = (field.width / 100) * pageWidth;
  const height = (field.height / 100) * pageHeight;

  const minWidth = (3 / 100) * pageWidth;
  const minHeight = (2 / 100) * pageHeight;

  const isInteractive = editable || signable;

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      if (isInteractive) {
        onClick?.(field.id);
      }
    },
    [isInteractive, onClick, field.id],
  );

  const handleDelete = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      onDelete?.(field.id);
    },
    [onDelete, field.id],
  );

  // Shared field content
  const fieldContent = (
    <div
      className="sign-field"
      data-field-id={field.id}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        borderLeft: `3px solid ${colors.border}`,
        borderTop: `1px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? '#3b82f6' : 'var(--color-border-primary)'}`,
        borderRight: `1px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? '#3b82f6' : 'var(--color-border-primary)'}`,
        borderBottom: `1px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? '#3b82f6' : 'var(--color-border-primary)'}`,
        background: isHighlighted ? `${colors.border}15` : colors.bg,
        borderRadius: 'var(--radius-sm)',
        cursor: editable ? 'move' : isInteractive ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: isHighlighted
          ? `0 0 0 3px ${colors.border}40, 0 0 12px ${colors.border}30`
          : isSelected
            ? '0 0 0 2px rgba(59, 130, 246, 0.3)'
            : 'none',
        animation: isHighlighted ? 'sign-field-pulse 1.5s ease-in-out infinite' : 'none',
        position: 'relative',
      }}
    >
      {/* Type icon in top-left corner */}
      {!field.signatureData && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: 5,
            opacity: 0.5,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          <FieldIcon size={10} style={{ color: colors.border }} />
          <span
            style={{
              fontSize: 9,
              color: colors.border,
              fontFamily: 'var(--font-family)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {colors.label}
          </span>
        </div>
      )}

      {/* Field content: signature image, checkbox, dropdown, or label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', pointerEvents: 'none' }}>
        {field.type === 'checkbox' ? (
          <CheckSquare
            size={Math.min(width, height) * 0.5}
            style={{
              color: field.signatureData === 'checked' ? colors.border : `${colors.border}40`,
              pointerEvents: 'none',
            }}
          />
        ) : field.type === 'dropdown' ? (
          field.signatureData ? (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                fontWeight: 500,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              {field.signatureData}
            </span>
          ) : (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 'var(--font-size-xs)',
                color: colors.border,
                fontFamily: 'var(--font-family)',
                fontWeight: 500,
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: 0.7,
              }}
            >
              {colors.label}
              <ChevronDown size={12} />
            </span>
          )
        ) : field.signatureData ? (
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
              opacity: 0.6,
            }}
          >
            {field.label || colors.label}
          </span>
        )}
      </div>

      {/* Delete button (top-right, visible on hover or select) */}
      {editable && (
        <button
          className="sign-field-delete-btn"
          aria-label="Delete field"
          onClick={handleDelete}
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
            opacity: isSelected ? 1 : 0,
            transition: 'opacity 0.15s',
            pointerEvents: isSelected ? 'auto' : 'none',
          }}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );

  // Non-editable: render as a plain positioned div (no drag/resize)
  if (!editable) {
    return (
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          pointerEvents: isInteractive ? 'auto' : 'none',
          zIndex: 1,
        }}
      >
        {fieldContent}
      </div>
    );
  }

  // Editable: use react-rnd for drag + resize
  return (
    <Rnd
      position={{ x: left, y: top }}
      size={{ width, height }}
      minWidth={minWidth}
      minHeight={minHeight}
      bounds="parent"
      enableResizing={isSelected ? {
        bottomRight: true,
        bottomLeft: false,
        topRight: false,
        topLeft: false,
        top: false,
        bottom: true,
        left: false,
        right: true,
      } : false}
      resizeHandleStyles={{
        bottomRight: {
          width: 10,
          height: 10,
          bottom: -2,
          right: -2,
          cursor: 'nwse-resize',
          zIndex: 10,
          background: `radial-gradient(circle, ${colors.border} 1.5px, transparent 1.5px)`,
          backgroundSize: '4px 4px',
          backgroundPosition: 'center',
          borderRadius: 'var(--radius-sm)',
        },
        bottom: {
          height: 6,
          bottom: -3,
          cursor: 'ns-resize',
        },
        right: {
          width: 6,
          right: -3,
          cursor: 'ew-resize',
        },
      }}
      onDragStop={(_e, d) => {
        const newX = (d.x / pageWidth) * 100;
        const newY = (d.y / pageHeight) * 100;
        const maxX = 100 - field.width;
        const maxY = 100 - field.height;
        onMove?.(field.id, Math.max(0, Math.min(maxX, newX)), Math.max(0, Math.min(maxY, newY)));
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const newW = (parseFloat(ref.style.width) / pageWidth) * 100;
        const newH = (parseFloat(ref.style.height) / pageHeight) * 100;
        const newX = (pos.x / pageWidth) * 100;
        const newY = (pos.y / pageHeight) * 100;
        // Commit both position and size
        onMove?.(field.id, Math.max(0, newX), Math.max(0, newY));
        onResize?.(field.id, Math.max(3, newW), Math.max(2, newH));
      }}
      style={{
        zIndex: isSelected ? 10 : 1,
      }}
    >
      {fieldContent}
    </Rnd>
  );
}
