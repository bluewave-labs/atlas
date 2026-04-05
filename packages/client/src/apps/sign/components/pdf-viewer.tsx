import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
  url: string;
  scale?: number;
  onPageCount?: (count: number) => void;
  renderOverlay?: (pageNumber: number, pageWidth: number, pageHeight: number) => ReactNode;
  /** Callback to receive page image data URLs for thumbnail rendering */
  onPageImages?: (images: Array<{ page: number; dataUrl: string; width: number; height: number }>) => void;
  /** When set, scrolls the given page into view */
  scrollToPage?: number | null;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
}

export function PdfViewer({ url, scale = 1.5, onPageCount, renderOverlay, onPageImages, scrollToPage }: PdfViewerProps) {
  const { t } = useTranslation();
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const urlRef = useRef(url);

  // Load PDF and convert each page to an image data URL
  useEffect(() => {
    let cancelled = false;
    urlRef.current = url;

    async function loadAndRender() {
      setLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdfDoc;
        const pageCount = pdfDoc.numPages;
        onPageCount?.(pageCount);

        const pageDataArr: PageData[] = [];
        const thumbnailArr: Array<{ page: number; dataUrl: string; width: number; height: number }> = [];

        for (let i = 1; i <= pageCount; i++) {
          const page = await pdfDoc.getPage(i);
          if (cancelled) return;

          // Render full-size page
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          if (cancelled) return;

          const dataUrl = canvas.toDataURL('image/png');
          pageDataArr.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            dataUrl,
          });

          // Generate thumbnail at a smaller scale
          const thumbScale = 0.3;
          const thumbViewport = page.getViewport({ scale: thumbScale });
          const thumbCanvas = document.createElement('canvas');
          const thumbCtx = thumbCanvas.getContext('2d');
          if (thumbCtx) {
            thumbCanvas.width = thumbViewport.width;
            thumbCanvas.height = thumbViewport.height;
            await page.render({ canvasContext: thumbCtx, viewport: thumbViewport } as any).promise;
            if (!cancelled) {
              thumbnailArr.push({
                page: i,
                dataUrl: thumbCanvas.toDataURL('image/png'),
                width: thumbViewport.width,
                height: thumbViewport.height,
              });
            }
          }
        }

        if (cancelled) return;
        setPages(pageDataArr);
        setLoading(false);

        // Send thumbnail data to parent
        if (onPageImages && thumbnailArr.length > 0) {
          onPageImages(thumbnailArr);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setError(t('sign.pdf.loading'));
          setLoading(false);
        }
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
    // Only re-run when URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Scroll to page when requested
  useEffect(() => {
    if (scrollToPage == null) return;
    const el = pageRefs.current.get(scrollToPage);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToPage]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-sm)' }}>
        {t('sign.pdf.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--color-error)', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-sm)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
      {pages.map((page) => (
        <div
          key={page.pageNumber}
          id={`sign-page-${page.pageNumber}`}
          ref={(el) => {
            if (el) pageRefs.current.set(page.pageNumber, el);
            else pageRefs.current.delete(page.pageNumber);
          }}
          style={{ position: 'relative' }}
        >
          <img
            src={page.dataUrl}
            alt={`Page ${page.pageNumber}`}
            width={page.width}
            height={page.height}
            style={{
              display: 'block',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 'var(--radius-sm)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
          {renderOverlay && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: page.width,
                height: page.height,
              }}
            >
              {renderOverlay(page.pageNumber, page.width, page.height)}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            {t('sign.pdf.pageOf', { current: page.pageNumber, total: pages.length })}
          </div>
        </div>
      ))}
    </div>
  );
}
