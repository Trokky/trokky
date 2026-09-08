import { useCallback, useMemo } from 'react';
import type { ArrayOperations } from './definition.js';
import { getDefaultItemValue } from './defaultItemValue.js';

interface UseArrayOperationsOptions {
  arrayValue: any[];
  insertAppend: boolean;
  onChange: (value: any) => void;
  arrayDefinition: any;
}

/**
 * The add, remove, move, update, clear and toggle an array field performs on
 * its value. Every one of them rebuilds the array and hands it to onChange;
 * items are carried through untouched, so their `_key` survives a reorder.
 */
export function useArrayOperations({
  arrayValue,
  insertAppend,
  onChange,
  arrayDefinition,
}: UseArrayOperationsOptions) {
  // Array operations
  const operations: ArrayOperations = useMemo(() => ({
    add: (item: any, index?: number) => {
      const newArray = [...arrayValue];
      const targetIndex = index !== undefined ? index : (insertAppend ? newArray.length : 0);
      newArray.splice(targetIndex, 0, item);
      onChange(newArray);
    },

    remove: (index: number) => {
      const newArray = arrayValue.filter((_, i) => i !== index);
      // Filter out any null/undefined values that might have been left behind
      const sanitizedArray = newArray.filter(item => item !== null && item !== undefined);
      onChange(sanitizedArray);
    },

    move: (fromIndex: number, toIndex: number) => {
      const newArray = [...arrayValue];
      const [moved] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, moved);
      onChange(newArray);
    },

    update: (index: number, item: any) => {
      if (index >= 0 && index < arrayValue.length) {
        const newArray = [...arrayValue];
        newArray[index] = item;
        onChange(newArray);
      }
    },

    clear: () => {
      onChange([]);
    },

    toggle: (item: any) => {
      // For compatibility with ArrayOperations interface
      const exists = arrayValue.includes(item);
      if (exists) {
        const newArray = arrayValue.filter(v => v !== item);
        onChange(newArray);
      } else {
        const newArray = [...arrayValue];
        const targetIndex = insertAppend ? newArray.length : 0;
        newArray.splice(targetIndex, 0, item);
        onChange(newArray);
      }
    }
  }), [arrayValue, insertAppend, onChange]);

  // Handle add new item
  const handleAddItem = useCallback(() => {
    // Access the 'of' property from the raw definition since it's not in the TypeScript interface
    const itemDef = (arrayDefinition as any).of || { type: 'string' };
    const defaultValue = getDefaultItemValue(itemDef);

    // Add the item (this will trigger onChange and re-render)
    operations.add(defaultValue);
  }, [operations, arrayDefinition]);

  return { operations, handleAddItem };
}
