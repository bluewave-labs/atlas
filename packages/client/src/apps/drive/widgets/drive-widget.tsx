import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { HardDrive } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

interface DriveWidgetData {
  fileCount: number;
  folderCount: number;
  storageUsed: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DriveWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.drive.widget,
    queryFn: async () => {
      const { data: res } = await api.get('/drive/widget');
      return res.data as DriveWidgetData;
    },
    staleTime: 60_000,
  });

  const fileCount = data?.fileCount ?? 0;
  const folderCount = data?.folderCount ?? 0;
  const storageUsed = data?.storageUsed ?? 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-lg)',
        gap: 'var(--spacing-sm)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
        <HardDrive size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)' }}>
          {t('drive.widgetTitle', 'Drive')}
        </span>
      </div>

      {/* Big number */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {fileCount}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.6)' }}>
        {t('drive.widgetFiles', 'files')}
      </div>

      {/* Storage + folder info */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 10, marginTop: 2 }}>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {formatBytes(storageUsed)}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {folderCount} {t('drive.widgetFolders', 'folders')}
        </span>
      </div>
    </div>
  );
}
