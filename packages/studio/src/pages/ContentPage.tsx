import { useParams } from 'react-router-dom';
import { DocumentTextIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

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

function ContentOverview() {
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
        <Button>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Schema
        </Button>
      </div>
    </div>
  );
}

function SchemaDocuments({ schemaName }: { schemaName?: string }) {
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
        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No documents found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Documents for {schemaName} will appear here.
        </p>
        <Button>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Document
        </Button>
      </div>
    </div>
  );
}

function DocumentEditor({ schemaName, documentId }: { schemaName?: string; documentId?: string }) {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edit Document
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Editing {documentId} in {schemaName}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Document editor will be implemented here.
        </p>
      </div>
    </div>
  );
}