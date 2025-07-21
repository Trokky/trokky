/**
 * Comprehensive tests for field helper utilities
 */

import {
  defineField,
  defineType,
  FieldUtils,
  Rule,
  rule
} from '../../fields/helpers';
import {
  FieldDefinition,
  FieldContext,
  ConditionalExpression
} from '../../fields/field-type';

describe('defineField', () => {
  it('should create a field definition', () => {
    const field = defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      required: true
    });

    expect(field.name).toBe('title');
    expect(field.type).toBe('string');
    expect(field.title).toBe('Title');
    expect(typeof field.required).toBe('function');
  });

  it('should normalize boolean required to function', () => {
    const field = defineField({
      name: 'title',
      type: 'string',
      required: true
    });

    const mockContext = FieldUtils.createMockContext();
    expect(typeof field.required).toBe('function');
    expect(field.required!(mockContext)).toBe(true);
  });

  it('should preserve function-based properties', () => {
    const requiredFn = jest.fn().mockReturnValue(true);
    const readOnlyFn = jest.fn().mockReturnValue(false);

    const field = defineField({
      name: 'title',
      type: 'string',
      required: requiredFn,
      readOnly: readOnlyFn
    });

    expect(field.required).toBe(requiredFn);
    expect(field.readOnly).toBe(readOnlyFn);
  });

  it('should handle undefined properties', () => {
    const field = defineField({
      name: 'title',
      type: 'string'
    });

    expect(field.required).toBeUndefined();
    expect(field.readOnly).toBeUndefined();
    expect(field.hidden).toBeUndefined();
    expect(field.disabled).toBeUndefined();
  });

  it('should normalize all conditional properties', () => {
    const field = defineField({
      name: 'title',
      type: 'string',
      required: true,
      readOnly: false,
      hidden: true,
      disabled: false
    });

    const mockContext = FieldUtils.createMockContext();
    
    expect(field.required!(mockContext)).toBe(true);
    expect(field.readOnly!(mockContext)).toBe(false);
    expect(field.hidden!(mockContext)).toBe(true);
    expect(field.disabled!(mockContext)).toBe(false);
  });

  it('should preserve field configuration', () => {
    const config = { maxLength: 100, placeholder: 'Enter title' };
    const field = defineField({
      name: 'title',
      type: 'string',
      config
    });

    expect(field.config).toBe(config);
  });
});

describe('defineType', () => {
  it('should create a document type definition', () => {
    const docType = defineType({
      name: 'article',
      type: 'document',
      title: 'Article',
      description: 'Blog article',
      fields: {
        title: {
          name: 'title',
          type: 'string',
          required: true
        },
        content: {
          name: 'content',
          type: 'text'
        }
      }
    });

    expect(docType.name).toBe('article');
    expect(docType.type).toBe('document');
    expect(docType.title).toBe('Article');
    expect(docType.description).toBe('Blog article');
    expect(docType.fields).toBeDefined();
    expect(docType.fields.title.name).toBe('title');
    expect(docType.fields.content.name).toBe('content');
  });

  it('should create a singleton type definition', () => {
    const singletonType = defineType({
      name: 'settings',
      type: 'singleton',
      fields: {
        siteName: {
          name: 'siteName',
          type: 'string'
        }
      }
    });

    expect(singletonType.type).toBe('singleton');
    expect(singletonType.fields.siteName).toBeDefined();
  });

  it('should normalize field definitions', () => {
    const docType = defineType({
      name: 'article',
      type: 'document',
      fields: {
        title: {
          name: 'title',
          type: 'string',
          required: true
        }
      }
    });

    const titleField = docType.fields.title;
    expect(typeof titleField.required).toBe('function');
  });

  it('should preserve additional properties', () => {
    const docType = defineType({
      name: 'article',
      type: 'document',
      customProperty: 'custom value',
      fields: {
        title: {
          name: 'title',
          type: 'string'
        }
      }
    });

    expect(docType.customProperty).toBe('custom value');
  });

  it('should handle empty fields object', () => {
    const docType = defineType({
      name: 'empty',
      type: 'document',
      fields: {}
    });

    expect(docType.fields).toEqual({});
  });
});

