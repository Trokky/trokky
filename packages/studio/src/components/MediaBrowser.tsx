/**
 * Media Browser Component
 * Lightweight media selection modal for field components
 * Built on the shared Dialog primitive
 */

import type { MediaFieldValue, MediaType } from '@trokky/trokky/types';
import { MediaBrowserContent } from './MediaBrowserContent';
import { Dialog } from './ui/Dialog.js';
import { useT } from '@trokky/trokky/i18n';

// API client interface (matching StudioContext.apiClient structure)
interface MediaBrowserAPI {
  getMedia: (options?: any) => Promise<any>;
  getMediaById?: (id: string) => Promise<any>;
  uploadMedia?: (file: File, collection?: string, metadata?: any) => Promise<any>;
  deleteMedia?: (id: string) => Promise<any>;
  updateMedia?: (id: string, metadata: any) => Promise<any>;
}

interface MediaBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: MediaFieldValue) => void;
  mediaTypeFilter?: MediaType;
  showVariantSelector?: boolean;
  context?: string;
  apiClient?: MediaBrowserAPI;
  // Studio logger for consistent logging
  logger?: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error | any) => void;
  };
  // MediaUrlGenerator for proper URL construction
  mediaUrlGenerator?: {
    getMediaUrl: (mediaId: string, variant?: string) => string;
  } | null;
}

export function MediaBrowser({
  isOpen,
  onClose,
  onSelect,
  mediaTypeFilter,
  showVariantSelector = false,
  context,
  apiClient,
  logger,
  mediaUrlGenerator
}: MediaBrowserProps) {
  const { t } = useT('studio');

  const handleSelect = (value: MediaFieldValue) => {
    onSelect(value);
    onClose();
  };

  const getModalSubtitle = () => {
    if (!mediaTypeFilter) {
      return t('mediaBrowser.selectFile');
    }
    switch (mediaTypeFilter) {
      case 'image':
        return t('mediaBrowser.selectImage');
      case 'video':
        return t('mediaBrowser.selectVideo');
      case 'audio':
        return t('mediaBrowser.selectAudio');
      case 'document':
        return t('mediaBrowser.selectDocument');
      default:
        return t('mediaBrowser.selectFile');
    }
  };

  const closeLabel = t('mediaBrowser.close');

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      variant="center"
      size="xl"
      height="fill"
      className="overflow-hidden"
      ariaLabel={closeLabel}
    >
      <Dialog.Header padded={false} className="px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('mediaBrowser.title')}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {getModalSubtitle()}
        </p>
      </Dialog.Header>
      <Dialog.Body scroll={false} padded={false}>
        <MediaBrowserContent
          onSelect={handleSelect}
          mediaTypeFilter={mediaTypeFilter}
          showVariantSelector={showVariantSelector}
          context={context}
          apiClient={apiClient}
          logger={logger}
          mediaUrlGenerator={mediaUrlGenerator}
        />
      </Dialog.Body>
    </Dialog>
  );
}
