import { useState, useMemo, useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  List,
  GitBranch,
  // Object icons
  Building2,
  Users,
  Target,
  BarChart3,
  Activity,
  UserPlus,
  FileText,
  Table2,
  HardDrive,
  Pencil,
  CheckSquare,
  FolderOpen,
  Clock,
  MessageSquare,
  Link2,
  PenTool,
  Key,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import { Chip } from '../ui/chip';
import {
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
} from './settings-primitives';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  Building2,
  Users,
  Target,
  BarChart3,
  Activity,
  UserPlus,
  FileText,
  Table2,
  HardDrive,
  Pencil,
  CheckSquare,
  FolderOpen,
  Clock,
  MessageSquare,
  Link2,
  PenTool,
  Key,
};

function ObjectIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Icon = ICON_MAP[name] ?? FileText;
  return <Icon size={size} />;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataModelObject {
  id: string;
  appId: string;
  appName: string;
  appColor: string;
  name: string;
  iconName: string;
  tableName: string;
  description?: string;
  standardFieldCount: number;
  customFieldCount: number;
  totalFieldCount: number;
  instanceCount: number;
  relationCount: number;
}

interface FieldMeta {
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  description?: string;
}

interface CustomField {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  options: Record<string, unknown>;
}

interface ObjectDetail {
  object: {
    id: string;
    name: string;
    iconName: string;
    description?: string;
    relations: Array<{
      targetObjectId: string;
      type: string;
      foreignKey?: string;
    }>;
  };
  standardFields: FieldMeta[];
  customFields: CustomField[];
}

// ---------------------------------------------------------------------------
// Field type options
// ---------------------------------------------------------------------------

function useFieldTypeOptions(): Array<{ value: string; label: string }> {
  const { t } = useTranslation();
  return useMemo(() => [
    { value: 'text', label: t('settingsPanel.dataModel.fieldText', 'Text') },
    { value: 'number', label: t('settingsPanel.dataModel.fieldNumber', 'Number') },
    { value: 'date', label: t('settingsPanel.dataModel.fieldDate', 'Date') },
    { value: 'boolean', label: t('settingsPanel.dataModel.fieldBoolean', 'Boolean') },
    { value: 'select', label: t('settingsPanel.dataModel.fieldSelect', 'Select') },
    { value: 'multi_select', label: t('settingsPanel.dataModel.fieldMultiSelect', 'Multi-select') },
    { value: 'email', label: t('settingsPanel.dataModel.fieldEmail', 'Email') },
    { value: 'phone', label: t('settingsPanel.dataModel.fieldPhone', 'Phone') },
    { value: 'url', label: t('settingsPanel.dataModel.fieldUrl', 'URL') },
    { value: 'json', label: t('settingsPanel.dataModel.fieldJson', 'JSON') },
    { value: 'relation', label: t('settingsPanel.dataModel.fieldRelation', 'Relation') },
  ], [t]);
}

// ---------------------------------------------------------------------------
// Field type badge color
// ---------------------------------------------------------------------------

function fieldTypeBadgeColor(ft: string): string | undefined {
  const map: Record<string, string> = {
    text: 'var(--color-text-tertiary)',
    number: '#6366f1',
    date: '#f59e0b',
    boolean: '#10b981',
    select: '#8b5cf6',
    multi_select: '#8b5cf6',
    email: '#3b82f6',
    phone: '#14b8a6',
    url: '#3b82f6',
    json: '#64748b',
    relation: '#f97316',
  };
  return map[ft];
}

// ---------------------------------------------------------------------------
// Slug generator
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// ---------------------------------------------------------------------------
// DataModelPanel (main export)
// ---------------------------------------------------------------------------

export function DataModelPanel() {
  const [selectedObject, setSelectedObject] = useState<{ appId: string; objectId: string } | null>(null);

  if (selectedObject) {
    return (
      <ObjectDetailView
        appId={selectedObject.appId}
        objectId={selectedObject.objectId}
        onBack={() => setSelectedObject(null)}
      />
    );
  }

  return <ObjectListView onSelect={(appId, objectId) => setSelectedObject({ appId, objectId })} />;
}

// ---------------------------------------------------------------------------
// ER Diagram view
// ---------------------------------------------------------------------------

const DIAGRAM_BOX_W = 200;
const DIAGRAM_BOX_H = 72;
const DIAGRAM_GAP_X = 60;
const DIAGRAM_GAP_Y = 50;
const DIAGRAM_COLS = 3;
const DIAGRAM_PAD = 24;

