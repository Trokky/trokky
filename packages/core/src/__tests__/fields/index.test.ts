/**
 * Tests for field system exports and module loading
 */

describe('Field System Exports', () => {
  it('should export all field system components', async () => {
    const fieldSystem = await import('../../fields/index.js');

    // Check that all major exports are available
    expect(fieldSystem.FieldCategory).toBeDefined();
    expect(fieldSystem.FieldTypeRegistry).toBeDefined();
    expect(fieldSystem.ConditionalEvaluator).toBeDefined();
    expect(fieldSystem.ConditionalUtils).toBeDefined();
    expect(fieldSystem.FieldUtils).toBeDefined();
    expect(fieldSystem.defineField).toBeDefined();
    expect(fieldSystem.defineType).toBeDefined();
    expect(fieldSystem.rule).toBeDefined();
    expect(fieldSystem.Rule).toBeDefined();
  });

  it('should export error classes', async () => {
    const fieldSystem = await import('../../fields/index.js');

    expect(fieldSystem.FieldTypeRegistrationError).toBeDefined();
    expect(fieldSystem.ConditionalEvaluationError).toBeDefined();
  });

  it('should export TypeScript interfaces and types', async () => {
    // This is more of a compile-time check, but we can verify the exports exist
    const fieldTypeModule = await import('../../fields/field-type.js');
    
    // These should be available as type exports (compile-time check)
    expect(typeof fieldTypeModule.FieldCategory).toBe('object');
  });

  it('should allow import of individual modules', async () => {
    const registryModule = await import('../../fields/registry.js');
    const conditionalModule = await import('../../fields/conditional.js');
    const helpersModule = await import('../../fields/helpers.js');
    const fieldTypeModule = await import('../../fields/field-type.js');

    expect(registryModule.FieldTypeRegistry).toBeDefined();
    expect(conditionalModule.ConditionalEvaluator).toBeDefined();
    expect(helpersModule.defineField).toBeDefined();
    expect(fieldTypeModule.FieldCategory).toBeDefined();
  });

  it('should have consistent exports between index and individual modules', async () => {
    const indexModule = await import('../../fields/index.js');
    const registryModule = await import('../../fields/registry.js');
    const conditionalModule = await import('../../fields/conditional.js');
    const helpersModule = await import('../../fields/helpers.js');

    // Check that exports match
    expect(indexModule.FieldTypeRegistry).toBe(registryModule.FieldTypeRegistry);
    expect(indexModule.ConditionalEvaluator).toBe(conditionalModule.ConditionalEvaluator);
    expect(indexModule.defineField).toBe(helpersModule.defineField);
  });
});

describe('Module Loading Performance', () => {
  it('should load modules efficiently', async () => {
    const startTime = performance.now();
    
    await import('../../fields/index.js');
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    // Module loading should be fast (less than 100ms)
    expect(loadTime).toBeLessThan(100);
  });

  it('should handle repeated imports efficiently', async () => {
    const startTime = performance.now();
    
    // Import the same module multiple times
    for (let i = 0; i < 10; i++) {
      await import('../../fields/index.js');
    }
    
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    // Repeated imports should be cached and very fast
    expect(loadTime).toBeLessThan(50);
  });
});

describe('Tree Shaking Support', () => {
  it('should support importing individual exports', async () => {
    // Test that we can import specific exports without importing everything
    const { FieldTypeRegistry } = await import('../../fields/registry.js');
    const { ConditionalEvaluator } = await import('../../fields/conditional.js');
    const { defineField } = await import('../../fields/helpers.js');

    expect(FieldTypeRegistry).toBeDefined();
    expect(ConditionalEvaluator).toBeDefined();
    expect(defineField).toBeDefined();
  });

  it('should allow selective imports from index', async () => {
    // Modern bundlers should be able to tree-shake unused exports
    const { FieldTypeRegistry, defineField } = await import('../../fields/index.js');

    expect(FieldTypeRegistry).toBeDefined();
    expect(defineField).toBeDefined();
  });
});

describe('TypeScript Compatibility', () => {
  it('should provide proper TypeScript support', () => {
    // This test mainly ensures that TypeScript compilation works
    // The real test is that the code compiles without TypeScript errors
    
    // Test that we can import and use types
    import('../../fields/field-type.js').then(module => {
      expect(module.FieldCategory).toBeDefined();
    });
  });

  it('should support generic type parameters', async () => {
    const { defineField } = await import('../../fields/helpers.js');
    
    // This should compile without TypeScript errors
    const field = defineField<{ maxLength: number }>({
      name: 'test',
      type: 'string',
      config: {
        maxLength: 100
      }
    });

    expect(field.config?.maxLength).toBe(100);
  });
});

