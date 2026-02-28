import { Node, mergeAttributes } from '@tiptap/core';
import { api } from '../../../lib/api-client';

/**
 * TableEmbed — a block that references a spreadsheet table by ID.
 *
 * Fetches table data and renders a live preview with column headers and
 * the first few rows. Clicking "Open →" navigates to /tables/:tableId.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableEmbed: {
      insertTableEmbed: (options: { tableId: string; title: string }) => ReturnType;
    };
  }
}

const MAX_PREVIEW_COLS = 6;

/** Safely remove all children from an element */
function clearChildren(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export const TableEmbed = Node.create({
  name: 'tableEmbed',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      tableId: { default: null },
      title: { default: 'Untitled table' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="table-embed"]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            tableId: el.getAttribute('data-table-id'),
            title: el.getAttribute('data-title') || 'Untitled table',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { tableId, title } = HTMLAttributes;
    return [
      'div',
      mergeAttributes({
        'data-type': 'table-embed',
        'data-table-id': tableId,
        'data-title': title,
        class: 'table-embed-block',
        style: [
          'margin: 8px 0',
          'border: 1px solid var(--color-border-primary)',
          'border-radius: 8px',
          'background: var(--color-bg-primary)',
          'overflow: hidden',
          'font-family: var(--font-family)',
        ].join('; '),
      }),
      ['span', {}, title || 'Untitled table'],
    ];
  },

  addCommands() {
    return {
      insertTableEmbed:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const tableId = node.attrs.tableId;
      const title = node.attrs.title || 'Untitled table';

      // ── Outer wrapper ──────────────────────────────────────────────
      const dom = document.createElement('div');
      dom.setAttribute('data-type', 'table-embed');
      dom.setAttribute('data-table-id', tableId || '');
      dom.setAttribute('data-title', title);
      dom.className = 'table-embed-block';
      Object.assign(dom.style, {
        margin: '8px 0',
        border: '1px solid var(--color-border-primary)',
        borderRadius: '8px',
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
        fontFamily: 'var(--font-family)',
      });

      // ── Header bar ─────────────────────────────────────────────────
      const header = document.createElement('div');
      Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-tertiary)',
      });

      const icon = document.createElement('span');
      Object.assign(icon.style, {
        fontSize: '14px',
        color: 'var(--color-text-tertiary)',
        flexShrink: '0',
      });
      icon.textContent = '\u2637';
      header.appendChild(icon);

      const titleEl = document.createElement('span');
      Object.assign(titleEl.style, {
        flex: '1',
        fontSize: '13px',
        fontWeight: '600',
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      titleEl.textContent = title;
      header.appendChild(titleEl);

      const openLink = document.createElement('a');
      Object.assign(openLink.style, {
        fontSize: '12px',
        color: 'var(--color-accent-primary)',
        textDecoration: 'none',
        cursor: 'pointer',
        flexShrink: '0',
        fontWeight: '500',
      });
      openLink.textContent = 'Open \u2192';
      openLink.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tableId) window.location.href = `/tables/${tableId}`;
      });
      openLink.addEventListener('mouseenter', () => {
        openLink.style.textDecoration = 'underline';
      });
      openLink.addEventListener('mouseleave', () => {
        openLink.style.textDecoration = 'none';
      });
      header.appendChild(openLink);

      dom.appendChild(header);

      // ── Table body (initially shows loading) ───────────────────────
      const body = document.createElement('div');
      Object.assign(body.style, {
        overflowX: 'auto',
        overflowY: 'auto',
        maxHeight: '220px',
      });

      // Allow mouse wheel and keyboard scrolling inside the embed
      // without TipTap/ProseMirror intercepting the events
      body.addEventListener('wheel', (e) => {
        // Only stop propagation if the body is actually scrollable
        const canScroll = body.scrollHeight > body.clientHeight;
        if (!canScroll) return;

        const atTop = body.scrollTop === 0;
        const atBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 1;

        // Allow the page to scroll if we're at the edge and scrolling further
        if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) return;

        e.stopPropagation();
      });

      body.tabIndex = 0;
      body.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
          const canScroll = body.scrollHeight > body.clientHeight;
          if (!canScroll) return;
          e.stopPropagation();
          // Let the browser handle the native scroll behavior
        }
      });
      // Remove focus outline on the scrollable area
      body.style.outline = 'none';

      const loadingEl = document.createElement('div');
      Object.assign(loadingEl.style, {
        padding: '20px 12px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--color-text-tertiary)',
      });
      loadingEl.textContent = 'Loading table\u2026';
      body.appendChild(loadingEl);

      dom.appendChild(body);

      // ── Fetch and render ───────────────────────────────────────────
      if (tableId) {
        api
          .get(`/tables/${tableId}`)
          .then(({ data: resp }) => {
            const spreadsheet = resp.data as {
              columns: Array<{ id: string; name: string; type: string }>;
              rows: Array<Record<string, unknown>>;
            };

            clearChildren(body);

            const cols = spreadsheet.columns.slice(0, MAX_PREVIEW_COLS);
            const rows = spreadsheet.rows; // render all rows — body scrolls
            const hasMoreCols = spreadsheet.columns.length > MAX_PREVIEW_COLS;

            if (cols.length === 0) {
              const empty = document.createElement('div');
              Object.assign(empty.style, {
                padding: '20px 12px',
                textAlign: 'center',
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
              });
              empty.textContent = 'Empty table';
              body.appendChild(empty);
              return;
            }

            const table = document.createElement('table');
            Object.assign(table.style, {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            });

            // Column headers
            const thead = document.createElement('thead');
            const headRow = document.createElement('tr');

            for (const col of cols) {
              const th = document.createElement('th');
              Object.assign(th.style, {
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '11px',
                color: 'var(--color-text-secondary)',
                borderBottom: '1px solid var(--color-border-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '180px',
                background: 'var(--color-bg-tertiary)',
                position: 'sticky',
                top: '0',
                zIndex: '1',
              });
              th.textContent = col.name;
              headRow.appendChild(th);
            }

            if (hasMoreCols) {
              const th = document.createElement('th');
              Object.assign(th.style, {
                padding: '6px 10px',
                textAlign: 'center',
                fontWeight: '400',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                borderBottom: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-tertiary)',
                position: 'sticky',
                top: '0',
                zIndex: '1',
              });
              th.textContent = `+${spreadsheet.columns.length - MAX_PREVIEW_COLS}`;
              headRow.appendChild(th);
            }

            thead.appendChild(headRow);
            table.appendChild(thead);

            // Data rows
            const tbody = document.createElement('tbody');

            for (const row of rows) {
              const tr = document.createElement('tr');

              for (const col of cols) {
                const td = document.createElement('td');
                Object.assign(td.style, {
                  padding: '5px 10px',
                  borderBottom: '1px solid var(--color-border-secondary, var(--color-border-primary))',
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '180px',
                });

                const raw = row[col.id];
                td.textContent = formatCellValue(raw, col.type);
                tr.appendChild(td);
              }

              if (hasMoreCols) {
                const td = document.createElement('td');
                Object.assign(td.style, {
                  padding: '5px 10px',
                  borderBottom: '1px solid var(--color-border-secondary, var(--color-border-primary))',
                  color: 'var(--color-text-tertiary)',
                  textAlign: 'center',
                });
                td.textContent = '\u2026';
                tr.appendChild(td);
              }

              tbody.appendChild(tr);
            }

            table.appendChild(tbody);
            body.appendChild(table);

            // Footer with row count (outside scrollable body)
            if (spreadsheet.rows.length > 0) {
              const footer = document.createElement('div');
              Object.assign(footer.style, {
                padding: '6px 12px',
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                borderTop: '1px solid var(--color-border-primary)',
                background: 'var(--color-bg-tertiary)',
              });
              const total = spreadsheet.rows.length;
              footer.textContent = `${total} row${total !== 1 ? 's' : ''}`;
              dom.appendChild(footer);
            }
          })
          .catch(() => {
            clearChildren(body);
            const err = document.createElement('div');
            Object.assign(err.style, {
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--color-text-tertiary)',
            });
            err.textContent = 'Could not load table';
            body.appendChild(err);
          });
      }

      return { dom };
    };
  },
});

// ── Helpers ────────────────────────────────────────────────────────────

function formatCellValue(raw: unknown, type: string): string {
  if (raw === null || raw === undefined || raw === '') return '';

  switch (type) {
    case 'checkbox':
      return raw ? '\u2611' : '\u2610';
    case 'multiSelect':
      return Array.isArray(raw) ? raw.join(', ') : String(raw);
    case 'attachment':
      if (Array.isArray(raw)) return `${raw.length} file${raw.length !== 1 ? 's' : ''}`;
      return '';
    case 'rating':
      return typeof raw === 'number' ? '\u2605'.repeat(raw) : String(raw);
    default:
      return String(raw);
  }
}
