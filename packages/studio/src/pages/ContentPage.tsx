import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  PlusIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useT } from 'trokky/i18n';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiClientError } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { storage } from '@/utils/storage';
import { useStructureItem } from '@/hooks/useStructure';
import { useStudioContext } from '@/contexts/StudioContext';
import { useStructureContextSidebar } from '@/hooks/useStructureContextSidebar';
import { usePermissions } from '@/hooks/usePermissions';
import type { Document } from '@/types';
import { DocumentEditor } from '@/components/document';

// Import view components
import { ContentViewControls, type ViewType, type ViewConfig, type FilterConfig, type SortConfig } from '@/components/content/ContentViewControls';
import { ListView, getDefaultColumns, type ListColumn } from '@/components/content/views/ListView';
import { GridView } from '@/components/content/views/GridView';
import { TableView } from '@/components/content/views/TableView';
import { Pagination } from '@/components/content/Pagination';
import { ChangeStatusModal } from '@/components/content/ChangeStatusModal';

const logger = createStudioLogger('ContentPage');

// Helper function to get user-friendly display names
function getSchemaDisplayName(schemaName?: string): string {
  if (!schemaName) return 'Document';
  
  const displayNames: Record<string, string> = {
    'article': 'Article',
    'author': 'Author', 
    'category': 'Category',
    'homePage': 'Home Page',
    'post': 'Post'
  };
  
  return displayNames[schemaName] || schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
}

export function ContentPage() {
  const { schemaName, documentId } = useParams();
  const navigate = useNavigate();
  const structureItem = useStructureItem(schemaName || '');
  
  // Use structure-driven context sidebar for content pages
  useStructureContextSidebar();


  // Handle document editing
  if (documentId) {
    // Prevent creation of new singleton documents only
    if (documentId === 'new' && structureItem.item?.type === 'singleton') {
      return <NoCreateRedirect schemaName={schemaName!} />;
    }
    
    return (
      <DocumentEditor 
        schemaName={schemaName!}
        documentId={documentId}
        onCancel={() => navigate(`/content/${schemaName}`)}
      />
    );
  }

  // Handle schema-specific content
  if (schemaName) {
    // Check if this is a singleton from structure configuration
    if (structureItem.item?.type === 'singleton') {
      const singleton = structureItem.item;
      const singletonDocumentId = singleton.documentId || schemaName;
      
      // For singletons, only view existing documents, don't auto-create
      return (
        <SingletonHandler
          schemaName={schemaName}
          documentId={singletonDocumentId}
          autoCreate={false}
          onCancel={() => navigate('/content')}
        />
      );
    }

    // Regular collection view
    return <ContentListPage schemaName={schemaName} key={schemaName} />;
  }

  return <ContentOverview />;
}

