import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n';
import './styles/reset.css';
import './styles/theme.css';
import './styles/global.css';
import './styles/ui.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
