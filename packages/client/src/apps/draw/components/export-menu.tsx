import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToBlob, exportToSvg, exportToClipboard } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  Download,
  Image,
  FileImage,
  Clipboard,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useDrawSettingsStore } from '../settings-store';

export function ExportMenu({
  excalidrawApi,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { exportQuality, exportWithBackground } = useDrawSettingsStore();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleExportPng = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
        getDimensions: () => ({ width: 1920 * exportQuality, height: 1080 * exportQuality, scale: exportQuality }),
      } as any);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drawing.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportQuality, exportWithBackground]);

  const handleExportSvg = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
      } as any);
      const svgStr = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drawing.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportWithBackground]);

  const handleCopyClipboard = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      await exportToClipboard({
        elements,
        appState: { ...appState, exportBackground: exportWithBackground },
        files,
        type: 'png',
      } as any);
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportWithBackground]);

  const handleExportPdf = useCallback(async () => {
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    try {
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, exportWithDarkMode: appState.theme === 'dark', exportBackground: exportWithBackground },
        files,
        getDimensions: () => ({ width: 1920 * exportQuality, height: 1080 * exportQuality, scale: exportQuality }),
      } as any);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });
      const { jsPDF } = await import('jspdf');
      const orientation = img.width >= img.height ? 'landscape' : 'portrait';
      const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
      pdf.save('drawing.pdf');
    } catch { /* ignore */ }
    setOpen(false);
  }, [excalidrawApi, exportQuality, exportWithBackground]);

  const menuItems = [
    { label: t('draw.exportPng'), icon: <Image size={14} />, onClick: handleExportPng },
    { label: t('draw.exportSvg'), icon: <FileImage size={14} />, onClick: handleExportSvg },
    { label: t('draw.exportPdf'), icon: <Download size={14} />, onClick: handleExportPdf },
    { label: t('draw.copyClipboard'), icon: <Clipboard size={14} />, onClick: handleCopyClipboard },
  ];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Button
        variant="ghost"
        size="sm"
        icon={<Download size={13} />}
        onClick={() => setOpen(!open)}
        title={t('draw.export')}
      >
        {t('draw.export')}
        <ChevronDown size={11} />
      </Button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 180,
            width: 'max-content',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 20,
            padding: 4,
          }}
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 8px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                transition: 'background 0.12s ease',
                whiteSpace: 'nowrap',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--color-text-tertiary)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
