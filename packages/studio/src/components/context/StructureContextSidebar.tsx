import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStructureItem } from '@/hooks/useStructure';
import { apiClient } from '@/services/api-client';
import { useApiClient } from '@/hooks/useApiClient';
import { cn } from '@/utils/cn';

interface ContextWidget {
  type: string;
  title: string;
  [key: string]: any;
}

interface StructureContextSidebarProps {
  schemaName?: string;
}

export function StructureContextSidebar({ schemaName }: StructureContextSidebarProps) {
  const { item: structureItem, loading: structureLoading } = useStructureItem(schemaName || '');
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Get context sidebar configuration from structure
  const contextSidebar = structureItem?.contextSidebar;

  useEffect(() => {
    if (contextSidebar && schemaName) {
      loadContextData();
    }
  }, [contextSidebar, schemaName]);

  const loadContextData = async () => {
    if (!schemaName) return;

    setLoading(true);
    try {
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }

      // Load basic stats for the schema
      const statsResponse = await apiClient.getCollectionStats(schemaName);
      if (statsResponse.success) {
        setData((prev: any) => ({ ...prev, stats: statsResponse.data }));
      }

      // Load documents for additional context
      const docsResponse = await apiClient.listDocuments(schemaName, { limit: 10 });
      if (docsResponse.success) {
        const documents = docsResponse.data?.documents || [];
        
        // Resolve author references in documents
        const documentsWithResolvedAuthors = await Promise.all(
          documents.map(async (doc: any) => {
            if (doc.author && typeof doc.author === 'string') {
              try {
                const authorResponse = await apiClient.getDocument('author', doc.author);
                if (authorResponse.success && authorResponse.data?.document) {
                  return {
                    ...doc,
                    author: {
                      id: doc.author,
                      name: authorResponse.data.document.name || authorResponse.data.document.title,
                      email: authorResponse.data.document.email
                    }
                  };
                }
              } catch (error) {
                console.warn('Failed to resolve author for document:', doc.id, error);
              }
            }
            return doc;
          })
        );
        
        setData((prev: any) => ({ ...prev, documents: documentsWithResolvedAuthors }));
      }

    } catch (error) {
      console.warn('Failed to load context data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while structure is loading
  if (structureLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Fall back to default context if no contextSidebar configuration
  if (!contextSidebar) {
    return <DefaultSchemaContext schemaName={schemaName} />;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
        {contextSidebar.title}
      </h3>

      {contextSidebar.widgets?.map((widget: ContextWidget, index: number) => (
        <ContextWidget key={index} widget={widget} data={data} loading={loading} />
      ))}
    </div>
  );
}

interface ContextWidgetProps {
  widget: ContextWidget;
  data: any;
  loading: boolean;
}

function ContextWidget({ widget, data, loading }: ContextWidgetProps) {
  switch (widget.type) {
    case 'quickFilters':
      return <QuickFiltersWidget widget={widget} />;
    
    case 'contentStats':
      return <ContentStatsWidget widget={widget} data={data} loading={loading} />;
    
    case 'categoryBreakdown':
      return <CategoryBreakdownWidget widget={widget} data={data} loading={loading} />;
    
    case 'recentlyEdited':
      return <RecentlyEditedWidget widget={widget} data={data} loading={loading} />;
    
    case 'publishingStats':
      return <PublishingStatsWidget widget={widget} data={data} loading={loading} />;
    
    case 'topPerforming':
      return <TopPerformingWidget widget={widget} data={data} loading={loading} />;
    
    case 'draftProgress':
      return <DraftProgressWidget widget={widget} data={data} loading={loading} />;
    
    case 'authorStats':
      return <AuthorStatsWidget widget={widget} data={data} loading={loading} />;
    
    case 'quickStats':
      return <QuickStatsWidget widget={widget} data={data} loading={loading} />;
    
    case 'recentActivity':
      return <RecentActivityWidget widget={widget} data={data} loading={loading} />;

    case 'topAuthors':
      return <TopAuthorsWidget widget={widget} data={data} loading={loading} />;

    case 'quickActions':
      return <QuickActionsWidget widget={widget} />;

    case 'recentDocuments':
      return <RecentDocumentsWidget widget={widget} data={data} loading={loading} />;

    default:
      return <UnknownWidget widget={widget} />;
  }
}

// Quick Filters Widget
function QuickFiltersWidget({ widget }: { widget: ContextWidget }) {
  const handleFilterClick = (filter: any) => {
    // TODO: Implement filter application
    console.log('Apply filter:', filter);
  };

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-2">
        {widget.filters?.map((filter: any, index: number) => (
          <button
            key={index}
            onClick={() => handleFilterClick(filter)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-colors text-sm",
              "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
              "hover:bg-gray-50 dark:hover:bg-gray-750"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-white">{filter.label}</span>
              <div className={cn(
                "w-2 h-2 rounded-full",
                `bg-${filter.color || 'gray'}-500`
              )} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Content Stats Widget
function ContentStatsWidget({ widget, loading }: ContextWidgetProps) {
  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {widget.title}
        </h4>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-2">
        {widget.stats?.map((stat: any, index: number) => (
          <div
            key={index}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {stat.label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {/* Calculate based on data */}
              {stat.aggregate === 'sum' ? 'Calculating...' : 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Category Breakdown Widget
function CategoryBreakdownWidget({ widget, data, loading }: ContextWidgetProps) {
  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {widget.title}
        </h4>
        <div className="space-y-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const categories = data.documents?.reduce((acc: any, doc: any) => {
    const category = doc.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {}) || {};

  const total = Object.values(categories).reduce((sum: number, count: any) => sum + count, 0);

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-1">
        {Object.entries(categories).slice(0, widget.limit || 5).map(([category, count]: [string, any]) => (
          <div key={category} className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400 truncate">{category}</span>
            <div className="flex items-center space-x-2">
              <span className="text-gray-900 dark:text-white font-medium">{count}</span>
              {widget.showPercentages && total > 0 && (
                <span className="text-xs text-gray-500">
                  ({Math.round((count / total) * 100)}%)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Recently Edited Widget
function RecentlyEditedWidget({ widget, data, loading }: ContextWidgetProps) {
  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {widget.title}
        </h4>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const recentDocs = data.documents
    ?.sort((a: any, b: any) => new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime())
    ?.slice(0, widget.limit || 5) || [];

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-2">
        {recentDocs.map((doc: any, index: number) => (
          <div
            key={index}
            className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
          >
            <div className="text-sm text-gray-900 dark:text-white truncate">
              {doc.title || 'Untitled'}
            </div>
            {widget.showAuthor && doc.author && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                by {typeof doc.author === 'object' && doc.author.name ? doc.author.name : 'Author'}
              </div>
            )}
            {widget.showTime && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(doc._updatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Publishing Stats Widget - simplified for now
function PublishingStatsWidget({ widget, data, loading }: ContextWidgetProps) {
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="grid grid-cols-1 gap-2">
        {widget.stats?.map((stat: any, index: number) => (
          <div
            key={index}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {loading ? '...' : data.stats?.published || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Other widget types with simplified implementations
function TopPerformingWidget({ widget, data, loading }: ContextWidgetProps) {
  return <ContentStatsWidget widget={widget} data={data} loading={loading} />;
}

function DraftProgressWidget({ widget, data, loading }: ContextWidgetProps) {
  return <ContentStatsWidget widget={widget} data={data} loading={loading} />;
}

function AuthorStatsWidget({ widget, data, loading }: ContextWidgetProps) {
  return <ContentStatsWidget widget={widget} data={data} loading={loading} />;
}

function QuickStatsWidget({ widget, loading }: ContextWidgetProps) {
  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {widget.title}
        </h4>
        <div className="grid grid-cols-1 gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="grid grid-cols-1 gap-2">
        {widget.stats?.map((stat: any, index: number) => (
          <div
            key={index}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className={cn(
              "text-sm font-medium",
              `text-${stat.color || 'gray'}-600 dark:text-${stat.color || 'gray'}-400`
            )}>
              {stat.label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {stat.value || 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentActivityWidget({ widget, data, loading }: ContextWidgetProps) {
  return <RecentlyEditedWidget widget={widget} data={data} loading={loading} />;
}

function TopAuthorsWidget({ widget, data, loading }: ContextWidgetProps) {
  return <RecentlyEditedWidget widget={widget} data={data} loading={loading} />;
}

function QuickActionsWidget({ widget }: { widget: ContextWidget }) {
  const handleAction = (action: any) => {
    console.log('Action:', action);
    // TODO: Implement actions
  };

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-2">
        {widget.actions?.map((action: any, index: number) => (
          <button
            key={index}
            onClick={() => handleAction(action)}
            className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
          >
            <div className="flex items-center space-x-2">
              {action.icon && (
                <div className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-gray-900 dark:text-white">{action.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Recent Documents Widget
function RecentDocumentsWidget({ widget, data, loading }: ContextWidgetProps) {
  const navigate = useNavigate();
  const client = useApiClient();

  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {widget.title}
        </h4>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const recentDocs = data.documents
    ?.sort((a: any, b: any) => new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime())
    ?.slice(0, widget.limit || 5) || [];

  const handleEditClick = (doc: any) => {
    console.log('Clicking on document:', doc, 'schemaType:', widget.schemaType);
    if (widget.schemaType && doc.id) {
      const path = `/content/${widget.schemaType}/${doc.id}`;
      console.log('Navigating to:', path);
      navigate(path);
    } else {
      console.warn('Missing schemaType or doc.id:', { schemaType: widget.schemaType, docId: doc.id });
    }
  };

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
        {widget.title}
      </h4>
      <div className="space-y-2">
        {recentDocs.map((doc: any, index: number) => (
          <div
            key={index}
            className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleEditClick(doc);
            }}
          >
            <div className="flex items-center space-x-3">
              {/* Thumbnail */}
              {doc.featuredImage && (() => {
                const imageRef = doc.featuredImage.asset?._ref || doc.featuredImage._ref;
                const imageUrl = client.getMediaUrl(imageRef, 'thumbnail');
                return (
                <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    src={imageUrl}
                    alt={doc.featuredImage.alt || doc.title || 'Article thumbnail'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder on error
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement!.innerHTML = '<div class="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center"><svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>';
                    }}
                  />
                </div>
                );
              })()}
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 dark:text-white truncate font-medium">
                  {doc.title || 'Untitled'}
                </div>
                {widget.showAuthor && doc.author && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    by {typeof doc.author === 'object' && doc.author.name ? doc.author.name : 'Author'}
                  </div>
                )}
                {widget.showTime && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(doc._updatedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {recentDocs.length === 0 && !loading && (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            No recent documents
          </div>
        )}
      </div>
    </div>
  );
}

function UnknownWidget({ widget }: { widget: ContextWidget }) {
  return (
    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
      <div className="text-sm text-yellow-800 dark:text-yellow-200">
        Unknown widget type: {widget.type}
      </div>
    </div>
  );
}

// Fallback to default schema context
function DefaultSchemaContext({ schemaName }: { schemaName?: string }) {
  const { item: structureItem } = useStructureItem(schemaName || '');
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    if (schemaName) {
      loadSchemaStats();
    }
  }, [schemaName]);
  
  const loadSchemaStats = async () => {
    if (!schemaName) return;
    
    try {
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      const response = await apiClient.getCollectionStats(schemaName);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      // Stats are optional, don't show error
    }
  };
  
  return (
    <>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {structureItem?.title || schemaName}
      </h3>
      
      {/* Schema stats */}
      {stats && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {stats.total || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {stats.published || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Published
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}