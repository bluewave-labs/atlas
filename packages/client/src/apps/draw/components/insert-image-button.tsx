import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { ImagePlus } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export function InsertImageButton({
  excalidrawApi,
}: {
  excalidrawApi: ExcalidrawImperativeAPI | null;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInsertImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !excalidrawApi) return;
    if (file.size > 10 * 1024 * 1024) { alert(t('draw.imageTooLarge')); return; }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get image dimensions
      const img = new window.Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const fileId = crypto.randomUUID() as any;

      // Register the file with Excalidraw
      excalidrawApi.addFiles([{
        id: fileId,
        dataURL: dataUrl as any,
        mimeType: file.type as any,
        created: Date.now(),
        lastRetrieved: Date.now(),
      }]);

      // Scale to fit within canvas (max 600px width/height)
      const maxSize = 600;
      let width = img.width;
      let height = img.height;
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const imageElement = {
        type: 'image' as const,
        id: crypto.randomUUID(),
        fileId,
        x: 100,
        y: 100,
        width,
        height,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid' as const,
        strokeWidth: 0,
        roughness: 0,
        opacity: 100,
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        groupIds: [],
        boundElements: null,
        locked: false,
        link: null,
        updated: Date.now(),
        status: 'saved' as const,
        scale: [1, 1] as [number, number],
      };

      const existingElements = excalidrawApi.getSceneElements();
      excalidrawApi.updateScene({
        elements: [...existingElements, imageElement] as any,
      });
    } catch {
      // Failed to insert image
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [excalidrawApi]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        icon={<ImagePlus size={13} />}
        onClick={() => fileInputRef.current?.click()}
        title={t('draw.insertImage')}
      >
        {t('draw.insertImage')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInsertImage}
      />
    </>
  );
}
