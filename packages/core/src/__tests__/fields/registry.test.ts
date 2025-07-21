/**
 * Comprehensive tests for field type registry
 */

import {
  FieldTypeRegistry,
  FieldTypeRegistrationError
} from '../../fields/registry.js';
import {
  FieldType,
  FieldCategory,
  FieldContext,
  ValidationResult
} from '../../fields/field-type.js';

describe('FieldTypeRegistrationError', () => {
  it('should create error with message', () => {
    const error = new FieldTypeRegistrationError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('FieldTypeRegistrationError');
    expect(error.fieldType).toBeUndefined();
  });

  it('should create error with field type', () => {
    const error = new FieldTypeRegistrationError('Test error', 'string');
    expect(error.message).toBe('Test error');
    expect(error.fieldType).toBe('string');
  });

  it('should be instance of Error', () => {
    const error = new FieldTypeRegistrationError('Test error');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('FieldTypeRegistry', () => {
  // Mock field types for testing
  class StringFieldType implements FieldType {
    name = 'string';
    category = FieldCategory.TEXT;
    description = 'String field type';
    icon = 'text-icon';

    validate(value: any, config: any, context: FieldContext): ValidationResult {
      return { valid: true, errors: [] };
    }

    serialize(value: any, config: any) {
      return String(value || '');
    }

    deserialize(data: any, config: any) {
      return String(data || '');
    }
  }

  class NumberFieldType implements FieldType {
    name = 'number';
    category = FieldCategory.NUMBER;
    description = 'Number field type';

    validate(value: any, config: any, context: FieldContext): ValidationResult {
      return { valid: !isNaN(Number(value)), errors: [] };
    }

    serialize(value: any, config: any) {
      return Number(value) || 0;
    }

    deserialize(data: any, config: any) {
      return Number(data) || 0;
    }
  }

  class CustomFieldType implements FieldType {
    name = 'custom';
    // No category - should default to CUSTOM

    validate(value: any, config: any, context: FieldContext): ValidationResult {
      return { valid: true, errors: [] };
    }

    serialize(value: any, config: any) {
      return value;
    }

    deserialize(data: any, config: any) {
      return data;
    }
  }

  beforeEach(() => {
    // Clear registry before each test
    FieldTypeRegistry.clear();
  });

  afterEach(() => {
    // Clean up after each test
    FieldTypeRegistry.clear();
  });

  describe('Registration', () => {
    it('should register a field type successfully', () => {
      const fieldType = new StringFieldType();
      
      expect(() => {
        FieldTypeRegistry.register(fieldType);
      }).not.toThrow();

      expect(FieldTypeRegistry.exists('string')).toBe(true);
      expect(FieldTypeRegistry.get('string')).toBe(fieldType);
    });

    it('should register field type with custom category', () => {
      const fieldType = new NumberFieldType();
      FieldTypeRegistry.register(fieldType);

      const categories = FieldTypeRegistry.getByCategory(FieldCategory.NUMBER);
      expect(categories).toContain(fieldType);
    });

    it('should default to CUSTOM category if none specified', () => {
      const fieldType = new CustomFieldType();
      FieldTypeRegistry.register(fieldType);

      const categories = FieldTypeRegistry.getByCategory(FieldCategory.CUSTOM);
      expect(categories).toContain(fieldType);
    });

    it('should throw error when registering duplicate field type', () => {
      const fieldType1 = new StringFieldType();
      const fieldType2 = new StringFieldType();

      FieldTypeRegistry.register(fieldType1);

      expect(() => {
        FieldTypeRegistry.register(fieldType2);
      }).toThrow(FieldTypeRegistrationError);
      
      expect(() => {
        FieldTypeRegistry.register(fieldType2);
      }).toThrow("Field type 'string' is already registered. Use override option to replace.");
    });

    it('should allow override of existing field type', () => {
      const fieldType1 = new StringFieldType();
      const fieldType2 = new StringFieldType();

      FieldTypeRegistry.register(fieldType1);
      
      expect(() => {
        FieldTypeRegistry.register(fieldType2, { override: true });
      }).not.toThrow();

      expect(FieldTypeRegistry.get('string')).toBe(fieldType2);
    });

    it('should register migrations with field type', () => {
      const fieldType = new StringFieldType();
      const migrations = [
        { from: '1.0', to: '2.0', transform: (value: any) => value }
      ];

      FieldTypeRegistry.register(fieldType, { migrations });

      const metadata = FieldTypeRegistry.getMetadata('string');
      expect(metadata?.migrations).toEqual(migrations);
    });

    it('should store complete metadata', () => {
      const fieldType = new StringFieldType();
      FieldTypeRegistry.register(fieldType);

      const metadata = FieldTypeRegistry.getMetadata('string');
      expect(metadata).toEqual({
        name: 'string',
        category: FieldCategory.TEXT,
        description: 'String field type',
        icon: 'text-icon',
        version: '1.0.0',
        migrations: []
      });
    });
  });

  describe('Validation', () => {
    it('should validate field type has name', () => {
      const invalidFieldType = {
        validate: () => ({ valid: true, errors: [] }),
        serialize: (value: any) => value,
        deserialize: (data: any) => data
      } as FieldType;

      expect(() => {
        FieldTypeRegistry.register(invalidFieldType);
      }).toThrow('Field type must have a name');
    });

    it('should validate field type name is string', () => {
      const invalidFieldType = {
        name: 123,
        validate: () => ({ valid: true, errors: [] }),
        serialize: (value: any) => value,
        deserialize: (data: any) => data
      } as any;

      expect(() => {
        FieldTypeRegistry.register(invalidFieldType);
      }).toThrow('Field type name must be a non-empty string');
    });

    it('should validate field type name is not empty', () => {
      const invalidFieldType = {
        name: '   ',
        validate: () => ({ valid: true, errors: [] }),
        serialize: (value: any) => value,
        deserialize: (data: any) => data
      } as FieldType;

      expect(() => {
        FieldTypeRegistry.register(invalidFieldType);
      }).toThrow('Field type name must be a non-empty string');
    });

    it('should validate field type name format', () => {
      const invalidFieldType = {
        name: '123-invalid',
        validate: () => ({ valid: true, errors: [] }),
        serialize: (value: any) => value,
        deserialize: (data: any) => data
      } as FieldType;

      expect(() => {
        FieldTypeRegistry.register(invalidFieldType);
      }).toThrow('Field type name must start with a letter and contain only letters, numbers, and underscores');
    });

    it('should validate field type has required methods', () => {
      const invalidFieldType = {
        name: 'invalid'
        // Missing required methods
      } as FieldType;

      expect(() => {
        FieldTypeRegistry.register(invalidFieldType);
      }).toThrow('Field type must have a validate function');
    });

    it('should validate all required methods exist', () => {
      expect(() => {
        FieldTypeRegistry.register({
          name: 'test',
          validate: undefined as any,
          serialize: () => {},
          deserialize: () => {}
        });
      }).toThrow('Field type must have a validate function');

      expect(() => {
        FieldTypeRegistry.register({
          name: 'test',
          validate: () => ({ valid: true, errors: [] }),
          serialize: undefined as any,
          deserialize: () => {}
        });
      }).toThrow('Field type must have a serialize function');

      expect(() => {
        FieldTypeRegistry.register({
          name: 'test',
          validate: () => ({ valid: true, errors: [] }),
          serialize: () => {},
          deserialize: undefined as any
        });
      }).toThrow('Field type must have a deserialize function');
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());
    });

    it('should get field type by name', () => {
      const fieldType = FieldTypeRegistry.get('string');
      expect(fieldType).toBeInstanceOf(StringFieldType);
      expect(fieldType?.name).toBe('string');
    });

    it('should return undefined for non-existent field type', () => {
      const fieldType = FieldTypeRegistry.get('nonexistent');
      expect(fieldType).toBeUndefined();
    });

    it('should get all registered field types', () => {
      const allTypes = FieldTypeRegistry.getAll();
      expect(allTypes).toHaveLength(2);
      expect(allTypes.map(t => t.name)).toContain('string');
      expect(allTypes.map(t => t.name)).toContain('number');
    });

    it('should get field types by category', () => {
      const textTypes = FieldTypeRegistry.getByCategory(FieldCategory.TEXT);
      const numberTypes = FieldTypeRegistry.getByCategory(FieldCategory.NUMBER);
      const mediaTypes = FieldTypeRegistry.getByCategory(FieldCategory.MEDIA);

      expect(textTypes).toHaveLength(1);
      expect(textTypes[0].name).toBe('string');
      expect(numberTypes).toHaveLength(1);
      expect(numberTypes[0].name).toBe('number');
      expect(mediaTypes).toHaveLength(0);
    });

    it('should check if field type exists', () => {
      expect(FieldTypeRegistry.exists('string')).toBe(true);
      expect(FieldTypeRegistry.exists('number')).toBe(true);
      expect(FieldTypeRegistry.exists('nonexistent')).toBe(false);
    });

    it('should get all categories', () => {
      const categories = FieldTypeRegistry.getCategories();
      expect(categories).toContain(FieldCategory.TEXT);
      expect(categories).toContain(FieldCategory.NUMBER);
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());
    });

    it('should search by field type name', () => {
      const results = FieldTypeRegistry.search('string');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('string');
    });

    it('should search by description', () => {
      const results = FieldTypeRegistry.search('String field');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('string');
    });

    it('should search by category', () => {
      const results = FieldTypeRegistry.search('text');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('string');
    });

    it('should be case insensitive', () => {
      const results = FieldTypeRegistry.search('STRING');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('string');
    });

    it('should return partial matches', () => {
      const results = FieldTypeRegistry.search('str');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('string');
    });

    it('should return empty array for no matches', () => {
      const results = FieldTypeRegistry.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Unregistration', () => {
    beforeEach(() => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());
    });

    it('should unregister field type successfully', () => {
      const result = FieldTypeRegistry.unregister('string');
      expect(result).toBe(true);
      expect(FieldTypeRegistry.exists('string')).toBe(false);
    });

    it('should return false when unregistering non-existent field type', () => {
      const result = FieldTypeRegistry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove field type from categories', () => {
      FieldTypeRegistry.unregister('string');
      const textTypes = FieldTypeRegistry.getByCategory(FieldCategory.TEXT);
      expect(textTypes).toHaveLength(0);
    });

    it('should remove metadata', () => {
      FieldTypeRegistry.unregister('string');
      const metadata = FieldTypeRegistry.getMetadata('string');
      expect(metadata).toBeUndefined();
    });

    it('should remove empty categories', () => {
      FieldTypeRegistry.unregister('string');
      const categories = FieldTypeRegistry.getCategories();
      expect(categories).not.toContain(FieldCategory.TEXT);
    });
  });

  describe('Category Management', () => {
    it('should handle override with category change', () => {
      const fieldType1 = new StringFieldType();
      const fieldType2 = new class extends StringFieldType {
        category = FieldCategory.SPECIALIZED;
      };

      FieldTypeRegistry.register(fieldType1);
      FieldTypeRegistry.register(fieldType2, { override: true });

      const textTypes = FieldTypeRegistry.getByCategory(FieldCategory.TEXT);
      const specializedTypes = FieldTypeRegistry.getByCategory(FieldCategory.SPECIALIZED);

      expect(textTypes).toHaveLength(0);
      expect(specializedTypes).toHaveLength(1);
    });

    it('should handle multiple field types in same category', () => {
      const fieldType1 = new StringFieldType();
      const fieldType2 = new class extends StringFieldType {
        name = 'text';
      };

      FieldTypeRegistry.register(fieldType1);
      FieldTypeRegistry.register(fieldType2);

      const textTypes = FieldTypeRegistry.getByCategory(FieldCategory.TEXT);
      expect(textTypes).toHaveLength(2);
    });
  });

  describe('Registry State Management', () => {
    it('should clear all field types', () => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());

      expect(FieldTypeRegistry.getAll()).toHaveLength(2);

      FieldTypeRegistry.clear();

      expect(FieldTypeRegistry.getAll()).toHaveLength(0);
      expect(FieldTypeRegistry.getCategories()).toHaveLength(0);
      expect(FieldTypeRegistry.getAllMetadata()).toHaveLength(0);
    });

    it('should create registry snapshot', () => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());

      const snapshot = FieldTypeRegistry.snapshot();

      expect(snapshot.types).toEqual(['string', 'number']);
      expect(snapshot.categories[FieldCategory.TEXT]).toEqual(['string']);
      expect(snapshot.categories[FieldCategory.NUMBER]).toEqual(['number']);
      expect(snapshot.metadata.string).toBeDefined();
      expect(snapshot.metadata.number).toBeDefined();
    });

    it('should handle empty registry snapshot', () => {
      const snapshot = FieldTypeRegistry.snapshot();

      expect(snapshot.types).toEqual([]);
      expect(snapshot.categories).toEqual({});
      expect(snapshot.metadata).toEqual({});
    });
  });

  describe('Metadata Management', () => {
    it('should get metadata for specific field type', () => {
      FieldTypeRegistry.register(new StringFieldType());

      const metadata = FieldTypeRegistry.getMetadata('string');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('string');
      expect(metadata?.category).toBe(FieldCategory.TEXT);
    });

    it('should return undefined for non-existent metadata', () => {
      const metadata = FieldTypeRegistry.getMetadata('nonexistent');
      expect(metadata).toBeUndefined();
    });

    it('should get all metadata', () => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());

      const allMetadata = FieldTypeRegistry.getAllMetadata();
      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.map(m => m.name)).toContain('string');
      expect(allMetadata.map(m => m.name)).toContain('number');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null field type', () => {
      expect(() => {
        FieldTypeRegistry.register(null as any);
      }).toThrow();
    });

    it('should handle undefined field type', () => {
      expect(() => {
        FieldTypeRegistry.register(undefined as any);
      }).toThrow();
    });

    it('should handle field type with null name', () => {
      expect(() => {
        FieldTypeRegistry.register({
          name: null as any,
          validate: () => ({ valid: true, errors: [] }),
          serialize: () => {},
          deserialize: () => {}
        });
      }).toThrow();
    });

    it('should handle field type with special characters in name', () => {
      expect(() => {
        FieldTypeRegistry.register({
          name: 'field-type!',
          validate: () => ({ valid: true, errors: [] }),
          serialize: () => {},
          deserialize: () => {}
        });
      }).toThrow();
    });
  });

  describe('Concurrent Access Simulation', () => {
    it('should handle rapid registration and unregistration', () => {
      const operations = [];

      // Simulate concurrent operations
      for (let i = 0; i < 100; i++) {
        operations.push(() => {
          const fieldType = {
            name: `test_${i}`,
            validate: () => ({ valid: true, errors: [] }),
            serialize: (value: any) => value,
            deserialize: (data: any) => data
          } as FieldType;

          FieldTypeRegistry.register(fieldType);
          FieldTypeRegistry.unregister(`test_${i}`);
        });
      }

      expect(() => {
        operations.forEach(op => op());
      }).not.toThrow();

      expect(FieldTypeRegistry.getAll()).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated registration', () => {
      const initialTypes = FieldTypeRegistry.getAll().length;

      // Register and unregister many field types
      for (let i = 0; i < 1000; i++) {
        const fieldType = {
          name: `temp_${i}`,
          validate: () => ({ valid: true, errors: [] }),
          serialize: (value: any) => value,
          deserialize: (data: any) => data
        } as FieldType;

        FieldTypeRegistry.register(fieldType);
        FieldTypeRegistry.unregister(`temp_${i}`);
      }

      expect(FieldTypeRegistry.getAll()).toHaveLength(initialTypes);
    });
  });
});