interface DiagramBoxPos {
  x: number;
  y: number;
  obj: DataModelObject;
}

function DataModelDiagram({
  objects,
  allObjects,
  onSelect,
}: {
  objects: DataModelObject[];
  allObjects: DataModelObject[];
  onSelect: (appId: string, objectId: string) => void;
}) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Group by app to keep related objects together
  const grouped = useMemo(() => {
    const groups = new Map<string, DataModelObject[]>();
    objects.forEach((o) => {
      const arr = groups.get(o.appId) || [];
      arr.push(o);
      groups.set(o.appId, arr);
    });
    const flat: DataModelObject[] = [];
    groups.forEach((arr) => flat.push(...arr));
    return flat;
  }, [objects]);

  // Calculate positions in a grid
  const positions = useMemo<DiagramBoxPos[]>(() => {
    return grouped.map((obj, idx) => ({
      x: DIAGRAM_PAD + (idx % DIAGRAM_COLS) * (DIAGRAM_BOX_W + DIAGRAM_GAP_X),
      y: DIAGRAM_PAD + Math.floor(idx / DIAGRAM_COLS) * (DIAGRAM_BOX_H + DIAGRAM_GAP_Y),
      obj,
    }));
  }, [grouped]);

  // Build a lookup from object id to position
  const posMap = useMemo(() => {
    const map = new Map<string, DiagramBoxPos>();
    positions.forEach((p) => map.set(p.obj.id, p));
    return map;
  }, [positions]);

  // Fetch detail for relations — use allObjects to find relations
  // We need to fetch object details to get the relations array
  const { data: objectDetails } = useQuery({
    queryKey: [...queryKeys.dataModel.all, 'diagram-relations'],
    queryFn: async () => {
      const details: Array<{ id: string; relations: Array<{ targetObjectId: string; type: string }> }> = [];
      for (const obj of allObjects) {
        const [appId, objectId] = obj.id.split(':');
        try {
          const { data: resp } = await api.get(`/data-model/objects/${appId}/${objectId}/fields`);
          if (resp.data?.object?.relations) {
            details.push({ id: obj.id, relations: resp.data.object.relations });
          }
        } catch {
          // skip objects that fail
        }
      }
      return details;
    },
    staleTime: 60_000,
  });

  // Build connection lines
  const connections = useMemo(() => {
    if (!objectDetails) return [];
    const lines: Array<{ fromId: string; toId: string; type: string }> = [];
    const seen = new Set<string>();
    objectDetails.forEach((detail) => {
      detail.relations.forEach((r) => {
        const key = [detail.id, r.targetObjectId].sort().join('|');
        if (!seen.has(key) && posMap.has(detail.id) && posMap.has(r.targetObjectId)) {
          seen.add(key);
          lines.push({ fromId: detail.id, toId: r.targetObjectId, type: r.type });
        }
      });
    });
    return lines;
  }, [objectDetails, posMap]);

  const rows = Math.ceil(grouped.length / DIAGRAM_COLS);
  const svgW = DIAGRAM_PAD * 2 + DIAGRAM_COLS * DIAGRAM_BOX_W + (DIAGRAM_COLS - 1) * DIAGRAM_GAP_X;
  const svgH = DIAGRAM_PAD * 2 + rows * DIAGRAM_BOX_H + (rows - 1) * DIAGRAM_GAP_Y;

  return (
    <div
      style={{
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'auto',
        background: 'var(--color-bg-secondary)',
      }}
    >
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block' }}
      >
        {/* Connection lines */}
        {connections.map((conn, idx) => {
          const from = posMap.get(conn.fromId);
          const to = posMap.get(conn.toId);
          if (!from || !to) return null;

          const fromCX = from.x + DIAGRAM_BOX_W / 2;
          const fromCY = from.y + DIAGRAM_BOX_H / 2;
          const toCX = to.x + DIAGRAM_BOX_W / 2;
          const toCY = to.y + DIAGRAM_BOX_H / 2;

          // Calculate edge points
          const dx = toCX - fromCX;
          const dy = toCY - fromCY;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          let x1: number, y1: number, x2: number, y2: number;

          if (absDx > absDy) {
            // Connect horizontally
            x1 = dx > 0 ? from.x + DIAGRAM_BOX_W : from.x;
            y1 = fromCY;
            x2 = dx > 0 ? to.x : to.x + DIAGRAM_BOX_W;
            y2 = toCY;
          } else {
            // Connect vertically
            x1 = fromCX;
            y1 = dy > 0 ? from.y + DIAGRAM_BOX_H : from.y;
            x2 = toCX;
            y2 = dy > 0 ? to.y : to.y + DIAGRAM_BOX_H;
          }

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          const isHighlighted = hoveredId === conn.fromId || hoveredId === conn.toId;

          return (
            <path
              key={idx}
              d={absDx > absDy
                ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
                : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
              }
              fill="none"
              stroke={isHighlighted ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}
              strokeWidth={isHighlighted ? 2 : 1.5}
              strokeDasharray={conn.type === 'belongs_to' ? 'none' : '4 3'}
              opacity={isHighlighted ? 1 : 0.5}
              style={{ transition: 'all var(--transition-fast)' }}
            />
          );
        })}

        {/* Object boxes */}
        {positions.map((pos) => {
          const [appId, objectId] = pos.obj.id.split(':');
          const isHovered = hoveredId === pos.obj.id;
          return (
            <g
              key={pos.obj.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelect(appId, objectId)}
              onMouseEnter={() => setHoveredId(pos.obj.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={DIAGRAM_BOX_W}
                height={DIAGRAM_BOX_H}
                rx={8}
                ry={8}
                fill="var(--color-bg-primary)"
                stroke="var(--color-border-secondary)"
                strokeWidth={isHovered ? 2 : 1}
                style={{ transition: 'all var(--transition-fast)' }}
              />
              {/* Color accent bar at top */}
              <rect
                x={pos.x}
                y={pos.y}
                width={DIAGRAM_BOX_W}
                height={4}
                rx={2}
                fill="var(--color-accent-primary)"
                opacity={0.6}
                clipPath={`inset(0 0 0 0 round 8px 8px 0 0)`}
              />
              {/* Object name */}
              <text
                x={pos.x + 12}
                y={pos.y + 28}
                fontSize={13}
                fontWeight={500}
                fill="var(--color-text-primary)"
                fontFamily="var(--font-family)"
              >
                {pos.obj.name.length > 22 ? pos.obj.name.slice(0, 20) + '...' : pos.obj.name}
              </text>
              {/* Field count + app label */}
              <text
                x={pos.x + 12}
                y={pos.y + 48}
                fontSize={11}
                fill="var(--color-text-tertiary)"
                fontFamily="var(--font-family)"
              >
                {pos.obj.totalFieldCount} {t('settingsPanel.dataModel.fields', 'fields')}
              </text>
              <text
                x={pos.x + DIAGRAM_BOX_W - 12}
                y={pos.y + 48}
                fontSize={10}
                fill="var(--color-text-secondary)"
                fontFamily="var(--font-family)"
                textAnchor="end"
                fontWeight={500}
              >
                {pos.obj.appName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object list view
// ---------------------------------------------------------------------------

function ObjectListView({ onSelect }: { onSelect: (appId: string, objectId: string) => void }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'diagram'>('list');

  const { data: objects = [], isLoading } = useQuery({
    queryKey: queryKeys.dataModel.objects,
    queryFn: async () => {
      const { data } = await api.get('/data-model/objects');
      return data.data as DataModelObject[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return objects;
    const q = search.toLowerCase();
    return objects.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.appName.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q),
    );
  }, [objects, search]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('settingsPanel.dataModel.searchObjects', 'Search objects...')}
          size="sm"
          iconLeft={<Search size={14} />}
          style={{ maxWidth: 300 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 2 }}>
          <button
            onClick={() => setViewMode('list')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: viewMode === 'list' ? 'var(--color-bg-elevated)' : 'transparent',
              color: viewMode === 'list' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              cursor: 'pointer',
              padding: 0,
              boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--transition-normal)',
            }}
            aria-label={t('settingsPanel.dataModel.listView', 'List view')}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('diagram')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: viewMode === 'diagram' ? 'var(--color-bg-elevated)' : 'transparent',
              color: viewMode === 'diagram' ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              cursor: 'pointer',
              padding: 0,
              boxShadow: viewMode === 'diagram' ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--transition-normal)',
            }}
            aria-label={t('settingsPanel.dataModel.diagramView', 'Diagram view')}
          >
            <GitBranch size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div
          style={{
            padding: 'var(--spacing-2xl)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {t('settingsPanel.dataModel.loading', 'Loading data model...')}
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 'var(--spacing-2xl)',
            textAlign: 'center',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {search ? t('settingsPanel.dataModel.noSearchResults', 'No objects match your search.') : t('settingsPanel.dataModel.noObjects', 'No objects found.')}
        </div>
      ) : viewMode === 'diagram' ? (
        <DataModelDiagram objects={filtered} allObjects={objects} onSelect={onSelect} />
      ) : (
        <div
          style={{
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 80px 28px',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-bg-tertiary)',
              borderBottom: '1px solid var(--color-border-secondary)',
            }}
          >
            <div style={headerCellStyle}>{t('settingsPanel.dataModel.name', 'Name')}</div>
            <div style={{ ...headerCellStyle, textAlign: 'center' }}>{t('settingsPanel.dataModel.app', 'App')}</div>
            <div style={{ ...headerCellStyle, textAlign: 'center' }}>{t('settingsPanel.dataModel.fields', 'Fields')}</div>
            <div style={{ ...headerCellStyle, textAlign: 'center' }}>{t('settingsPanel.dataModel.records', 'Records')}</div>
            <div />
          </div>

          {/* Rows */}
          {filtered.map((obj) => {
            const [appId, objectId] = obj.id.split(':');
            const isHovered = hoveredRow === obj.id;

            return (
              <div
                key={obj.id}
                onClick={() => onSelect(appId, objectId)}
                onMouseEnter={() => setHoveredRow(obj.id)}
                onMouseLeave={() => setHoveredRow(null)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 100px 80px 80px 28px',
                  gap: 'var(--spacing-sm)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border-secondary)',
                  background: isHovered ? 'var(--color-surface-hover)' : 'transparent',
                  transition: 'background var(--transition-normal)',
                }}
              >
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 28,
                      height: 28,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    <ObjectIcon name={obj.iconName} size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--font-size-md)',
                        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                        color: 'var(--color-text-primary)',
                        fontFamily: 'var(--font-family)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {obj.name}
                    </div>
                    {obj.description && (
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-tertiary)',
                          fontFamily: 'var(--font-family)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 1,
                        }}
                      >
                        {obj.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* App badge */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Chip height={20}>
                    {obj.appName}
                  </Chip>
                </div>

                {/* Fields count */}
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {obj.totalFieldCount}
                </div>

                {/* Instance count */}
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {obj.instanceCount.toLocaleString()}
                </div>

                {/* Chevron */}
                <ChevronRight
                  size={14}
                  style={{
                    color: 'var(--color-text-tertiary)',
                    opacity: isHovered ? 1 : 0.4,
                    transition: 'opacity var(--transition-normal)',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const headerCellStyle: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
  color: 'var(--color-text-tertiary)',
  fontFamily: 'var(--font-family)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

// ---------------------------------------------------------------------------
// Object detail view
// ---------------------------------------------------------------------------

function ObjectDetailView({
  appId,
  objectId,
  onBack,
}: {
  appId: string;
  objectId: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fieldTypeOptions = useFieldTypeOptions();
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<string>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.dataModel.objectFields(appId, objectId),
    queryFn: async () => {
      const { data: resp } = await api.get(`/data-model/objects/${appId}/${objectId}/fields`);
      return resp.data as ObjectDetail;
    },
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; slug: string; fieldType: string; isRequired: boolean }) => {
      const { data: resp } = await api.post(`/custom-fields/${appId}/${objectId}`, payload);
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataModel.objectFields(appId, objectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dataModel.objects });
      setShowAddField(false);
      setNewFieldName('');
      setNewFieldType('text');
      setNewFieldRequired(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      await api.delete(`/custom-fields/${fieldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dataModel.objectFields(appId, objectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dataModel.objects });
    },
  });

  const handleCreateField = useCallback(() => {
    const name = newFieldName.trim();
    if (!name) return;
    const slug = toSlug(name);
    if (!slug) return;
    createMutation.mutate({ name, slug, fieldType: newFieldType, isRequired: newFieldRequired });
  }, [newFieldName, newFieldType, newFieldRequired, createMutation]);

  if (isLoading || !data) {
    return (
      <div style={{ padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  const { object, standardFields, customFields } = data;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: 0,
          marginBottom: 'var(--spacing-lg)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          transition: 'color var(--transition-normal)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
      >
        <ArrowLeft size={14} />
        {t('settingsPanel.dataModel.backToObjects', 'Back to objects')}
      </button>

      {/* Heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        <ObjectIcon name={object.iconName} size={20} />
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {object.name}
        </h2>
      </div>

      {object.description && (
        <p
          style={{
            margin: `0 0 var(--spacing-xl)`,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {object.description}
        </p>
      )}

      {/* Standard fields */}
      <SettingsSection title={t('settingsPanel.dataModel.standardFields', 'Standard fields')} description={t('settingsPanel.dataModel.standardFieldsDesc', 'Built-in fields defined by the app. These cannot be modified.')}>
        <div
          style={{
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          {standardFields.map((f, idx) => (
            <div
              key={f.slug}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                borderBottom: idx < standardFields.length - 1 ? '1px solid var(--color-border-secondary)' : 'none',
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                }}
              >
                {f.name}
              </div>
              <Chip color={fieldTypeBadgeColor(f.fieldType)} height={20}>
                {f.fieldType}
              </Chip>
              {f.isRequired && (
                <Chip color="var(--color-warning)" height={20}>
                  {t('settingsPanel.dataModel.required', 'required')}
                </Chip>
              )}
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Custom fields */}
      <SettingsSection title={t('settingsPanel.dataModel.customFields', 'Custom fields')} description={t('settingsPanel.dataModel.customFieldsDesc', 'User-defined fields added to this object.')}>
        {customFields.length > 0 && (
          <div
            style={{
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            {customFields.map((f, idx) => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: idx < customFields.length - 1 ? '1px solid var(--color-border-secondary)' : 'none',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    fontSize: 'var(--font-size-md)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                    fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  }}
                >
                  {f.name}
                  <span
                    style={{
                      marginLeft: 'var(--spacing-sm)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    {f.slug}
                  </span>
                </div>
                <Chip color={fieldTypeBadgeColor(f.fieldType)} height={20}>
                  {f.fieldType}
                </Chip>
                {f.isRequired && (
                  <Chip color="var(--color-warning)" height={20}>
                    {t('settingsPanel.dataModel.required', 'required')}
                  </Chip>
                )}
                <IconButton
                  icon={<Trash2 size={14} />}
                  label={t('settingsPanel.dataModel.deleteField', 'Delete field')}
                  size={26}
                  destructive
                  onClick={() => deleteMutation.mutate(f.id)}
                />
              </div>
            ))}
          </div>
        )}

        {customFields.length === 0 && !showAddField && (
          <div
            style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              border: '1px dashed var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            {t('settingsPanel.dataModel.noCustomFields', 'No custom fields yet.')}
          </div>
        )}

        {/* Add field form */}
        {showAddField && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-md)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bg-tertiary)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder={t('settingsPanel.dataModel.fieldName', 'Field name')}
                  size="sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateField()}
                />
              </div>
              <SettingsSelect
                value={newFieldType}
                options={fieldTypeOptions}
                onChange={(v) => setNewFieldType(v)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {t('settingsPanel.dataModel.required', 'Required')}
                </span>
                <SettingsToggle
                  checked={newFieldRequired}
                  onChange={setNewFieldRequired}
                  label={t('settingsPanel.dataModel.required', 'Required')}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddField(false);
                    setNewFieldName('');
                    setNewFieldType('text');
                    setNewFieldRequired(false);
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateField}
                  disabled={!newFieldName.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
                </Button>
              </div>
            </div>
            {newFieldName.trim() && (
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {t('settingsPanel.dataModel.slug', 'Slug')}: <code style={{ background: 'var(--color-bg-secondary)', padding: '1px 4px', borderRadius: 'var(--radius-sm)' }}>{toSlug(newFieldName)}</code>
              </div>
            )}
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => setShowAddField(true)}
          disabled={showAddField}
        >
          {t('settingsPanel.dataModel.addCustomField', 'Add custom field')}
        </Button>
      </SettingsSection>

      {/* Relations */}
      {object.relations.length > 0 && (
        <SettingsSection title={t('settingsPanel.dataModel.relations', 'Relations')} description={t('settingsPanel.dataModel.relationsDesc', 'Connections to other objects in the data model.')}>
          <div
            style={{
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {object.relations.map((r, idx) => (
              <div
                key={`${r.targetObjectId}-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-md)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: idx < object.relations.length - 1 ? '1px solid var(--color-border-secondary)' : 'none',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    fontSize: 'var(--font-size-md)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {r.targetObjectId}
                </div>
                <Chip color="#6366f1" height={20}>
                  {r.type}
                </Chip>
                {r.foreignKey && (
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    {t('settingsPanel.dataModel.via', 'via')} {r.foreignKey}
                  </span>
                )}
              </div>
            ))}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