describe('FieldUtils', () => {
  let mockContext: FieldContext;

  beforeEach(() => {
    mockContext = FieldUtils.createMockContext({
      document: {
        status: 'published',
        featured: true,
        category: 'tech'
      },
      getValue: jest.fn((path: string) => {
        const doc = mockContext.document as any;
        return doc[path];
      })
    });
  });

  describe('isHidden', () => {
    it('should evaluate function-based hidden', async () => {
      const hiddenFn = jest.fn().mockResolvedValue(true);
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hidden: hiddenFn
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(true);
      expect(hiddenFn).toHaveBeenCalledWith(mockContext);
    });

    it('should evaluate boolean hidden', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hidden: true
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate hideIf condition', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hideIf: { field: 'status', operator: 'equals', value: 'published' }
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate showIf condition', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        showIf: { field: 'status', operator: 'equals', value: 'draft' }
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(true); // Should be hidden because showIf is false
    });

    it('should return false by default', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(false);
    });

    it('should prioritize function over conditional', async () => {
      const hiddenFn = jest.fn().mockResolvedValue(false);
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hidden: hiddenFn,
        hideIf: { field: 'status', operator: 'equals', value: 'published' }
      };

      const result = await FieldUtils.isHidden(field, mockContext);
      expect(result).toBe(false);
      expect(hiddenFn).toHaveBeenCalled();
    });
  });

  describe('isReadOnly', () => {
    it('should evaluate function-based readOnly', async () => {
      const readOnlyFn = jest.fn().mockResolvedValue(true);
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        readOnly: readOnlyFn
      };

      const result = await FieldUtils.isReadOnly(field, mockContext);
      expect(result).toBe(true);
      expect(readOnlyFn).toHaveBeenCalledWith(mockContext);
    });

    it('should evaluate boolean readOnly', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        readOnly: true
      };

      const result = await FieldUtils.isReadOnly(field, mockContext);
      expect(result).toBe(true);
    });

    it('should return false by default', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const result = await FieldUtils.isReadOnly(field, mockContext);
      expect(result).toBe(false);
    });
  });

  describe('isDisabled', () => {
    it('should evaluate function-based disabled', async () => {
      const disabledFn = jest.fn().mockResolvedValue(true);
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        disabled: disabledFn
      };

      const result = await FieldUtils.isDisabled(field, mockContext);
      expect(result).toBe(true);
      expect(disabledFn).toHaveBeenCalledWith(mockContext);
    });

    it('should evaluate boolean disabled', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        disabled: true
      };

      const result = await FieldUtils.isDisabled(field, mockContext);
      expect(result).toBe(true);
    });

    it('should return false by default', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const result = await FieldUtils.isDisabled(field, mockContext);
      expect(result).toBe(false);
    });
  });

  describe('isRequired', () => {
    it('should evaluate function-based required', async () => {
      const requiredFn = jest.fn().mockResolvedValue(true);
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        required: requiredFn
      };

      const result = await FieldUtils.isRequired(field, mockContext);
      expect(result).toBe(true);
      expect(requiredFn).toHaveBeenCalledWith(mockContext);
    });

    it('should evaluate boolean required', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        required: true
      };

      const result = await FieldUtils.isRequired(field, mockContext);
      expect(result).toBe(true);
    });

    it('should evaluate requiredIf condition', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        requiredIf: { field: 'featured', operator: 'equals', value: true }
      };

      const result = await FieldUtils.isRequired(field, mockContext);
      expect(result).toBe(true);
    });

    it('should return false by default', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const result = await FieldUtils.isRequired(field, mockContext);
      expect(result).toBe(false);
    });
  });

  describe('getDefaultValue', () => {
    it('should evaluate function-based default value', async () => {
      const defaultFn = jest.fn().mockResolvedValue('dynamic default');
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        defaultValue: defaultFn
      };

      const result = await FieldUtils.getDefaultValue(field, mockContext);
      expect(result).toBe('dynamic default');
      expect(defaultFn).toHaveBeenCalledWith(mockContext);
    });

    it('should return static default value', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        defaultValue: 'static default'
      };

      const result = await FieldUtils.getDefaultValue(field, mockContext);
      expect(result).toBe('static default');
    });

    it('should return undefined when no default', async () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const result = await FieldUtils.getDefaultValue(field, mockContext);
      expect(result).toBeUndefined();
    });
  });

  describe('hasConditionalLogic', () => {
    it('should detect showIf condition', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        showIf: { field: 'status', operator: 'equals', value: 'published' }
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(true);
    });

    it('should detect hideIf condition', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hideIf: { field: 'status', operator: 'equals', value: 'draft' }
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(true);
    });

    it('should detect requiredIf condition', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        requiredIf: { field: 'type', operator: 'equals', value: 'article' }
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(true);
    });

    it('should detect function-based properties', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        required: () => true,
        readOnly: () => false,
        hidden: () => false,
        disabled: () => true
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(true);
    });

    it('should return false for static fields', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        required: true,
        readOnly: false
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(false);
    });

    it('should return false for fields without conditionals', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      expect(FieldUtils.hasConditionalLogic(field)).toBe(false);
    });
  });

  describe('getFieldDependencies', () => {
    it('should extract explicit dependencies', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        dependsOn: ['field1', 'field2']
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['field1', 'field2']);
    });

    it('should extract dependencies from showIf', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        showIf: { field: 'status', operator: 'equals', value: 'published' }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['status']);
    });

    it('should extract dependencies from hideIf', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        hideIf: { field: 'featured', operator: 'equals', value: false }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['featured']);
    });

    it('should extract dependencies from requiredIf', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        requiredIf: { field: 'type', operator: 'equals', value: 'required' }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['type']);
    });

    it('should extract dependencies from complex conditions', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        showIf: {
          field: '',
          and: [
            { field: 'status', operator: 'equals', value: 'published' },
            { field: 'featured', operator: 'equals', value: true }
          ]
        }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['status', 'featured']);
    });

    it('should extract dependencies from nested conditions', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        showIf: {
          field: '',
          or: [
            {
              field: '',
              and: [
                { field: 'field1', operator: 'equals', value: 'a' },
                { field: 'field2', operator: 'equals', value: 'b' }
              ]
            },
            {
              field: '',
              not: { field: 'field3', operator: 'equals', value: 'c' }
            }
          ]
        }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['field1', 'field2', 'field3']);
    });

    it('should combine explicit and conditional dependencies', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        dependsOn: ['explicit1', 'explicit2'],
        showIf: { field: 'conditional1', operator: 'equals', value: 'test' },
        requiredIf: { field: 'conditional2', operator: 'exists' }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['explicit1', 'explicit2', 'conditional1', 'conditional2']);
    });

    it('should deduplicate dependencies', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string',
        dependsOn: ['field1'],
        showIf: { field: 'field1', operator: 'equals', value: 'test' },
        requiredIf: { field: 'field1', operator: 'exists' }
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual(['field1']); // Should only appear once
    });

    it('should return empty array for fields without dependencies', () => {
      const field: FieldDefinition = {
        name: 'test',
        type: 'string'
      };

      const deps = FieldUtils.getFieldDependencies(field);
      expect(deps).toEqual([]);
    });
  });

  describe('createMockContext', () => {
    it('should create a default mock context', () => {
      const context = FieldUtils.createMockContext();

      expect(context.document).toEqual({});
      expect(context.fieldPath).toEqual([]);
      expect(context.user.role).toBe('admin');
      expect(context.permissions).toContain('manage_users');
      expect(context.isStudio).toBe(true);
      expect(context.isPreview).toBe(false);
    });

    it('should allow overrides', () => {
      const overrides = {
        document: { title: 'Test' },
        fieldPath: ['custom', 'path'],
        isPreview: true
      };

      const context = FieldUtils.createMockContext(overrides);

      expect(context.document).toEqual({ title: 'Test' });
      expect(context.fieldPath).toEqual(['custom', 'path']);
      expect(context.isPreview).toBe(true);
      expect(context.isStudio).toBe(true); // Should preserve defaults
    });

    it('should provide working mock functions', () => {
      const context = FieldUtils.createMockContext();

      expect(typeof context.getValue).toBe('function');
      expect(typeof context.setValue).toBe('function');
      expect(typeof context.emit).toBe('function');
      expect(typeof context.on).toBe('function');
    });

    it('should provide mock HTTP and API clients', async () => {
      const context = FieldUtils.createMockContext();

      expect(await context.httpClient.get('/test')).toEqual({});
      expect(await context.apiClient.checkUnique('field', 'value')).toBe(false);
      expect(await context.apiClient.search('collection', 'query')).toEqual([]);
    });
  });
});

