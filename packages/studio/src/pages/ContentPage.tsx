import { useParams, useNavigate } from 'react-router-dom';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useState, useEffect } from 'react';
import { apiClient, ApiClientError } from '@/services/api-client';
import type { Document } from '@/types';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('ContentPage');

export function ContentPage() {
  const { schemaName, documentId } = useParams();

  if (documentId) {
    return <DocumentEditor schemaName={schemaName} documentId={documentId} />;
  }

  if (schemaName) {
    return <SchemaDocuments schemaName={schemaName} />;
  }

  return <ContentOverview />;
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

function DocumentEditor({ schemaName, documentId }: { schemaName?: string; documentId?: string }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNewDocument = documentId === 'new';

  useEffect(() => {
    if (schemaName) {
      if (isNewDocument) {
        // Initialize empty form for new document
        setFormData({});
      } else if (documentId) {
        loadDocument();
      }
    }
  }, [schemaName, documentId]);

  const loadDocument = async () => {
    if (!schemaName || !documentId || isNewDocument) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      const response = await apiClient.getDocument(schemaName, documentId);
      
      if (response.success && response.data) {
        const doc = response.data;
        setFormData({ ...doc });
        logger.info('Document loaded', { schema: schemaName, id: documentId });
      } else {
        setError('Document not found');
      }
    } catch (err) {
      logger.error('Failed to load document', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!schemaName) return;
    
    try {
      setSaving(true);
      setError(null);
      
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      let response;
      if (isNewDocument) {
        // Create new document
        response = await apiClient.createDocument(schemaName, formData);
      } else {
        // Update existing document
        response = await apiClient.updateDocument(schemaName, documentId!, formData);
      }
      
      if (response.success && response.data) {
        const savedDoc = response.data;
        setFormData({ ...savedDoc });
        logger.info('Document saved', { schema: schemaName, id: savedDoc.id || savedDoc._id });
        
        // Redirect to edit mode if it was a new document
        if (isNewDocument) {
          navigate(`/content/${schemaName}/${savedDoc.id || savedDoc._id}`);
        }
      }
    } catch (err) {
      logger.error('Failed to save document', err);
      setError(err instanceof ApiClientError ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const renderField = (fieldName: string, fieldConfig: any) => {
    const value = formData[fieldName] || '';
    
    switch (fieldConfig.type) {
      case 'string':
        if (fieldName === 'content' || fieldConfig.maxLength > 200) {
          return (
            <textarea
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-vertical min-h-[120px]"
              placeholder={fieldConfig.description || `Enter ${fieldConfig.title || fieldName}`}
              maxLength={fieldConfig.maxLength}
            />
          );
        }
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={fieldConfig.description || `Enter ${fieldConfig.title || fieldName}`}
            maxLength={fieldConfig.maxLength}
          />
        );
      
      case 'boolean':
        return (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {fieldConfig.description || `Enable ${fieldConfig.title || fieldName}`}
            </span>
          </label>
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={value ? new Date(value).toISOString().split('T')[0] : ''}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        );
      
      case 'array':
        const arrayValue = Array.isArray(value) ? value : [];
        return (
          <div>
            {arrayValue.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newArray = [...arrayValue];
                    newArray[index] = e.target.value;
                    handleFieldChange(fieldName, newArray);
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={`${fieldConfig.title || fieldName} ${index + 1}`}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newArray = arrayValue.filter((_, i) => i !== index);
                    handleFieldChange(fieldName, newArray);
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                handleFieldChange(fieldName, [...arrayValue, '']);
              }}
            >
              Add {fieldConfig.title || fieldName}
            </Button>
          </div>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder={fieldConfig.description || `Enter ${fieldConfig.title || fieldName}`}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="text-red-500 mb-4">
            <h3 className="text-lg font-medium">Error</h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={() => navigate(`/content/${schemaName}`)}>
            Back to Documents
          </Button>
        </div>
      </div>
    );
  }

  // Simple schema fields for demo - in a real implementation, you'd fetch schema details
  const getSchemaFields = () => {
    switch (schemaName) {
      case 'post':
        return {
          title: { title: 'Title', type: 'string', required: true, maxLength: 100 },
          slug: { title: 'Slug', type: 'string', required: true, description: 'URL-friendly version of title' },
          excerpt: { title: 'Excerpt', type: 'string', maxLength: 300, description: 'Short description for previews' },
          content: { title: 'Content', type: 'string', required: true, description: 'Main blog post content' },
          publishedAt: { title: 'Published Date', type: 'date' },
          tags: { title: 'Tags', type: 'array', of: { type: 'string' } },
          published: { title: 'Published', type: 'boolean', defaultValue: false, description: 'Make this post visible to readers' },
          featured: { title: 'Featured', type: 'boolean', defaultValue: false, description: 'Highlight this post on homepage' }
        };
      case 'author':
        return {
          name: { title: 'Name', type: 'string', required: true, maxLength: 50 },
          slug: { title: 'Slug', type: 'string', required: true, description: 'URL-friendly version of name' },
          email: { title: 'Email', type: 'string', required: true, description: 'Author email address' },
          bio: { title: 'Bio', type: 'string', maxLength: 500, description: 'Short biography' },
          website: { title: 'Website', type: 'string', description: 'Personal or professional website URL' }
        };
      case 'settings':
        return {
          siteTitle: { title: 'Site Title', type: 'string', required: true, maxLength: 60, defaultValue: 'My Blog' },
          siteDescription: { title: 'Site Description', type: 'string', required: true, maxLength: 160, description: 'SEO description for the site' }
        };
      default:
        return {};
    }
  };

  const schemaFields = getSchemaFields();

  return (
    <div className="p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isNewDocument ? `Create ${schemaName}` : `Edit ${schemaName}`}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {isNewDocument ? `Create a new ${schemaName} document` : `Editing ${documentId} in ${schemaName}`}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline"
            onClick={() => navigate(`/content/${schemaName}`)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            loading={saving}
          >
            {isNewDocument ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-6">
          {Object.entries(schemaFields).map(([fieldName, fieldConfig]) => (
            <div key={fieldName}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {fieldConfig.title || fieldName}
                {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {renderField(fieldName, fieldConfig)}
              {fieldConfig.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {fieldConfig.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}