import { useState, useEffect, useMemo } from 'react';
import { useApiClient } from './useApiClient';
import { createStudioLogger } from '@/utils/logger';
import type { Permission } from '@/types';

const logger = createStudioLogger('useDynamicPermissions');

interface PermissionItem {
  value: Permission;
  label: string;
  group: string;
}

interface SchemaItem {
  type: 'singleton' | 'documentList';
  title: string;
  schemaType: string;
}

/**
 * Hook to generate dynamic schema permissions from API structure
 */
export function useDynamicPermissions() {
  const client = useApiClient();
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch schemas from structure endpoint
  useEffect(() => {
    async function fetchSchemas() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await client.get('/config/structure');
        
        if (response.success && response.data?.structure?.items) {
          const items = response.data.structure.items;
          
          // Extract schema items (documentList and singleton types)
          const schemaItems: SchemaItem[] = items
            .filter((item: any) => 
              (item.type === 'documentList' || item.type === 'singleton') && 
              item.schemaType
            )
            .map((item: any) => ({
              type: item.type,
              title: item.title,
              schemaType: item.schemaType
            }));
          
          setSchemas(schemaItems);
          logger.debug('Loaded schemas for dynamic permissions', {
            count: schemaItems.length,
            schemas: schemaItems.map(s => s.schemaType)
          });
        } else {
          logger.warn('No structure data found in API response');
          setSchemas([]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load schemas';
        setError(message);
        logger.error('Failed to fetch schemas for permissions', err);
        setSchemas([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSchemas();
  }, [client]);

  // Generate dynamic permissions from schemas
  const dynamicPermissions = useMemo((): PermissionItem[] => {
    const permissions: PermissionItem[] = [];
    
    schemas.forEach(schema => {
      const { schemaType, title, type } = schema;
      const groupName = `${title} (Content)`;
      
      // All schemas get read and write permissions
      permissions.push(
        {
          value: `${schemaType}:read` as Permission,
          label: `View ${title}`,
          group: groupName
        },
        {
          value: `${schemaType}:write` as Permission,
          label: `Edit ${title}`,
          group: groupName
        }
      );
      
      // Only documentList (collections) get delete permissions
      // Singletons shouldn't be deletable
      if (type === 'documentList') {
        permissions.push({
          value: `${schemaType}:delete` as Permission,
          label: `Delete ${title}`,
          group: groupName
        });
      }
    });
    
    return permissions;
  }, [schemas]);

  return {
    dynamicPermissions,
    schemas,
    loading,
    error,
    isReady: !loading && !error
  };
}