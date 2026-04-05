import { useTranslation } from 'react-i18next';
import {
  useDriveSettingsStore,
  type DriveDefaultView,
  type DriveDefaultSort,
  type DriveSidebarDefault,
  type DriveMaxVersions,
  type DriveShareDefaultExpiry,
  type DriveDuplicateHandling,
  type DriveSortOrder,
} from '../settings-store';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SettingsSelect,
} from '../../../components/settings/settings-primitives';

// ---------------------------------------------------------------------------
// Panel: General
// ---------------------------------------------------------------------------

export function DriveGeneralPanel() {
  const { t } = useTranslation();
  const {
    defaultView, setDefaultView,
    defaultSort, setDefaultSort,
    sidebarDefault, setSidebarDefault,
    sortOrder, setSortOrder,
    confirmDelete, setConfirmDelete,
  } = useDriveSettingsStore();

  const viewOptions: Array<{ value: DriveDefaultView; label: string }> = [
    { value: 'list', label: t('drive.settings.viewList') },
    { value: 'grid', label: t('drive.settings.viewGrid') },
  ];

  const sortOptions: Array<{ value: DriveDefaultSort; label: string }> = [
    { value: 'default', label: t('drive.settings.sortDefault') },
    { value: 'name', label: t('drive.settings.sortName') },
    { value: 'size', label: t('drive.settings.sortSize') },
    { value: 'date', label: t('drive.settings.sortDate') },
    { value: 'type', label: t('drive.settings.sortType') },
  ];

  const sidebarOptions: Array<{ value: DriveSidebarDefault; label: string }> = [
    { value: 'files', label: t('drive.settings.sidebarMyDrive') },
    { value: 'favourites', label: t('drive.settings.sidebarFavourites') },
    { value: 'recent', label: t('drive.settings.sidebarRecent') },
  ];

  const sortOrderOptions: Array<{ value: DriveSortOrder; label: string }> = [
    { value: 'asc', label: t('drive.settings.ascending') },
    { value: 'desc', label: t('drive.settings.descending') },
  ];

  return (
    <div>
      <SettingsSection title={t('drive.settings.viewLayout')} description={t('drive.settings.viewLayoutDesc')}>
        <SettingsRow label={t('drive.settings.defaultView')} description={t('drive.settings.defaultViewDesc')}>
          <SettingsSelect value={defaultView} options={viewOptions} onChange={setDefaultView} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.defaultSort')} description={t('drive.settings.defaultSortDesc')}>
          <SettingsSelect value={defaultSort} options={sortOptions} onChange={setDefaultSort} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.sortDirection')} description={t('drive.settings.sortDirectionDesc')}>
          <SettingsSelect value={sortOrder} options={sortOrderOptions} onChange={setSortOrder} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.sidebarDefault')} description={t('drive.settings.sidebarDefaultDesc')}>
          <SettingsSelect value={sidebarDefault} options={sidebarOptions} onChange={setSidebarDefault} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('drive.settings.safety')} description={t('drive.settings.safetyDesc')}>
        <SettingsRow label={t('drive.settings.confirmBeforeDelete')} description={t('drive.settings.confirmBeforeDeleteDesc')}>
          <SettingsToggle checked={confirmDelete} onChange={setConfirmDelete} label={t('drive.settings.confirmBeforeDelete')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Display
// ---------------------------------------------------------------------------

export function DriveDisplayPanel() {
  const { t } = useTranslation();
  const {
    showPreviewPanel, setShowPreviewPanel,
    compactMode, setCompactMode,
    showThumbnails, setShowThumbnails,
    showFileExtensions, setShowFileExtensions,
  } = useDriveSettingsStore();

  return (
    <div>
      <SettingsSection title={t('drive.settings.displayOptions')} description={t('drive.settings.displayOptionsDesc')}>
        <SettingsRow label={t('drive.settings.previewPanel')} description={t('drive.settings.previewPanelDesc')}>
          <SettingsToggle checked={showPreviewPanel} onChange={setShowPreviewPanel} label={t('drive.settings.previewPanel')} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.compactMode')} description={t('drive.settings.compactModeDesc')}>
          <SettingsToggle checked={compactMode} onChange={setCompactMode} label={t('drive.settings.compactMode')} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.showThumbnails')} description={t('drive.settings.showThumbnailsDesc')}>
          <SettingsToggle checked={showThumbnails} onChange={setShowThumbnails} label={t('drive.settings.showThumbnails')} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.showFileExtensions')} description={t('drive.settings.showFileExtensionsDesc')}>
          <SettingsToggle checked={showFileExtensions} onChange={setShowFileExtensions} label={t('drive.settings.showFileExtensions')} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Files
// ---------------------------------------------------------------------------

export function DriveFilesPanel() {
  const { t } = useTranslation();
  const {
    autoVersionOnReplace, setAutoVersionOnReplace,
    maxVersions, setMaxVersions,
    shareDefaultExpiry, setShareDefaultExpiry,
    duplicateHandling, setDuplicateHandling,
  } = useDriveSettingsStore();

  const maxVersionOptions: Array<{ value: DriveMaxVersions; label: string }> = [
    { value: 5, label: t('drive.settings.versions5') },
    { value: 10, label: t('drive.settings.versions10') },
    { value: 20, label: t('drive.settings.versions20') },
    { value: 50, label: t('drive.settings.versions50') },
  ];

  const expiryOptions: Array<{ value: DriveShareDefaultExpiry; label: string }> = [
    { value: 'never', label: t('drive.settings.expiryNever') },
    { value: '1', label: t('drive.settings.expiry1Day') },
    { value: '7', label: t('drive.settings.expiry7Days') },
    { value: '30', label: t('drive.settings.expiry30Days') },
  ];

  const duplicateOptions: Array<{ value: DriveDuplicateHandling; label: string }> = [
    { value: 'rename', label: t('drive.settings.duplicateRename') },
    { value: 'replace', label: t('drive.settings.duplicateReplace') },
    { value: 'ask', label: t('drive.settings.duplicateAsk') },
  ];

  return (
    <div>
      <SettingsSection title={t('drive.settings.versioning')} description={t('drive.settings.versioningDesc')}>
        <SettingsRow label={t('drive.settings.autoVersion')} description={t('drive.settings.autoVersionDesc')}>
          <SettingsToggle checked={autoVersionOnReplace} onChange={setAutoVersionOnReplace} label={t('drive.settings.autoVersion')} />
        </SettingsRow>
        <SettingsRow label={t('drive.settings.maxVersions')} description={t('drive.settings.maxVersionsDesc')}>
          <SettingsSelect value={maxVersions} options={maxVersionOptions} onChange={setMaxVersions} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('drive.settings.sharingSection')} description={t('drive.settings.sharingSectionDesc')}>
        <SettingsRow label={t('drive.settings.defaultLinkExpiry')} description={t('drive.settings.defaultLinkExpiryDesc')}>
          <SettingsSelect value={shareDefaultExpiry} options={expiryOptions} onChange={setShareDefaultExpiry} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('drive.settings.uploads')} description={t('drive.settings.uploadsDesc')}>
        <SettingsRow label={t('drive.settings.duplicateHandling')} description={t('drive.settings.duplicateHandlingDesc')}>
          <SettingsSelect value={duplicateHandling} options={duplicateOptions} onChange={setDuplicateHandling} />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
