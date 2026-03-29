import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  scale?: number;
  onPageCount?: (count: number) => void;
  renderOverlay?: (pageNumber: number, pageWidth: number, pageHeight: number) => ReactNode;
}

interface PageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export function PdfViewer({ url, scale = 1.5, onPageCount, renderOverlay }: PdfViewerProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;

        if (cancelled) return;
        pdfDocRef.current = pdfDoc;

        const pageCount = pdfDoc.numPages;
        onPageCount?.(pageCount);

        const pageInfos: PageInfo[] = [];
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale });
          pageInfos.push({
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
          });
        }

        if (cancelled) return;
        setPages(pageInfos);
        setLoading(false);

        // Render each page to canvas
        for (let i = 1; i <= pageCount; i++) {
          if (cancelled) break;
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = canvasRefs.current.get(i);
          if (!canvas) continue;

          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport,
            canvas,
          } as any).promise;
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load PDF');
          setLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [url, scale, onPageCount]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Loading PDF...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          color: 'var(--color-error)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '16px 0' }}>
      {pages.map((page) => (
        <div key={page.pageNumber} style={{ position: 'relative' }}>
          <canvas
            ref={(el) => {
              if (el) canvasRefs.current.set(page.pageNumber, el);
              else canvasRefs.current.delete(page.pageNumber);
            }}
            style={{
              display: 'block',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
          {renderOverlay && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: page.width,
                height: page.height,
                pointerEvents: 'none',
              }}
            >
              {renderOverlay(page.pageNumber, page.width, page.height)}
            </div>
          )}
          <div
            style={{
              textAlign: 'center',
              marginTop: 4,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            Page {page.pageNumber} of {pages.length}
          </div>
        </div>
      ))}
    </div>
  );
}
