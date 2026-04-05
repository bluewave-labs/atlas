import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search } from 'lucide-react';
import type { PageTemplate, TemplateCategory } from '../lib/templates';
import { ALL_CATEGORIES, PAGE_TEMPLATES } from '../lib/templates';

// ─── Template gallery (full-page, Notion-style) ──────────────────────────

/** Mini document-preview lines rendered inside the colored card header */
function CardPreviewLines() {
  return (
    <div className="tg-card-preview">
      <div className="tg-card-preview-line is-heading" />
      <div className="tg-card-preview-line w-full" />
      <div className="tg-card-preview-line w-80" />
      <div className="tg-card-preview-line w-55" />
    </div>
  );
}

function TemplateCard({ template, onClick }: { template: PageTemplate; onClick: () => void }) {
  const { t } = useTranslation();
  const isBlank = template.name === 'Blank page';

  if (isBlank) {
    return (
      <button className="tg-card is-blank" onClick={onClick} aria-label="Blank page">
        <div className="tg-blank-header">
          <span className="tg-blank-plus">+</span>
        </div>
        <div className="tg-card-body">
          <div className="tg-card-name-row">
            <span className="tg-card-icon">{template.icon}</span>
            <span className="tg-card-name">{template.name}</span>
          </div>
          <p className="tg-card-desc">{template.description}</p>
        </div>
      </button>
    );
  }

  return (
    <button className="tg-card" onClick={onClick} aria-label={`Use ${template.name} template`}>
      <div
        className="tg-card-header"
        style={{ background: template.coverColor }}
      >
        <CardPreviewLines />
        <div className="tg-card-overlay">
          <span className="tg-card-use-btn">{t('docs.useTemplate')}</span>
        </div>
      </div>
      <div className="tg-card-body">
        <div className="tg-card-name-row">
          <span className="tg-card-icon">{template.icon}</span>
          <span className="tg-card-name">{template.name}</span>
        </div>
        <p className="tg-card-desc">{template.description}</p>
        {template.tags.length > 0 && (
          <div className="tg-card-tags">
            {template.tags.map((tag) => (
              <span key={tag} className="tg-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

export function TemplateGallery({
  onSelect,
  onClose,
}: {
  onSelect: (template: PageTemplate) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return PAGE_TEMPLATES.filter((t) => {
      const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.previewSnippet.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  // Group filtered templates by category for the "All" view
  const grouped = useMemo(() => {
    if (activeCategory !== 'All') {
      return [{ label: activeCategory as string, templates: filtered }];
    }
    const map = new Map<string, PageTemplate[]>();
    // Preserve order: blank first, then by category
    for (const t of filtered) {
      const key = t.name === 'Blank page' ? '_blank' : t.category;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    const result: { label: string; templates: PageTemplate[] }[] = [];
    if (map.has('_blank')) {
      result.push({ label: t('docs.startFresh'), templates: map.get('_blank')! });
    }
    for (const cat of ALL_CATEGORIES) {
      if (map.has(cat)) {
        result.push({ label: cat, templates: map.get(cat)! });
      }
    }
    return result;
  }, [filtered, activeCategory, t]);

  return (
    <div className="tg-root">
      {/* Sticky header */}
      <div className="tg-header">
        <button className="tg-back-btn" onClick={onClose} aria-label={t('docs.backToDocuments')}>
          <ArrowLeft size={14} />
          {t('docs.backToDocuments')}
        </button>
        <div className="tg-header-spacer" />
        <div className="tg-search" role="search">
          <Search size={13} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('docs.searchTemplates')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search templates"
            autoFocus
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="tg-body">
        {/* Hero */}
        <div className="tg-hero">
          <h1 className="tg-hero-title">{t('docs.startWithTemplate')}</h1>
          <p className="tg-hero-sub">{t('docs.startWithTemplateDesc')}</p>
        </div>

        {/* Category pills */}
        <div className="tg-pills" role="group" aria-label="Filter by category">
          <button
            className={`tg-pill${activeCategory === 'All' ? ' is-active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            {t('docs.all')}
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`tg-pill${activeCategory === cat ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Template grid(s) */}
        {grouped.length === 0 ? (
          <div className="tg-empty">
            <Search size={32} strokeWidth={1.2} />
            <p>{t('docs.noTemplatesMatch')}</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="tg-category-section">
              {grouped.length > 1 && (
                <p className="tg-category-label">{group.label}</p>
              )}
              <div className="tg-grid">
                {group.templates.map((tpl) => (
                  <TemplateCard key={tpl.name} template={tpl} onClick={() => onSelect(tpl)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
