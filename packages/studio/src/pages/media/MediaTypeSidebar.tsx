import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useT } from '@trokky/trokky/i18n';
import type { MediaType, MediaTypeInfo } from './types';

interface MediaTypeSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mediaTypes: Record<MediaType, MediaTypeInfo>;
  selectedType: MediaType;
  onSelectType: (type: MediaType) => void;
}

/**
 * The media type filter rail down the left of the library.
 */
export function MediaTypeSidebar({
  isOpen,
  onClose,
  mediaTypes,
  selectedType,
  onSelectType,
}: MediaTypeSidebarProps) {
  const { t } = useT('studio');

  return (
    <div className={`${isOpen ? 'block' : 'hidden'} lg:block w-48 lg:w-56 flex-shrink-0`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-900 dark:text-white uppercase tracking-wide">
            <FunnelIcon className="h-3 w-3 inline mr-1" />
            {t('media.filters')}
          </h3>
          <button
            onClick={onClose}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-0.5">
          {Object.entries(mediaTypes).map(([type, info]) => {
            const Icon = info.icon;
            return (
              <button
                key={type}
                onClick={() => onSelectType(type as MediaType)}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors ${
                  selectedType === type
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <Icon className="h-3 w-3 mr-1.5" />
                  {info.label}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {info.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