describe('Error Handling in Module Loading', () => {
  it('should handle import errors gracefully', async () => {
    // Test what happens if a module fails to load
    try {
      await import('../../fields/nonexistent-module.js');
      // If this doesn't throw, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Expected behavior - module not found
      expect(error).toBeDefined();
    }
  });

  it('should maintain module isolation', async () => {
    // Import the registry module
    const { FieldTypeRegistry } = await import('../../fields/registry.js');
    
    // Clear it
    FieldTypeRegistry.clear();
    expect(FieldTypeRegistry.getAll()).toHaveLength(0);
    
    // Import it again in a different context
    const secondImport = await import('../../fields/registry.js');
    
    // Should be the same instance (modules are singletons)
    expect(secondImport.FieldTypeRegistry).toBe(FieldTypeRegistry);
    expect(secondImport.FieldTypeRegistry.getAll()).toHaveLength(0);
  });
});

describe('Backwards Compatibility', () => {
  it('should maintain API compatibility', async () => {
    const fieldSystem = await import('../../fields/index.js');
    
    // Test that the main API hasn't changed
    expect(typeof fieldSystem.defineField).toBe('function');
    expect(typeof fieldSystem.defineType).toBe('function');
    expect(typeof fieldSystem.rule).toBe('function');
    
    // Test that classes are constructable
    expect(fieldSystem.FieldTypeRegistry).toBeDefined();
    expect(fieldSystem.ConditionalEvaluator).toBeDefined();
    expect(fieldSystem.FieldUtils).toBeDefined();
  });

  it('should support legacy field definitions', async () => {
    const { defineField } = await import('../../fields/helpers.js');
    
    // Test that old-style field definitions still work
    const legacyField = defineField({
      name: 'legacy',
      type: 'string',
      required: true, // Boolean instead of function
      readOnly: false  // Boolean instead of function
    });

    expect(legacyField.name).toBe('legacy');
    expect(typeof legacyField.required).toBe('function');
    expect(typeof legacyField.readOnly).toBe('function');
  });
});

describe('Memory Management', () => {
  it('should not leak memory on repeated imports', async () => {
    // This is more of a conceptual test since we can't easily measure memory in Jest
    // But we can ensure that repeated imports don't create new instances
    
    const imports = [];
    for (let i = 0; i < 100; i++) {
      const module = await import('../../fields/index.js');
      imports.push(module.FieldTypeRegistry);
    }
    
    // All imports should reference the same instance
    const firstRegistry = imports[0];
    for (const registry of imports) {
      expect(registry).toBe(firstRegistry);
    }
  });

  it('should handle registry cleanup properly', async () => {
    const { FieldTypeRegistry } = await import('../../fields/registry.js');
    
    // Mock field type for testing
    const mockFieldType = {
      name: 'testCleanup',
      validate: () => ({ valid: true, errors: [] }),
      serialize: (v: any) => v,
      deserialize: (v: any) => v
    };
    
    // Register many field types
    for (let i = 0; i < 1000; i++) {
      const fieldType = { ...mockFieldType, name: `test_${i}` };
      FieldTypeRegistry.register(fieldType);
    }
    
    expect(FieldTypeRegistry.getAll()).toHaveLength(1000);
    
    // Clear should remove all references
    FieldTypeRegistry.clear();
    expect(FieldTypeRegistry.getAll()).toHaveLength(0);
    
    // Metadata should also be cleared
    expect(FieldTypeRegistry.getAllMetadata()).toHaveLength(0);
  });
});

describe('Integration with Package Manager', () => {
  it('should work with ES modules', async () => {
    // Test that the module can be imported as ES module
    const module = await import('../../fields/index.js');
    
    // Should have named exports
    expect(module.FieldTypeRegistry).toBeDefined();
    expect(module.defineField).toBeDefined();
    
    // Should not have default export (our modules use named exports)
    expect(module.default).toBeUndefined();
  });

  it('should support dynamic imports', async () => {
    // Test dynamic import syntax
    const registryModule = await import('../../fields/registry.js');
    const conditionalModule = await import('../../fields/conditional.js');
    
    expect(registryModule).toBeDefined();
    expect(conditionalModule).toBeDefined();
  });
});

describe('Development vs Production Behavior', () => {
  it('should behave consistently across environments', async () => {
    const { FieldTypeRegistry } = await import('../../fields/registry.js');
    
    // Basic functionality should work the same way
    FieldTypeRegistry.clear();
    
    const mockFieldType = {
      name: 'envTest',
      validate: () => ({ valid: true, errors: [] }),
      serialize: (v: any) => v,
      deserialize: (v: any) => v
    };
    
    FieldTypeRegistry.register(mockFieldType);
    expect(FieldTypeRegistry.exists('envTest')).toBe(true);
    
    FieldTypeRegistry.unregister('envTest');
    expect(FieldTypeRegistry.exists('envTest')).toBe(false);
  });
});