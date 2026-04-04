import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n';

// Polyfill crypto.randomUUID for non-secure contexts (HTTP with public IP)
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  (crypto as any).randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: string) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    );
}
import './styles/reset.css';
import './styles/theme.css';
import './styles/global.css';
import './styles/ui.css';
import './styles/data-table.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
