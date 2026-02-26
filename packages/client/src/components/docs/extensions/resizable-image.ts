import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * ResizableImage — extends the built-in Image node with drag-to-resize handles.
 *
 * Renders an <img> wrapped in a <figure> with a <figcaption>.
 * When selected (ProseMirror-selectednode), CSS-based resize handles appear on
 * the corners. A mousedown on any handle initiates a drag that updates the
 * node's `width` attribute.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setResizableImage: (options: { src: string; alt?: string; title?: string; width?: number }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create({
  name: 'resizableImage',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="resizable-image"]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const img = el.querySelector('img');
          const caption = el.querySelector('figcaption');
          return {
            src: img?.getAttribute('src'),
            alt: img?.getAttribute('alt'),
            title: img?.getAttribute('title'),
            width: img?.style.width ? parseInt(img.style.width) : null,
            caption: caption?.textContent || '',
          };
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt'),
            title: el.getAttribute('title'),
            width: el.style.width ? parseInt(el.style.width) : null,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, width, ...imgAttrs } = HTMLAttributes;
    const imgStyle = width ? `width: ${width}px; max-width: 100%; height: auto;` : 'max-width: 100%; height: auto;';

    return [
      'figure',
      mergeAttributes({ 'data-type': 'resizable-image', class: 'resizable-image-figure' }),
      [
        'img',
        mergeAttributes(imgAttrs, { style: imgStyle, draggable: 'false' }),
      ],
      [
        'figcaption',
        { class: 'resizable-image-caption', 'data-placeholder': 'Add a caption...' },
        caption || '',
      ],
    ];
  },

  addCommands() {
    return {
      setResizableImage:
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
    return ({ node, getPos, editor }) => {
      const figure = document.createElement('figure');
      figure.classList.add('resizable-image-figure');
      figure.setAttribute('data-type', 'resizable-image');

      const img = document.createElement('img');
      img.src = node.attrs.src || '';
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.title) img.title = node.attrs.title;
      img.draggable = false;
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = '6px';
      img.style.display = 'block';
      if (node.attrs.width) {
        img.style.width = `${node.attrs.width}px`;
      }

      // Caption
      const captionEl = document.createElement('figcaption');
      captionEl.classList.add('resizable-image-caption');
      captionEl.contentEditable = 'true';
      captionEl.textContent = node.attrs.caption || '';
      captionEl.setAttribute('data-placeholder', 'Add a caption...');

      captionEl.addEventListener('input', () => {
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos != null) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                caption: captionEl.textContent || '',
              }),
            );
          }
        }
      });

      // Prevent editor from handling caption keystrokes
      captionEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });

      // Resize handles
      const resizeWrapper = document.createElement('div');
      resizeWrapper.classList.add('resizable-image-wrapper');

      const handleSE = document.createElement('div');
      handleSE.classList.add('resize-handle', 'resize-handle-se');
      const handleSW = document.createElement('div');
      handleSW.classList.add('resize-handle', 'resize-handle-sw');

      function startResize(e: MouseEvent, handle: 'se' | 'sw') {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = img.getBoundingClientRect().width;

        function onMouseMove(ev: MouseEvent) {
          const diff = handle === 'se' ? ev.clientX - startX : startX - ev.clientX;
          const newWidth = Math.max(100, Math.round(startWidth + diff));
          img.style.width = `${newWidth}px`;
        }

        function onMouseUp(ev: MouseEvent) {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          const finalWidth = Math.round(img.getBoundingClientRect().width);
          if (typeof getPos === 'function') {
            const pos = getPos();
            if (pos != null) {
              editor.view.dispatch(
                editor.view.state.tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width: finalWidth,
                }),
              );
            }
          }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }

      handleSE.addEventListener('mousedown', (e) => startResize(e, 'se'));
      handleSW.addEventListener('mousedown', (e) => startResize(e, 'sw'));

      resizeWrapper.appendChild(img);
      resizeWrapper.appendChild(handleSE);
      resizeWrapper.appendChild(handleSW);
      figure.appendChild(resizeWrapper);
      figure.appendChild(captionEl);

      return {
        dom: figure,
        contentDOM: null,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false;
          if (updatedNode.attrs.src !== img.src) img.src = updatedNode.attrs.src || '';
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          }
          if (updatedNode.attrs.caption !== captionEl.textContent) {
            captionEl.textContent = updatedNode.attrs.caption || '';
          }
          return true;
        },
        selectNode: () => {
          figure.classList.add('ProseMirror-selectednode');
        },
        deselectNode: () => {
          figure.classList.remove('ProseMirror-selectednode');
        },
        destroy: () => {},
      };
    };
  },
});
