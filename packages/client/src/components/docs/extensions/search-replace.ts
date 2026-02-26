import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * SearchReplace — Cmd/Ctrl+F search and replace within the document.
 *
 * This extension provides commands to open/close the search bar, navigate
 * between matches, and replace matches. The UI is rendered by the editor
 * component; this extension handles the search state and decorations.
 */

export interface SearchReplaceState {
  open: boolean;
  query: string;
  replaceText: string;
  caseSensitive: boolean;
  matchCount: number;
  activeIndex: number;
}

const searchPluginKey = new PluginKey<{
  query: string;
  caseSensitive: boolean;
  activeIndex: number;
}>('searchReplace');

function findMatches(doc: any, query: string, caseSensitive: boolean): Array<{ from: number; to: number }> {
  if (!query) return [];
  const results: Array<{ from: number; to: number }> = [];
  const searchText = caseSensitive ? query : query.toLowerCase();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = caseSensitive ? node.text! : node.text!.toLowerCase();
    let index = 0;
    while (index < text.length) {
      const found = text.indexOf(searchText, index);
      if (found === -1) break;
      results.push({
        from: pos + found,
        to: pos + found + searchText.length,
      });
      index = found + 1;
    }
  });

  return results;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      openSearch: () => ReturnType;
      closeSearch: () => ReturnType;
      setSearchQuery: (query: string) => ReturnType;
      setReplaceText: (text: string) => ReturnType;
      toggleCaseSensitive: () => ReturnType;
      nextMatch: () => ReturnType;
      previousMatch: () => ReturnType;
      replaceCurrentMatch: () => ReturnType;
      replaceAllMatches: () => ReturnType;
    };
  }
}

export const SearchReplace = Extension.create({
  name: 'searchReplace',

  addStorage() {
    return {
      open: false,
      query: '',
      replaceText: '',
      caseSensitive: false,
      matchCount: 0,
      activeIndex: 0,
    } as SearchReplaceState;
  },

  addCommands() {
    return {
      openSearch:
        () =>
        ({ editor }) => {
          editor.storage.searchReplace.open = true;
          // Dispatch a transaction to trigger decoration update
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { open: true }));
          return true;
        },
      closeSearch:
        () =>
        ({ editor }) => {
          editor.storage.searchReplace.open = false;
          editor.storage.searchReplace.query = '';
          editor.storage.searchReplace.replaceText = '';
          editor.storage.searchReplace.activeIndex = 0;
          editor.storage.searchReplace.matchCount = 0;
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { close: true }));
          return true;
        },
      setSearchQuery:
        (query: string) =>
        ({ editor }) => {
          editor.storage.searchReplace.query = query;
          editor.storage.searchReplace.activeIndex = 0;
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { query }));
          return true;
        },
      setReplaceText:
        (text: string) =>
        ({ editor }) => {
          editor.storage.searchReplace.replaceText = text;
          return true;
        },
      toggleCaseSensitive:
        () =>
        ({ editor }) => {
          editor.storage.searchReplace.caseSensitive = !editor.storage.searchReplace.caseSensitive;
          editor.storage.searchReplace.activeIndex = 0;
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { toggleCase: true }));
          return true;
        },
      nextMatch:
        () =>
        ({ editor }) => {
          const s = editor.storage.searchReplace;
          if (s.matchCount > 0) {
            s.activeIndex = (s.activeIndex + 1) % s.matchCount;
            editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { navigate: true }));
            // Scroll to match
            const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
            if (matches[s.activeIndex]) {
              const { from } = matches[s.activeIndex];
              editor.commands.setTextSelection(from);
              const coords = editor.view.coordsAtPos(from);
              const editorEl = editor.view.dom.closest('.doc-editor');
              if (editorEl) {
                const rect = editorEl.getBoundingClientRect();
                if (coords.top < rect.top || coords.bottom > rect.bottom) {
                  editor.view.dom.closest('[style*="overflow"]')?.scrollTo({
                    top: coords.top - rect.top - 100,
                    behavior: 'smooth',
                  });
                }
              }
            }
          }
          return true;
        },
      previousMatch:
        () =>
        ({ editor }) => {
          const s = editor.storage.searchReplace;
          if (s.matchCount > 0) {
            s.activeIndex = (s.activeIndex - 1 + s.matchCount) % s.matchCount;
            editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { navigate: true }));
            const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
            if (matches[s.activeIndex]) {
              editor.commands.setTextSelection(matches[s.activeIndex].from);
            }
          }
          return true;
        },
      replaceCurrentMatch:
        () =>
        ({ editor, tr }) => {
          const s = editor.storage.searchReplace;
          const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
          if (matches.length === 0 || s.activeIndex >= matches.length) return false;
          const match = matches[s.activeIndex];
          tr.insertText(s.replaceText, match.from, match.to);
          editor.view.dispatch(tr);
          // Recalculate after replacement
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { replaced: true }));
          return true;
        },
      replaceAllMatches:
        () =>
        ({ editor }) => {
          const s = editor.storage.searchReplace;
          const matches = findMatches(editor.state.doc, s.query, s.caseSensitive);
          if (matches.length === 0) return false;
          // Replace from end to start to preserve positions
          const { tr } = editor.state;
          for (let i = matches.length - 1; i >= 0; i--) {
            tr.insertText(s.replaceText, matches[i].from, matches[i].to);
          }
          editor.view.dispatch(tr);
          s.activeIndex = 0;
          editor.view.dispatch(editor.view.state.tr.setMeta(searchPluginKey, { replacedAll: true }));
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-f': () => {
        this.editor.commands.openSearch();
        return true;
      },
      Escape: () => {
        if (this.editor.storage.searchReplace.open) {
          this.editor.commands.closeSearch();
          return true;
        }
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init() {
            return { decorations: DecorationSet.empty };
          },
          apply(tr, value, _oldState, newState) {
            const storage = extensionThis.storage as SearchReplaceState;
            if (!storage.open || !storage.query) {
              storage.matchCount = 0;
              return { decorations: DecorationSet.empty };
            }
            const matches = findMatches(newState.doc, storage.query, storage.caseSensitive);
            storage.matchCount = matches.length;
            if (storage.activeIndex >= matches.length) {
              storage.activeIndex = Math.max(0, matches.length - 1);
            }

            const decorations = matches.map((m, i) => {
              const isActive = i === storage.activeIndex;
              return Decoration.inline(m.from, m.to, {
                class: isActive ? 'search-match search-match-active' : 'search-match',
              });
            });

            return { decorations: DecorationSet.create(newState.doc, decorations) };
          },
        },
        props: {
          decorations(state) {
            return (this as any).getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