describe('Rule Builder', () => {
  describe('Rule class', () => {
    it('should create empty rule builder', () => {
      const ruleBuilder = new Rule();
      expect(ruleBuilder.getRules()).toEqual([]);
    });

    it('should add required rule', () => {
      const ruleBuilder = new Rule().required('Field is required');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'required',
        message: 'Field is required'
      });
    });

    it('should add min rule', () => {
      const ruleBuilder = new Rule().min(5, 'Must be at least 5 characters');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'min',
        value: 5,
        message: 'Must be at least 5 characters'
      });
    });

    it('should add max rule', () => {
      const ruleBuilder = new Rule().max(100, 'Must be no more than 100 characters');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'max',
        value: 100,
        message: 'Must be no more than 100 characters'
      });
    });

    it('should add length rule', () => {
      const ruleBuilder = new Rule().length(10, 'Must be exactly 10 characters');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'length',
        value: 10,
        message: 'Must be exactly 10 characters'
      });
    });

    it('should add email rule', () => {
      const ruleBuilder = new Rule().email('Must be a valid email');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'email',
        message: 'Must be a valid email'
      });
    });

    it('should add url rule', () => {
      const ruleBuilder = new Rule().url('Must be a valid URL');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'url',
        message: 'Must be a valid URL'
      });
    });

    it('should add pattern rule', () => {
      const pattern = /^[A-Z]/;
      const ruleBuilder = new Rule().pattern(pattern, 'Must start with uppercase letter');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'pattern',
        value: pattern,
        message: 'Must start with uppercase letter'
      });
    });

    it('should add custom rule', () => {
      const validateFn = jest.fn().mockReturnValue(true);
      const ruleBuilder = new Rule().custom(validateFn, 'Custom validation failed');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'custom',
        validate: validateFn,
        message: 'Custom validation failed'
      });
    });

    it('should add unique rule', () => {
      const ruleBuilder = new Rule().unique('Must be unique');
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        rule: 'unique',
        async: true,
        message: 'Must be unique'
      });
    });

    it('should chain multiple rules', () => {
      const validateFn = jest.fn();
      const pattern = /^\w+$/;

      const ruleBuilder = new Rule()
        .required('Required')
        .min(3, 'Too short')
        .max(50, 'Too long')
        .pattern(pattern, 'Invalid format')
        .custom(validateFn, 'Custom error');

      const rules = ruleBuilder.getRules();
      expect(rules).toHaveLength(5);
      expect(rules[0].rule).toBe('required');
      expect(rules[1].rule).toBe('min');
      expect(rules[2].rule).toBe('max');
      expect(rules[3].rule).toBe('pattern');
      expect(rules[4].rule).toBe('custom');
    });

    it('should handle rules without messages', () => {
      const ruleBuilder = new Rule().required().email().unique();
      const rules = ruleBuilder.getRules();

      expect(rules).toHaveLength(3);
      expect(rules[0]).toEqual({ rule: 'required', message: undefined });
      expect(rules[1]).toEqual({ rule: 'email', message: undefined });
      expect(rules[2]).toEqual({ rule: 'unique', async: true, message: undefined });
    });
  });

  describe('rule factory function', () => {
    it('should create new Rule instance', () => {
      const ruleBuilder = rule();
      expect(ruleBuilder).toBeInstanceOf(Rule);
    });

    it('should create independent instances', () => {
      const rule1 = rule().required();
      const rule2 = rule().email();

      expect(rule1.getRules()).toHaveLength(1);
      expect(rule2.getRules()).toHaveLength(1);
      expect(rule1.getRules()[0].rule).toBe('required');
      expect(rule2.getRules()[0].rule).toBe('email');
    });

    it('should work with field definitions', () => {
      const field = defineField({
        name: 'email',
        type: 'string',
        validation: rule()
          .required('Email is required')
          .email('Must be a valid email')
          .getRules()
      });

      expect(field.validation).toHaveLength(2);
      expect(field.validation![0].rule).toBe('required');
      expect(field.validation![1].rule).toBe('email');
    });
  });
});