// Enhanced Content List Page Component
function ContentListPage({ schemaName }: { schemaName: string }) {
  const navigate = useNavigate();
  const { t } = useT('studio');
  const studioContext = useStudioContext();
  const structureItem = useStructureItem(schemaName);
  const permissions = usePermissions();

  // Check if user has publish permission for this schema
  const hasPublishPermission = permissions.hasSchemaPermission(schemaName, 'publish');

  // Function to check if user can delete a specific document
  const canDeleteDocument = (document: Document) => permissions.canDeleteDocument(schemaName, document);

  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  
  // View state with localStorage persistence
  const [currentView, setCurrentView] = useState<ViewType>(() => 
    storage.getContentView(schemaName, 'list') as ViewType
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [currentSort, setCurrentSort] = useState<{ field: string; direction: 'asc' | 'desc' } | null>(null);
  
  // Column visibility state for table view - initialize with all columns visible by default
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = storage.getColumnVisibility(schemaName, {});
    // Initialize any missing columns as visible
    const defaultColumns = getDefaultColumns();
    const initialized = { ...saved };
    defaultColumns.forEach(col => {
      if (initialized[col.key] === undefined) {
        initialized[col.key] = true; // Default to visible
      }
    });
    return initialized;
  });
  
  // Grid and table settings (for future enhancement)
  const [gridSettings] = useState(() => 
    storage.getGridSettings(schemaName, { cardSize: 'medium', columnsPerRow: null })
  );
  const [tableSettings] = useState(() => 
    storage.getTableSettings(schemaName, { density: 'comfortable', columnWidths: {} })
  );
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  
  // Load documents on mount and when dependencies change
  useEffect(() => {
    loadDocuments();
  }, [schemaName, activeFilters, currentSort, searchQuery, currentPage, pageSize]);
  
  // Reset page when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilters, currentSort, searchQuery]);
  
  // Load documents from API
  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }

      // Debug: Log filter parameters
      const queryParams = {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        filter: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        sort: currentSort ? `${currentSort.direction === 'desc' ? '-' : ''}${currentSort.field}` : undefined
      };

      logger.info('Loading documents with filters', {
        schemaName,
        activeFilters,
        queryParams
      });

      // Use the API client's proper method
      const response = await apiClient.listDocuments(schemaName, queryParams);
      
      if (response.success && response.data?.documents) {
        setDocuments(response.data.documents);
        setTotalItems(response.data.pagination?.total || response.data.documents.length);

        // Debug: Log returned documents and their status
        const statusBreakdown = response.data.documents.reduce((acc: any, doc: any) => {
          const status = doc._status || 'undefined';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        logger.info('Documents loaded', {
          schema: schemaName,
          count: response.data.documents.length,
          total: response.data.pagination?.total,
          page: currentPage,
          statusBreakdown,
          sampleStatuses: response.data.documents.slice(0, 3).map((d: any) => ({
            id: d.id || d._id,
            title: d.title,
            _status: d._status,
            published: d.published
          }))
        });
      } else {
        setDocuments([]);
        setTotalItems(0);
      }
    } catch (err) {
      logger.error('Failed to load documents', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle document actions
  const handleDocumentAction = async (documentId: string, action: string) => {
    try {
      switch (action) {
        case 'delete':
          const confirmed = await studioContext?.utils?.showConfirm?.(
            t('content.confirmDelete'),
            {
              title: t('content.deleteDocument'),
              confirmText: t('common.delete'),
              cancelText: t('common.cancel'),
              variant: 'danger'
            }
          );
          if (!confirmed) return;
          await apiClient.deleteDocument(schemaName, documentId);
          logger.info('Document deleted', { schema: schemaName, id: documentId });
          await loadDocuments();
          setSelectedItems(prev => prev.filter(id => id !== documentId));
          break;
          
        case 'duplicate':
          const docResponse = await apiClient.getDocument(schemaName, documentId);
          if (docResponse.success && docResponse.data) {
            const originalDoc = docResponse.data;

            // Clean up the document for duplication - remove system fields
            const duplicateData = { ...originalDoc };

            // Remove system fields that should not be duplicated
            delete (duplicateData as any)._id;
            delete (duplicateData as any).id;
            delete (duplicateData as any)._createdAt;
            delete (duplicateData as any)._updatedAt;
            delete duplicateData._revision;
            delete duplicateData._collection;

            // Set as draft status
            duplicateData._status = 'draft';

            // Handle title/name field intelligently - append (Copy) to the primary display field
            if ((duplicateData as any).name) {
              (duplicateData as any).name = `${(duplicateData as any).name} (Copy)`;
            } else if ((duplicateData as any).title) {
              (duplicateData as any).title = `${(duplicateData as any).title} (Copy)`;
            }

            // Remove slug so it can be auto-generated from the new name/title
            delete (duplicateData as any).slug;

            // Navigate to create form with pre-filled data
            navigate(`/content/${schemaName}/new`, {
              state: { duplicateData }
            });
          }
          break;
          
        default:
          logger.warn('Unknown document action', { action, documentId });
      }
    } catch (err) {
      logger.error('Document action failed', { action, documentId, error: err });
      alert(`Failed to ${action} document: ${err instanceof ApiClientError ? err.message : 'Unknown error'}`);
    }
  };
  
  // Selection handlers
  const handleItemSelect = (id: string, selected: boolean) => {
    setSelectedItems(prev => 
      selected 
        ? [...prev, id]
        : prev.filter(item => item !== id)
    );
  };
  
  const handleSelectAll = (selected: boolean) => {
    setSelectedItems(selected ? documents.map(doc => doc.id || doc._id) : []);
  };
  
  // Filter/sort handlers
  const handleFilterChange = (filterId: string, value: any) => {
    setActiveFilters(prev => ({ ...prev, [filterId]: value }));
  };
  
  const handleClearFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
  };
  
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setCurrentSort({ field, direction });
  };
  
  // Handle view change with persistence
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    storage.setContentView(schemaName, view);
  };
  
  // Handle column visibility change with persistence
  const handleColumnVisibilityChange = (columnKey: string, visible: boolean) => {
    const newVisibility = { ...columnVisibility, [columnKey]: visible };
    setColumnVisibility(newVisibility);
    storage.setColumnVisibility(schemaName, newVisibility);
  };
  
  // Handle grid settings change with persistence (future use)
  // const handleGridSettingsChange = (newSettings: any) => {
  //   const updatedSettings = { ...gridSettings, ...newSettings };
  //   setGridSettings(updatedSettings);
  //   storage.setGridSettings(schemaName, updatedSettings);
  // };

  // Handle table settings change with persistence (future use)
  // const handleTableSettingsChange = (newSettings: any) => {
  //   const updatedSettings = { ...tableSettings, ...newSettings };
  //   setTableSettings(updatedSettings);
  //   storage.setTableSettings(schemaName, updatedSettings);
  // };

  // Handle bulk status change
  const isDocumentStatus = (
    value: string
  ): value is 'draft' | 'published' | 'archived' =>
    value === 'draft' || value === 'published' || value === 'archived';

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!isDocumentStatus(newStatus)) return;

    // Check if user has publish permission when changing to/from published
    const currentStatuses = selectedItems.map(id => {
      const doc = documents.find(d => d._id === id);
      return doc?._status;
    });

    const isPublishing = newStatus === 'published' && currentStatuses.some(s => s !== 'published');
    const isUnpublishing = newStatus !== 'published' && currentStatuses.some(s => s === 'published');

    if ((isPublishing || isUnpublishing) && !hasPublishPermission) {
      const action = isPublishing ? t('publish') : t('unpublish');
      studioContext?.utils?.showToast?.(
        t('content.noPublishPermission', { action }) || `You don't have permission to ${action} documents`,
        'error'
      );
      logger.warn('User lacks publish permission for bulk status change', {
        newStatus,
        isPublishing,
        isUnpublishing,
        hasPublishPermission
      });
      return;
    }

    try {
      setBulkActionLoading(true);

      // Update all selected documents
      await Promise.all(
        selectedItems.map(id =>
          apiClient.updateDocument(schemaName, id, { _status: newStatus })
        )
      );

      logger.info('Bulk status change completed', {
        count: selectedItems.length,
        newStatus
      });

      setIsChangeStatusModalOpen(false);
      setSelectedItems([]);
      await loadDocuments();
    } catch (err) {
      logger.error('Bulk status change failed', err);
      alert(`Failed to update document status: ${err instanceof ApiClientError ? err.message : 'Unknown error'}`);
    } finally {
      setBulkActionLoading(false);
    }
  };
  
  // Get view configurations
  const viewConfigs: ViewConfig[] = [
    { type: 'list', title: t('content.views.list'), icon: Bars3Icon, enabled: true },
    { type: 'grid', title: t('content.views.grid'), icon: DocumentTextIcon, enabled: true },
    { type: 'table', title: t('content.views.table'), icon: DocumentDuplicateIcon, enabled: true }
  ];
  
  const filterConfigs: FilterConfig[] = [
    {
      id: '_status',
      label: t('content.filters.status'),
      field: '_status',
      type: 'select',
      options: [
        { label: t('content.filters.draft'), value: 'draft' },
        { label: t('content.filters.published'), value: 'published' },
        { label: t('content.filters.archived'), value: 'archived' }
      ]
    }
  ];
  
  // Determine the primary title field for sorting
  // Try common field names in order of likelihood
  // This aligns with getSmartDocumentTitle() utility
  const titleField = documents && documents.length > 0 && documents[0].name ? 'name' : 'title';

  const sortConfigs: SortConfig[] = [
    { field: titleField, direction: 'asc', label: t('content.sort.title') },
    { field: '_createdAt', direction: 'desc', label: t('content.sort.createdDate') },
    { field: '_updatedAt', direction: 'desc', label: t('content.sort.updatedDate') }
  ];
  
  const bulkActions = [
    // Only show Change Status if user has publish permission
    ...(hasPublishPermission ? [{
      id: 'change-status',
      label: t('content.bulkActions.changeStatus'),
      icon: ArrowPathIcon
    }] : []),
    {
      id: 'delete',
      label: t('content.bulkActions.delete'),
      icon: TrashIcon,
      variant: 'destructive' as const
    }
  ];
  
  // Get default columns and override status render to use translations
  const columns = getDefaultColumns().map(col => {
    if (col.key === '_status') {
      return {
        ...col,
        render: (value: any) => {
          const status = value || 'draft';
          const isPublished = status === 'published';
          return (
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              isPublished
                ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
            }`}>
              {isPublished ? t('documentEditor.published') : t('documentEditor.draft')}
            </span>
          );
        }
      };
    }
    return col;
  });
  
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <h3 className="text-lg font-medium">{t('content.error.loadingDocuments')}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={loadDocuments}>{t('content.tryAgain')}</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {structureItem?.item?.title || `${getSchemaDisplayName(schemaName)} Documents`}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {structureItem?.item?.type === 'singleton'
                ? t('content.viewExisting')
                : t('content.manageDocuments')}
            </p>
          </div>
          {/* Create button - only for regular collections, not singletons */}
          {structureItem?.item?.type !== 'singleton' && (
            <Button onClick={() => navigate(`/content/${schemaName}/new`)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('content.create', { type: getSchemaDisplayName(schemaName) })}
            </Button>
          )}
        </div>
      </div>
      
      {/* Content controls */}
      <ContentViewControls
        availableViews={viewConfigs}
        currentView={currentView}
        onViewChange={handleViewChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={t('content.search', { type: schemaName })}
        availableFilters={filterConfigs}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        availableSorts={sortConfigs}
        currentSort={currentSort}
        onSortChange={handleSort}
        totalItems={totalItems}
        selectedItems={selectedItems.length}
        bulkActions={bulkActions}
        onBulkAction={async (actionId: string) => {
          if (selectedItems.length === 0) return;

          switch (actionId) {
            case 'change-status':
              setIsChangeStatusModalOpen(true);
              break;

            case 'duplicate':
              try {
                setBulkActionLoading(true);
                for (const id of selectedItems) {
                  await handleDocumentAction(id, 'duplicate');
                }
                setSelectedItems([]);
                await loadDocuments();
              } catch (err) {
                logger.error('Bulk duplicate failed', err);
                alert(`Failed to duplicate documents: ${err instanceof ApiClientError ? err.message : 'Unknown error'}`);
              } finally {
                setBulkActionLoading(false);
              }
              break;

            case 'delete':
              const confirmed = await studioContext?.utils?.showConfirm?.(
                t('content.confirmBulkDelete', { count: selectedItems.length }),
                {
                  title: t('content.deleteDocument'),
                  confirmText: t('content.deleteAll'),
                  cancelText: t('common.cancel'),
                  variant: 'danger'
                }
              );
              if (!confirmed) return;
              try {
                setBulkActionLoading(true);
                await Promise.all(selectedItems.map(id => apiClient.deleteDocument(schemaName, id)));
                setSelectedItems([]);
                await loadDocuments();
              } catch (err) {
                logger.error('Bulk delete failed', err);
                alert(`Failed to delete documents: ${err instanceof ApiClientError ? err.message : 'Unknown error'}`);
              } finally {
                setBulkActionLoading(false);
              }
              break;
          }
        }}
      />
      
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-6">
          {currentView === 'list' && (
            <ListView
              documents={documents}
              columns={columns as ListColumn[]}
              schemaName={schemaName}
              loading={loading}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onSelectAll={handleSelectAll}
              sortField={currentSort?.field}
              sortDirection={currentSort?.direction}
              onSort={handleSort}
              onDocumentAction={handleDocumentAction}
              canDelete={canDeleteDocument}
            />
          )}
          
          {currentView === 'grid' && (
            <GridView
              documents={documents}
              schemaName={schemaName}
              loading={loading}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onDocumentAction={handleDocumentAction}
              canDelete={canDeleteDocument}
              cardSize={(gridSettings?.cardSize as any) || 'medium'}
              columnsPerRow={gridSettings?.columnsPerRow || undefined}
            />
          )}
          
          {currentView === 'table' && (
            <TableView
              documents={documents}
              columns={columns.map(col => ({
                key: col.key,
                title: col.title,
                sortable: col.sortable,
                render: col.render,
                visible: columnVisibility[col.key] === true, // Use explicit boolean from state
                resizable: true,
                minWidth: 100
              }))}
              schemaName={schemaName}
              loading={loading}
              selectedItems={selectedItems}
              onItemSelect={handleItemSelect}
              onSelectAll={handleSelectAll}
              sortField={currentSort?.field}
              sortDirection={currentSort?.direction}
              onSort={handleSort}
              onDocumentAction={handleDocumentAction}
              canDelete={canDeleteDocument}
              onColumnVisibilityChange={handleColumnVisibilityChange}
              density={(tableSettings?.density as any) || 'comfortable'}
            />
          )}
        </div>
        
        {/* Pagination */}
        {totalItems > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalItems / pageSize)}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize: number) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
            showPageSizeSelector={true}
            pageSizeOptions={[10, 25, 50, 100]}
            showFirstLast={true}
          />
        )}
      </div>

      {/* Change Status Modal */}
      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={() => setIsChangeStatusModalOpen(false)}
        onConfirm={handleBulkStatusChange}
        selectedCount={selectedItems.length}
        loading={bulkActionLoading}
      />
    </div>
  );
}

interface SingletonHandlerProps {
  schemaName: string;
  documentId: string;
  autoCreate?: boolean;
  onCancel: () => void;
}

function SingletonHandler({ schemaName, documentId, autoCreate, onCancel }: SingletonHandlerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useT('studio');

  useEffect(() => {
    checkSingletonDocument();
  }, [schemaName, documentId]);

  const checkSingletonDocument = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }

      const response = await apiClient.getDocument(schemaName, documentId);
      
      if (response.success && response.data) {
        navigate(`/content/${schemaName}/${documentId}`, { replace: true });
      } else if (autoCreate) {
        await createSingletonDocument();
      } else {
        setError(`Document '${documentId}' not found. Only existing documents can be viewed.`);
      }
    } catch (err) {
      logger.error('Failed to check singleton document', err);
      
      if (autoCreate && err instanceof ApiClientError && err.status === 404) {
        await createSingletonDocument();
      } else {
        setError(err instanceof ApiClientError ? 
          `Document not found. Only existing documents can be viewed.` : 
          'Failed to load document');
      }
    } finally {
      setLoading(false);
    }
  };

  const createSingletonDocument = async () => {
    try {
      logger.info('Auto-creating singleton document', { schemaName, documentId });
      
      const response = await apiClient.createDocument(schemaName, {
        id: documentId,
        title: `${schemaName} Configuration`,
        _type: schemaName
      });
      
      if (response.success) {
        logger.info('Singleton document created', { schemaName, documentId });
        navigate(`/content/${schemaName}/${documentId}`, { replace: true });
      } else {
        setError('Failed to create singleton document');
      }
    } catch (err) {
      logger.error('Failed to create singleton document', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to create singleton document');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('content.loadingSingleton')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-amber-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">{t('content.error.documentNotFound')}</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <Button onClick={checkSingletonDocument}>{t('content.tryAgain')}</Button>
            <Button variant="outline" onClick={onCancel}>{t('content.backToContent')}</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DocumentEditor 
      schemaName={schemaName}
      documentId={documentId}
      onCancel={onCancel}
    />
  );
}

interface Collection {
  name: string;
  title: string;
  type: string;
}

function ContentOverview() {
  const navigate = useNavigate();
  const { t } = useT('studio');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      // Use the collections endpoint that matches our demo backend
      const response = await apiClient.get<{ collections: Collection[] }>('/collections');
      
      if (response.success && response.data?.collections) {
        setCollections(response.data.collections);
        logger.info('Collections loaded', { count: response.data.collections.length });
      } else {
        setError('No collections found');
      }
    } catch (err) {
      logger.error('Failed to load collections', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('content.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('content.subtitle')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('content.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('content.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('content.subtitle')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">
              {t('content.error.loadingTypes')}
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <Button onClick={loadCollections}>
            {t('content.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('content.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('content.subtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('content.noTypes')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('content.noTypesDescription')}
          </p>
          <Button onClick={loadCollections}>
            {t('content.refresh')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('content.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('content.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((collection) => (
          <div key={collection.name} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <DocumentTextIcon className="h-8 w-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {collection.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {collection.name}
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => navigate(`/content/${collection.name}`)}
                >
                  {t('content.viewDocuments')}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component to handle redirecting from /new routes
function NoCreateRedirect({ schemaName }: { schemaName: string }) {
  const navigate = useNavigate();
  const { t } = useT('studio');

  useEffect(() => {
    // Redirect immediately
    navigate(`/content/${schemaName}`, { replace: true });
  }, [navigate, schemaName]);

  // Show a brief loading state
  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">{t('content.redirecting')}</p>
      </div>
    </div>
  );
}
