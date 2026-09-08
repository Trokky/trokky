import { useLocation } from 'react-router-dom';
import { useT } from '@trokky/trokky/i18n';
import { useDocumentTypes } from '@/hooks/useStructure';
import { StructureContextSidebar } from './StructureContextSidebar';
import { cn } from '@/utils/cn';

export function ContentContext() {
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const schemaName = pathParts[2];
  
  return (
    <div className="p-4">
      {schemaName ? (
        <StructureContextSidebar schemaName={schemaName} />
      ) : (
        <ContentOverviewContext />
      )}
    </div>
  );
}

function ContentOverviewContext() {
  const { t } = useT('studio');
  const { documentTypes } = useDocumentTypes();

  return (
    <>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.contentTypes')}
      </h3>
      <div className="space-y-2">
        {documentTypes.map((type) => (
          <div
            key={type.name}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  {type.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {type.name}
                </div>
              </div>
              {type.badge && (
                <span className={cn(
                  "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                  `bg-${type.badge.color}-100 text-${type.badge.color}-800 dark:bg-${type.badge.color}-800 dark:text-${type.badge.color}-100`
                )}>
                  {type.badge.count}
                </span>
              )}
            </div>
          </div>
        ))}
        
        {documentTypes.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('contextSidebar.noContentTypes')}
          </div>
        )}
      </div>
    </>
  );
}