describe('Integration Tests', () => {
  it('should work together in complex field definition', () => {
    const articleType = defineType({
      name: 'article',
      type: 'document',
      fields: {
        title: defineField({
          name: 'title',
          type: 'string',
          required: true,
          validation: rule()
            .required('Title is required')
            .min(5, 'Title must be at least 5 characters')
            .max(100, 'Title must not exceed 100 characters')
            .getRules()
        }),
        status: defineField({
          name: 'status',
          type: 'string',
          defaultValue: 'draft'
        }),
        publishedAt: defineField({
          name: 'publishedAt',
          type: 'date',
          showIf: { field: 'status', operator: 'equals', value: 'published' },
          requiredIf: { field: 'status', operator: 'equals', value: 'published' }
        }),
        featured: defineField({
          name: 'featured',
          type: 'boolean',
          defaultValue: false
        }),
        slug: defineField({
          name: 'slug',
          type: 'string',
          readOnly: (context) => context.user.role !== 'admin',
          validation: rule()
            .required('Slug is required')
            .pattern(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
            .unique('Slug must be unique')
            .getRules()
        })
      }
    });

    expect(articleType.fields.title.validation).toHaveLength(3);
    expect(articleType.fields.publishedAt.showIf).toBeDefined();
    expect(articleType.fields.slug.validation).toHaveLength(3);
    expect(typeof articleType.fields.slug.readOnly).toBe('function');
  });

  it('should evaluate complex field logic', async () => {
    const mockContext = FieldUtils.createMockContext({
      document: {
        status: 'published',
        type: 'premium',
        featured: true
      },
      user: { ...FieldUtils.createMockContext().user, role: 'editor' as any },
      getValue: jest.fn((path: string) => {
        const doc = mockContext.document as any;
        return doc[path];
      })
    });

    const field = defineField({
      name: 'premiumContent',
      type: 'text',
      showIf: {
        field: '',
        and: [
          { field: 'status', operator: 'equals', value: 'published' },
          { field: 'type', operator: 'equals', value: 'premium' }
        ]
      },
      requiredIf: { field: 'featured', operator: 'equals', value: true },
      readOnly: (context) => context.user.role === 'viewer'
    });

    const isHidden = await FieldUtils.isHidden(field, mockContext);
    const isRequired = await FieldUtils.isRequired(field, mockContext);
    const isReadOnly = await FieldUtils.isReadOnly(field, mockContext);

    expect(isHidden).toBe(false); // showIf condition is true
    expect(isRequired).toBe(true); // requiredIf condition is true
    expect(isReadOnly).toBe(false); // user is editor, not viewer
  });

  it('should extract all dependencies from complex field', () => {
    const field = defineField({
      name: 'complexField',
      type: 'string',
      dependsOn: ['explicitDep'],
      showIf: {
        field: '',
        or: [
          {
            field: '',
            and: [
              { field: 'field1', operator: 'equals', value: 'a' },
              { field: 'field2', operator: 'gt', value: 5 }
            ]
          },
          { field: 'field3', operator: 'exists' }
        ]
      },
      requiredIf: { field: 'field4', operator: 'equals', value: true }
    });

    const dependencies = FieldUtils.getFieldDependencies(field);
    expect(dependencies.sort()).toEqual(['explicitDep', 'field1', 'field2', 'field3', 'field4']);
  });
});

describe('Error Handling and Edge Cases', () => {
  it('should handle async function errors gracefully', async () => {
    const errorFn = jest.fn().mockRejectedValue(new Error('Async error'));
    const field: FieldDefinition = {
      name: 'test',
      type: 'string',
      required: errorFn
    };

    const mockContext = FieldUtils.createMockContext();

    await expect(FieldUtils.isRequired(field, mockContext)).rejects.toThrow('Async error');
  });

  it('should handle null/undefined values in dependencies', () => {
    const field: FieldDefinition = {
      name: 'test',
      type: 'string',
      showIf: { field: 'nonexistent', operator: 'equals', value: null }
    };

    const dependencies = FieldUtils.getFieldDependencies(field);
    expect(dependencies).toEqual(['nonexistent']);
  });

  it('should handle malformed conditional expressions', () => {
    const field: FieldDefinition = {
      name: 'test',
      type: 'string',
      showIf: {} as ConditionalExpression // Malformed expression
    };

    // Should not throw when extracting dependencies
    const dependencies = FieldUtils.getFieldDependencies(field);
    expect(dependencies).toEqual([]);
  });

  it('should handle circular field dependencies', () => {
    // This is a design issue but shouldn't crash the system
    const field: FieldDefinition = {
      name: 'test',
      type: 'string',
      dependsOn: ['test'] // Self-dependency
    };

    const dependencies = FieldUtils.getFieldDependencies(field);
    expect(dependencies).toEqual(['test']);
  });
});

describe('Performance Tests', () => {
  it('should handle large numbers of validation rules efficiently', () => {
    const ruleBuilder = rule();
    
    const startTime = performance.now();
    
    // Add many rules
    for (let i = 0; i < 1000; i++) {
      ruleBuilder.min(i);
    }
    
    const rules = ruleBuilder.getRules();
    const endTime = performance.now();
    
    expect(rules).toHaveLength(1000);
    expect(endTime - startTime).toBeLessThan(100); // Should be fast
  });

  it('should handle complex dependency extraction efficiently', () => {
    // Create a field with many nested dependencies
    const createComplexExpression = (depth: number): ConditionalExpression => {
      if (depth === 0) {
        return { field: `field_${depth}`, operator: 'equals', value: 'test' };
      }
      
      return {
        field: '',
        and: [
          { field: `field_${depth}`, operator: 'equals', value: 'test' },
          createComplexExpression(depth - 1)
        ]
      };
    };

    const field: FieldDefinition = {
      name: 'complex',
      type: 'string',
      showIf: createComplexExpression(50) // Deep nesting
    };

    const startTime = performance.now();
    const dependencies = FieldUtils.getFieldDependencies(field);
    const endTime = performance.now();

    expect(dependencies.length).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(50); // Should be reasonably fast
  });
});