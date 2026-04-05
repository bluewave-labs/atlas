import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Download, Pencil, Copy, FolderInput, Star, Tag, Share2,
  Upload, Trash2, RotateCcw, ExternalLink, FileArchive,
} from 'lucide-react';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../../../components/ui/context-menu';
import type { DriveItem } from '@atlasmail/shared';
import type { SidebarView } from '../lib/types';

interface DriveContextMenuProps {
  contextMenu: { x: number; y: number; item: DriveItem };
  setContextMenu: (v: null) => void;
  sidebarView: SidebarView;
  handleRestore: (item: DriveItem) => void;
  handlePermanentDelete: (item: DriveItem) => void;
  handleDownload: (item: DriveItem) => void;
  handleDownloadZip: (item: DriveItem) => void;
  handleRename: (item: DriveItem) => void;
  handleSetIcon: (item: DriveItem) => void;
  handleDuplicate: (item: DriveItem) => void;
  handleMove: (item: DriveItem) => void;
  handleToggleFavourite: (item: DriveItem) => void;
  handleAddTag: (item: DriveItem) => void;
  setShareModalItem: (item: DriveItem) => void;
  setReplaceTargetId: (id: string) => void;
  replaceFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleMoveToTrash: (item: DriveItem) => void;
}

export function DriveContextMenuView({
  contextMenu,
  setContextMenu,
  sidebarView,
  handleRestore,
  handlePermanentDelete,
  handleDownload,
  handleDownloadZip,
  handleRename,
  handleSetIcon,
  handleDuplicate,
  handleMove,
  handleToggleFavourite,
  handleAddTag,
  setShareModalItem,
  setReplaceTargetId,
  replaceFileInputRef,
  handleMoveToTrash,
}: DriveContextMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} minWidth={180}>
      {sidebarView === 'trash' ? (
        <>
          <ContextMenuItem
            icon={<RotateCcw size={14} />}
            label={t('drive.context.restore')}
            onClick={() => handleRestore(contextMenu.item)}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Trash2 size={14} />}
            label={t('drive.context.deletePermanently')}
            onClick={() => handlePermanentDelete(contextMenu.item)}
            destructive
          />
        </>
      ) : (
        <>
          {contextMenu.item.linkedResourceType && contextMenu.item.linkedResourceId && (
            <ContextMenuItem
              icon={<ExternalLink size={14} />}
              label={t('drive.context.openInEditor')}
              onClick={() => {
                const item = contextMenu.item;
                setContextMenu(null);
                if (item.linkedResourceType === 'document') navigate(`/docs/${item.linkedResourceId}`);
                else if (item.linkedResourceType === 'drawing') navigate(`/draw/${item.linkedResourceId}`);
                else if (item.linkedResourceType === 'spreadsheet') navigate(`/tables/${item.linkedResourceId}`);
              }}
            />
          )}
          {contextMenu.item.type === 'file' && !contextMenu.item.linkedResourceType && (
            <ContextMenuItem
              icon={<Download size={14} />}
              label={t('drive.context.download')}
              onClick={() => handleDownload(contextMenu.item)}
            />
          )}
          {contextMenu.item.type === 'folder' && (
            <ContextMenuItem
              icon={<FileArchive size={14} />}
              label={t('drive.context.downloadAsZip')}
              onClick={() => handleDownloadZip(contextMenu.item)}
            />
          )}
          <ContextMenuItem
            icon={<Pencil size={14} />}
            label={t('drive.context.rename')}
            onClick={() => handleRename(contextMenu.item)}
          />
          {contextMenu.item.type === 'folder' && (
            <ContextMenuItem
              icon={<span style={{ fontSize: 14, lineHeight: 1 }}>{contextMenu.item.icon || '😀'}</span>}
              label={contextMenu.item.icon ? t('drive.context.changeIcon') : t('drive.context.addIcon')}
              onClick={() => handleSetIcon(contextMenu.item)}
            />
          )}
          <ContextMenuItem
            icon={<Copy size={14} />}
            label={t('drive.context.duplicate')}
            onClick={() => handleDuplicate(contextMenu.item)}
          />
          <ContextMenuItem
            icon={<FolderInput size={14} />}
            label={t('drive.context.moveTo')}
            onClick={() => handleMove(contextMenu.item)}
          />
          <ContextMenuItem
            icon={<Star size={14} />}
            label={contextMenu.item.isFavourite ? t('drive.context.removeFromFavourites') : t('drive.context.addToFavourites')}
            onClick={() => handleToggleFavourite(contextMenu.item)}
          />
          <ContextMenuItem
            icon={<Tag size={14} />}
            label={t('drive.context.addTag')}
            onClick={() => handleAddTag(contextMenu.item)}
          />
          <ContextMenuItem
            icon={<Share2 size={14} />}
            label={t('drive.context.share')}
            onClick={() => { setShareModalItem(contextMenu.item); setContextMenu(null); }}
          />
          {contextMenu.item.type === 'file' && (
            <ContextMenuItem
              icon={<Upload size={14} />}
              label={t('drive.context.uploadNewVersion')}
              onClick={() => {
                setReplaceTargetId(contextMenu.item.id);
                setContextMenu(null);
                setTimeout(() => replaceFileInputRef.current?.click(), 50);
              }}
            />
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            icon={<Trash2 size={14} />}
            label={t('drive.context.moveToTrash')}
            onClick={() => handleMoveToTrash(contextMenu.item)}
            destructive
          />
        </>
      )}
    </ContextMenu>
  );
}
