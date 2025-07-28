import { useParams, useNavigate } from 'react-router-dom';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useState, useEffect } from 'react';
import { apiClient, ApiClientError } from '@/services/api-client';
import type { Document } from '@/types';
import { createStudioLogger } from '@/utils/logger';
import { EnhancedContentPage } from '@/components/content/EnhancedContentPage';
import { DocumentEditor } from '@/components/document';
import { useStructureItem } from '@/hooks/useStructure';

const logger = createStudioLogger('ContentPage');

export function ContentPage() {
  const { schemaName, documentId } = useParams();
  const navigate = useNavigate();
  const structureItem = useStructureItem(schemaName || '');

  // Handle document editing
  if (documentId) {
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
      
      // For singletons, redirect directly to edit the document
      // The DocumentEditor will handle auto-creation if the document doesn't exist
      return (
        <SingletonHandler
          schemaName={schemaName}
          documentId={singletonDocumentId}
          autoCreate={singleton.options?.autoCreate}
          onCancel={() => navigate('/content')}
        />
      );
    }

    // Regular collection view
    return <EnhancedContentPage schemaName={schemaName} key={schemaName} />;
  }

  return <ContentOverview />;
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
  const [documentExists, setDocumentExists] = useState(false);
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

      // Check if the singleton document exists
      const response = await apiClient.getDocument(schemaName, documentId);
      
      if (response.success && response.data) {
        // Document exists, redirect to edit it
        setDocumentExists(true);
        navigate(`/content/${schemaName}/${documentId}`, { replace: true });
      } else {
        // Document doesn't exist
        if (autoCreate) {
          // Auto-create the singleton document
          await createSingletonDocument();
        } else {
          setError(`Singleton document '${documentId}' not found and auto-creation is disabled.`);
        }
      }
    } catch (err) {
      logger.error('Failed to check singleton document', err);
      
      if (autoCreate && err instanceof ApiClientError && err.status === 404) {
        // Document not found, try to auto-create
        await createSingletonDocument();
      } else {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load singleton document');
      }
    } finally {
      setLoading(false);
    }
  };

  const createSingletonDocument = async () => {
    try {
      logger.info('Auto-creating singleton document', { schemaName, documentId });
      
      // Create basic singleton document
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
          <div className="text-red-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">Singleton Error</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <div className="flex justify-center space-x-4">
            <Button onClick={checkSingletonDocument}>Try Again</Button>
            <Button variant="outline" onClick={onCancel}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

  // This shouldn't be reached, but just in case
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
                  variant="outline"
                  onClick={() => navigate(`/content/${collection.name}`)}
                >
                  View Documents
                </Button>
                <Button 
                  size="sm"
                  onClick={() => navigate(`/content/${collection.name}/new`)}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SchemaDocuments({ schemaName }: { schemaName?: string }) {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (schemaName) {
      loadDocuments();
    }
  }, [schemaName]);

  const loadDocuments = async () => {
    if (!schemaName) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      // Use the collections endpoint that matches our demo backend
      const response = await apiClient.getDocuments(schemaName);
      
      if (response.success && response.data?.documents) {
        setDocuments(response.data.documents);
        logger.info('Documents loaded', { schema: schemaName, count: response.data.documents.length });
      } else {
        setDocuments([]);
      }
    } catch (err) {
      logger.error('Failed to load documents', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!schemaName || !confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await apiClient.deleteDocument(schemaName, documentId);
      logger.info('Document deleted', { schema: schemaName, id: documentId });
      await loadDocuments(); // Reload the list
    } catch (err) {
      logger.error('Failed to delete document', err);
      alert('Failed to delete document: ' + (err instanceof ApiClientError ? err.message : 'Unknown error'));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString();
  };

  const getDocumentTitle = (doc: Document) => {
    return doc.title || doc.name || doc.slug || doc.id || doc._id;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {schemaName} Documents
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage documents for the {schemaName} content type
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {schemaName} Documents
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage documents for the {schemaName} content type
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <DocumentTextIcon className="h-12 w-12 mx-auto mb-2" />
            <h3 className="text-lg font-medium">
              Error loading documents
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <Button onClick={loadDocuments}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {schemaName} Documents
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage documents for the {schemaName} content type ({documents.length} items)
          </p>
        </div>
        <Button onClick={() => navigate(`/content/${schemaName}/new`)}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No documents found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Documents for {schemaName} will appear here.
          </p>
          <Button onClick={() => navigate(`/content/${schemaName}/new`)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Create First Document
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {documents.map((doc) => (
                  <tr key={doc.id || doc._id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {getDocumentTitle(doc)}
                      </div>
                      {doc.slug && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          /{doc.slug}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        doc.published || doc._status === 'published'
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100'
                      }`}>
                        {doc.published || doc._status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(doc._createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(doc._updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/content/${schemaName}/${doc.id || doc._id}`)}
                        >
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeleteDocument(doc.id || doc._id)}
                          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

