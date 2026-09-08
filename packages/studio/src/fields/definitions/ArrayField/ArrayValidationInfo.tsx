import { useT } from '@trokky/trokky/i18n';

interface ArrayValidationInfoProps {
  validation: { minItems?: number; maxItems?: number } | undefined;
}

/**
 * The min/max item hint under the list. Renders nothing when the schema sets
 * no bounds.
 */
export function ArrayValidationInfo({ validation }: ArrayValidationInfoProps) {
  const { t } = useT('fields');

  if (!validation) {
    return null;
  }

  return (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {validation.minItems && validation.maxItems && (
              <span>
                {t('types.array.range', { min: validation.minItems, max: validation.maxItems })}
              </span>
            )}
            {validation.minItems && !validation.maxItems && (
              <span>
                {t('types.array.minimum', { count: validation.minItems })}
              </span>
            )}
            {!validation.minItems && validation.maxItems && (
              <span>
                {t('types.array.maximum', { count: validation.maxItems })}
              </span>
            )}
          </div>
  );
}
