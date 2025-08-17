import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Bars3Icon, 
  PlusIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { apiClient, ApiClientError } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { storage } from '@/utils/storage';
import { useStructureItem } from '@/hooks/useStructure';
import { useStudioContext } from '@/contexts/StudioContext';
import { ContentContext } from '@/components/context/ContentContext';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import type { Document } from '@/types';
import { DocumentEditor } from '@/components/document';

// Import view components
import { ContentViewControls, type ViewType, type ViewConfig, type FilterConfig, type SortConfig } from '@/components/content/ContentViewControls';
import { ListView, getDefaultColumns, type ListColumn } from '@/components/content/views/ListView';
import { GridView } from '@/components/content/views/GridView';
import { TableView } from '@/components/content/views/TableView';
import { Pagination } from '@/components/content/Pagination';

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
  // Declarative context sidebar configuration for content page
  const contextSidebar = useContextSidebar({
    page: 'content',
    title: 'Content Info',
    defaultVisible: false,
    defaultPosition: 'left'
  });

  useEffect(() => {
    // Set content context sidebar content
    contextSidebar.setContent(<ContentContext />);
  }, [contextSidebar]);


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
  const studioContext = useStudioContext();
  const structureItem = useStructureItem(schemaName);
  
  // State management
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
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
      
      // Use the API client's proper method
      const response = await apiClient.listDocuments(schemaName, {
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        filter: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
        sort: currentSort ? `${currentSort.direction === 'desc' ? '-' : ''}${currentSort.field}` : undefined
      });
      
      if (response.success && response.data?.documents) {
        setDocuments(response.data.documents);
        setTotalItems(response.data.pagination?.total || response.data.documents.length);
        logger.info('Documents loaded', { 
          schema: schemaName, 
          count: response.data.documents.length,
          total: response.data.pagination?.total,
          page: currentPage
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
            'Are you sure you want to delete this document? This action cannot be undone.',
            {
              title: 'Delete Document',
              confirmText: 'Delete',
              cancelText: 'Cancel',
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
            
            // Clean up the document for duplication - remove system fields and problematic references
            const duplicateData = { ...originalDoc };
            
            // Remove system fields
            delete (duplicateData as any)._id;
            delete (duplicateData as any).id;
            delete (duplicateData as any)._createdAt;
            delete (duplicateData as any)._updatedAt;
            delete duplicateData._revision;
            delete duplicateData._collection;
            delete duplicateData._status;
            
            // Remove reference fields that might cause validation issues
            delete (duplicateData as any).author;
            delete (duplicateData as any).category;
            
            // Set as draft
            duplicateData._state = 'draft';
            duplicateData.published = false;
            duplicateData.publishedAt = null;
            duplicateData.title = `${originalDoc.title || 'Document'} (Copy)`;
            duplicateData.slug = undefined;
            
            const createResponse = await apiClient.createDocument(schemaName, duplicateData);
            if (createResponse.success) {
              logger.info('Document duplicated', { schema: schemaName, originalId: documentId });
              await loadDocuments();
            }
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
  
  // Get view configurations
  const viewConfigs: ViewConfig[] = [
    { type: 'list', title: 'List View', icon: Bars3Icon, enabled: true },
    { type: 'grid', title: 'Grid View', icon: DocumentTextIcon, enabled: true },
    { type: 'table', title: 'Table View', icon: DocumentDuplicateIcon, enabled: true }
  ];
  
  const filterConfigs: FilterConfig[] = [
    {
      id: 'published',
      label: 'Status',
      field: 'published',
      type: 'select',
      options: [
        { label: 'Published', value: 'true' },
        { label: 'Draft', value: 'false' }
      ]
    }
  ];
  
  const sortConfigs: SortConfig[] = [
    { field: 'title', direction: 'asc', label: 'Title' },
    { field: '_createdAt', direction: 'desc', label: 'Created Date' },
    { field: '_updatedAt', direction: 'desc', label: 'Updated Date' }
  ];
  
  const bulkActions = [
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: DocumentDuplicateIcon
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: TrashIcon,
      variant: 'destructive' as const
    }
  ];
  
  const columns = getDefaultColumns();
  
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <h3 className="text-lg font-medium">Error loading documents</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={loadDocuments}>Try Again</Button>
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
                ? 'View existing documents' 
                : 'Manage your documents'}
            </p>
          </div>
          {/* Create button - only for regular collections, not singletons */}
          {structureItem?.item?.type !== 'singleton' && (
            <Button onClick={() => navigate(`/content/${schemaName}/new`)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create {getSchemaDisplayName(schemaName)}
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
        searchPlaceholder={`Search ${schemaName}...`}
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
            case 'delete':
              const confirmed = await studioContext?.utils?.showConfirm?.(
                `Are you sure you want to delete ${selectedItems.length} document${selectedItems.length === 1 ? '' : 's'}? This action cannot be undone.`,
                {
                  title: 'Delete Documents',
                  confirmText: 'Delete All',
                  cancelText: 'Cancel',
                  variant: 'danger'
                }
              );
              if (!confirmed) return;
              await Promise.all(selectedItems.map(id => apiClient.deleteDocument(schemaName, id)));
              setSelectedItems([]);
              await loadDocuments();
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
          <p className="text-gray-600 dark:text-gray-400">Loading singleton document...</p>
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
            <h3 className="text-lg font-medium">Document Not Found</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <Button onClick={checkSingletonDocument}>Try Again</Button>
            <Button variant="outline" onClick={onCancel}>Back to Content</Button>
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
            Content
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all your content types and documents
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading content types...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Content
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all your content types and documents
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">
              Error loading content types
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <Button onClick={loadCollections}>
            Try Again
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
            Content
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all your content types and documents
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No content types found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Content types will appear here once your backend is configured with schemas.
          </p>
          <Button onClick={loadCollections}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Content
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage all your content types and documents
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
                  View Documents
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

  useEffect(() => {
    // Redirect immediately
    navigate(`/content/${schemaName}`, { replace: true });
  }, [navigate, schemaName]);

  // Show a brief loading state
  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
