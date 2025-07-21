/**
 * Integration tests for the complete field system
 * Tests real-world scenarios and system interactions
 */

import {
  FieldTypeRegistry,
  FieldTypeRegistrationError
} from '../../fields/registry';
import {
  ConditionalEvaluator,
  ConditionalUtils
} from '../../fields/conditional';
import {
  defineField,
  defineType,
  FieldUtils,
  rule
} from '../../fields/helpers';
import {
  FieldType,
  FieldCategory,
  FieldContext,
  FieldDefinition,
  ValidationResult,
  ValidationError
} from '../../fields/field-type';

describe('Field System Integration', () => {
  beforeEach(() => {
    FieldTypeRegistry.clear();
  });

  afterEach(() => {
    FieldTypeRegistry.clear();
  });

  describe('Complete Field Type Implementation', () => {
    // String field type with full validation
    class StringFieldType implements FieldType<{
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      placeholder?: string;
      multiline?: boolean;
    }, string> {
      name = 'string';
      category = FieldCategory.TEXT;
      description = 'Text input field with validation';
      icon = 'text';

      async validate(value: string, config: any, context: FieldContext): Promise<ValidationResult> {
        const errors: ValidationError[] = [];

        // Required validation
        if (!value || value.trim() === '') {
          if (await FieldUtils.isRequired(context.getFieldConfig(context.fieldPath.join('.')) || { name: '', type: 'string' }, context)) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: 'This field is required',
              code: 'REQUIRED'
            });
          }
        }

        if (value) {
          // Length validation
          if (config.minLength && value.length < config.minLength) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: `Must be at least ${config.minLength} characters`,
              code: 'MIN_LENGTH'
            });
          }

          if (config.maxLength && value.length > config.maxLength) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: `Must not exceed ${config.maxLength} characters`,
              code: 'MAX_LENGTH'
            });
          }

          // Pattern validation
          if (config.pattern && !config.pattern.test(value)) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: 'Invalid format',
              code: 'INVALID_FORMAT'
            });
          }

          // Unique validation (async)
          if (config.unique) {
            const isUnique = await context.apiClient.checkUnique(context.fieldPath.join('.'), value);
            if (!isUnique) {
              errors.push({
                field: context.fieldPath.join('.'),
                message: 'This value must be unique',
                code: 'NOT_UNIQUE'
              });
            }
          }
        }

        return {
          valid: errors.length === 0,
          errors
        };
      }

      serialize(value: string, config: any) {
        return value || '';
      }

      deserialize(data: any, config: any): string {
        return typeof data === 'string' ? data : String(data || '');
      }

      get defaultValue() {
        return '';
      }

      async hidden(config: any, context: FieldContext) {
        return !context.permissions.includes('read');
      }

      async readOnly(config: any, context: FieldContext) {
        return !context.permissions.includes('write');
      }

      async disabled(config: any, context: FieldContext) {
        return context.user.role === 'viewer';
      }
    }

    // Number field type
    class NumberFieldType implements FieldType<{
      min?: number;
      max?: number;
      step?: number;
      integer?: boolean;
    }, number> {
      name = 'number';
      category = FieldCategory.NUMBER;
      description = 'Numeric input field';

      async validate(value: number, config: any, context: FieldContext): Promise<ValidationResult> {
        const errors: ValidationError[] = [];

        if (value != null) {
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: 'Must be a valid number',
              code: 'INVALID_NUMBER'
            });
          } else {
            if (config.min != null && value < config.min) {
              errors.push({
                field: context.fieldPath.join('.'),
                message: `Must be at least ${config.min}`,
                code: 'MIN_VALUE'
              });
            }

            if (config.max != null && value > config.max) {
              errors.push({
                field: context.fieldPath.join('.'),
                message: `Must not exceed ${config.max}`,
                code: 'MAX_VALUE'
              });
            }

            if (config.integer && !Number.isInteger(value)) {
              errors.push({
                field: context.fieldPath.join('.'),
                message: 'Must be a whole number',
                code: 'NOT_INTEGER'
              });
            }
          }
        }

        return {
          valid: errors.length === 0,
          errors
        };
      }

      serialize(value: number, config: any) {
        return Number(value) || 0;
      }

      deserialize(data: any, config: any): number {
        const num = Number(data);
        return isNaN(num) ? 0 : num;
      }

      get defaultValue() {
        return 0;
      }
    }

    // Email field type extending string
    class EmailFieldType implements FieldType<{
      allowUnverified?: boolean;
      domains?: string[];
    }, string> {
      name = 'email';
      category = FieldCategory.TEXT;
      description = 'Email address field with validation';

      async validate(value: string, config: any, context: FieldContext): Promise<ValidationResult> {
        const errors: ValidationError[] = [];

        if (value) {
          // Basic email format validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: 'Must be a valid email address',
              code: 'INVALID_EMAIL'
            });
          }

          // Domain restriction
          if (config.domains && config.domains.length > 0) {
            const domain = value.split('@')[1];
            if (!config.domains.includes(domain)) {
              errors.push({
                field: context.fieldPath.join('.'),
                message: `Email domain must be one of: ${config.domains.join(', ')}`,
                code: 'INVALID_DOMAIN'
              });
            }
          }

          // Async email verification
          if (!config.allowUnverified) {
            try {
              const response = await context.httpClient.get(`/api/verify-email?email=${encodeURIComponent(value)}`);
              if (!response.valid) {
                errors.push({
                  field: context.fieldPath.join('.'),
                  message: 'Email address could not be verified',
                  code: 'UNVERIFIED_EMAIL'
                });
              }
            } catch (error) {
              // Non-blocking verification error
              console.warn('Email verification failed:', error);
            }
          }
        }

        return {
          valid: errors.length === 0,
          errors
        };
      }

      serialize(value: string, config: any) {
        return value?.toLowerCase() || '';
      }

      deserialize(data: any, config: any): string {
        return typeof data === 'string' ? data.toLowerCase() : '';
      }

      get defaultValue() {
        return '';
      }
    }

    it('should register and use multiple field types', () => {
      const stringType = new StringFieldType();
      const numberType = new NumberFieldType();
      const emailType = new EmailFieldType();

      FieldTypeRegistry.register(stringType);
      FieldTypeRegistry.register(numberType);
      FieldTypeRegistry.register(emailType);

      expect(FieldTypeRegistry.getAll()).toHaveLength(3);
      expect(FieldTypeRegistry.get('string')).toBe(stringType);
      expect(FieldTypeRegistry.get('number')).toBe(numberType);
      expect(FieldTypeRegistry.get('email')).toBe(emailType);
    });

    it('should categorize field types correctly', () => {
      FieldTypeRegistry.register(new StringFieldType());
      FieldTypeRegistry.register(new NumberFieldType());
      FieldTypeRegistry.register(new EmailFieldType());

      const textTypes = FieldTypeRegistry.getByCategory(FieldCategory.TEXT);
      const numberTypes = FieldTypeRegistry.getByCategory(FieldCategory.NUMBER);

      expect(textTypes).toHaveLength(2); // string and email
      expect(numberTypes).toHaveLength(1); // number
    });

    it('should validate field types with their configurations', async () => {
      FieldTypeRegistry.register(new StringFieldType());
      
      const stringType = FieldTypeRegistry.get('string')!;
      const mockContext = FieldUtils.createMockContext({
        fieldPath: ['title']
      });

      const config = { minLength: 5, maxLength: 100 };
      
      // Valid value
      const validResult = await stringType.validate('Valid title', config, mockContext);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid value (too short)
      const invalidResult = await stringType.validate('Hi', config, mockContext);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0].code).toBe('MIN_LENGTH');
    });

    it('should handle async validation', async () => {
      FieldTypeRegistry.register(new EmailFieldType());
      
      const emailType = FieldTypeRegistry.get('email')!;
      const mockContext = FieldUtils.createMockContext({
        fieldPath: ['email'],
        httpClient: {
          get: jest.fn().mockResolvedValue({ valid: false })
        } as any
      });

      const config = { allowUnverified: false };
      
      const result = await emailType.validate('test@invalid.com', config, mockContext);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.code === 'UNVERIFIED_EMAIL')).toBe(true);
    });
  });

  describe('Complex Document Schema', () => {
    beforeEach(() => {
      // Register field types
      FieldTypeRegistry.register(new class implements FieldType {
        name = 'string';
        category = FieldCategory.TEXT;
        validate = jest.fn().mockResolvedValue({ valid: true, errors: [] });
        serialize = jest.fn((v) => v);
        deserialize = jest.fn((v) => v);
      });

      FieldTypeRegistry.register(new class implements FieldType {
        name = 'email';
        category = FieldCategory.TEXT;
        validate = jest.fn().mockResolvedValue({ valid: true, errors: [] });
        serialize = jest.fn((v) => v);
        deserialize = jest.fn((v) => v);
      });

      FieldTypeRegistry.register(new class implements FieldType {
        name = 'date';
        category = FieldCategory.DATE;
        validate = jest.fn().mockResolvedValue({ valid: true, errors: [] });
        serialize = jest.fn((v) => v);
        deserialize = jest.fn((v) => v);
      });

      FieldTypeRegistry.register(new class implements FieldType {
        name = 'boolean';
        category = FieldCategory.BOOLEAN;
        validate = jest.fn().mockResolvedValue({ valid: true, errors: [] });
        serialize = jest.fn((v) => v);
        deserialize = jest.fn((v) => v);
      });
    });

    it('should create complex blog post schema with conditional logic', () => {
      const blogPostSchema = defineType({
        name: 'blogPost',
        type: 'document',
        title: 'Blog Post',
        description: 'A blog post with advanced features',
        fields: {
          title: defineField({
            name: 'title',
            type: 'string',
            title: 'Title',
            required: true,
            validation: rule()
              .required('Title is required')
              .min(10, 'Title must be at least 10 characters')
              .max(100, 'Title must not exceed 100 characters')
              .getRules(),
            config: {
              placeholder: 'Enter an engaging title'
            }
          }),

          slug: defineField({
            name: 'slug',
            type: 'string',
            title: 'URL Slug',
            description: 'Auto-generated from title, editable by admins',
            readOnly: (context) => context.user.role !== 'admin',
            validation: rule()
              .required('Slug is required')
              .pattern(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
              .unique('Slug must be unique')
              .getRules(),
            dependsOn: ['title']
          }),

          status: defineField({
            name: 'status',
            type: 'string',
            title: 'Publication Status',
            defaultValue: 'draft',
            config: {
              options: ['draft', 'review', 'published', 'archived']
            }
          }),

          publishedAt: defineField({
            name: 'publishedAt',
            type: 'date',
            title: 'Publication Date',
            showIf: ConditionalUtils.equals('status', 'published'),
            requiredIf: ConditionalUtils.equals('status', 'published'),
            defaultValue: (context) => new Date().toISOString()
          }),

          featured: defineField({
            name: 'featured',
            type: 'boolean',
            title: 'Featured Post',
            description: 'Featured posts appear on the homepage',
            defaultValue: false,
            hidden: (context) => !context.permissions.includes('manage_content')
          }),

          authorEmail: defineField({
            name: 'authorEmail',
            type: 'email',
            title: 'Author Email',
            showIf: ConditionalUtils.and(
              ConditionalUtils.equals('status', 'published'),
              ConditionalUtils.equals('featured', true)
            ),
            validation: rule()
              .email('Must be a valid email address')
              .getRules(),
            config: {
              domains: ['company.com', 'blog.company.com']
            }
          }),

          scheduledPublish: defineField({
            name: 'scheduledPublish',
            type: 'date',
            title: 'Scheduled Publication',
            showIf: ConditionalUtils.equals('status', 'review'),
            description: 'Schedule this post for future publication',
            validation: rule()
              .custom(async (value, context) => {
                if (value && new Date(value) <= new Date()) {
                  return false;
                }
                return true;
              }, 'Scheduled date must be in the future')
              .getRules()
          }),

          seoTitle: defineField({
            name: 'seoTitle',
            type: 'string',
            title: 'SEO Title',
            description: 'Override the title for search engines',
            showIf: ConditionalUtils.or(
              ConditionalUtils.equals('status', 'published'),
              ConditionalUtils.equals('featured', true)
            ),
            validation: rule()
              .max(60, 'SEO title should not exceed 60 characters')
              .getRules(),
            dependsOn: ['title', 'status', 'featured']
          })
        }
      });

      expect(blogPostSchema.name).toBe('blogPost');
      expect(blogPostSchema.type).toBe('document');
      expect(Object.keys(blogPostSchema.fields)).toHaveLength(8); // Updated to match actual count

      // Check conditional logic setup
      const publishedAtField = blogPostSchema.fields.publishedAt;
      expect(publishedAtField.showIf).toBeDefined();
      expect(publishedAtField.requiredIf).toBeDefined();

      const authorEmailField = blogPostSchema.fields.authorEmail;
      expect(authorEmailField.showIf?.and).toBeDefined();

      const seoTitleField = blogPostSchema.fields.seoTitle;
      expect(seoTitleField.showIf?.or).toBeDefined();
      expect(seoTitleField.dependsOn).toEqual(['title', 'status', 'featured']);
    });

    it('should evaluate field visibility based on document state', async () => {
      const publishedContext = FieldUtils.createMockContext({
        document: {
          status: 'published',
          featured: true,
          title: 'Test Post'
        },
        getValue: jest.fn((path) => {
          const doc = publishedContext.document as any;
          return doc[path];
        })
      });

      const draftContext = FieldUtils.createMockContext({
        document: {
          status: 'draft',
          featured: false,
          title: 'Draft Post'
        },
        getValue: jest.fn((path) => {
          const doc = draftContext.document as any;
          return doc[path];
        })
      });

      // publishedAt field should be visible when status is published
      const publishedAtShowIf = ConditionalUtils.equals('status', 'published');
      expect(ConditionalEvaluator.evaluate(publishedAtShowIf, publishedContext)).toBe(true);
      expect(ConditionalEvaluator.evaluate(publishedAtShowIf, draftContext)).toBe(false);

      // authorEmail field should be visible when published AND featured
      const authorEmailShowIf = ConditionalUtils.and(
        ConditionalUtils.equals('status', 'published'),
        ConditionalUtils.equals('featured', true)
      );
      expect(ConditionalEvaluator.evaluate(authorEmailShowIf, publishedContext)).toBe(true);
      expect(ConditionalEvaluator.evaluate(authorEmailShowIf, draftContext)).toBe(false);

      // seoTitle should be visible when published OR featured
      const seoTitleShowIf = ConditionalUtils.or(
        ConditionalUtils.equals('status', 'published'),
        ConditionalUtils.equals('featured', true)
      );
      expect(ConditionalEvaluator.evaluate(seoTitleShowIf, publishedContext)).toBe(true);
      expect(ConditionalEvaluator.evaluate(seoTitleShowIf, draftContext)).toBe(false);
    });

    it('should handle field dependencies correctly', () => {
      const slugField = defineField({
        name: 'slug',
        type: 'string',
        dependsOn: ['title']
      });

      const seoTitleField = defineField({
        name: 'seoTitle',
        type: 'string',
        showIf: ConditionalUtils.or(
          ConditionalUtils.equals('status', 'published'),
          ConditionalUtils.equals('featured', true)
        ),
        dependsOn: ['title', 'status', 'featured']
      });

      expect(FieldUtils.getFieldDependencies(slugField)).toEqual(['title']);
      expect(FieldUtils.getFieldDependencies(seoTitleField).sort()).toEqual(['featured', 'status', 'title']);
    });
  });

  describe('Real-world Validation Scenarios', () => {
    beforeEach(() => {
      // Mock field types with realistic validation
      FieldTypeRegistry.register(new class implements FieldType {
        name = 'string';
        async validate(value: string, config: any, context: FieldContext) {
          const errors: ValidationError[] = [];
          if (config.required && (!value || value.trim() === '')) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: 'Required field',
              code: 'REQUIRED'
            });
          }
          if (value && config.minLength && value.length < config.minLength) {
            errors.push({
              field: context.fieldPath.join('.'),
              message: `Minimum ${config.minLength} characters`,
              code: 'MIN_LENGTH'
            });
          }
          return { valid: errors.length === 0, errors };
        }
        serialize = (v: any) => String(v || '');
        deserialize = (v: any) => String(v || '');
      });
    });

    it('should validate user registration form', async () => {
      const userRegistrationSchema = defineType({
        name: 'userRegistration',
        type: 'document',
        fields: {
          username: defineField({
            name: 'username',
            type: 'string',
            required: true,
            validation: rule()
              .required('Username is required')
              .min(3, 'Username must be at least 3 characters')
              .pattern(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
              .unique('Username is already taken')
              .getRules(),
            config: {
              required: true,
              minLength: 3
            }
          }),

          email: defineField({
            name: 'email',
            type: 'string',
            required: true,
            validation: rule()
              .required('Email is required')
              .email('Must be a valid email')
              .unique('Email is already registered')
              .getRules(),
            config: {
              required: true
            }
          }),

          password: defineField({
            name: 'password',
            type: 'string',
            required: true,
            validation: rule()
              .required('Password is required')
              .min(8, 'Password must be at least 8 characters')
              .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
              .getRules(),
            config: {
              required: true,
              minLength: 8
            }
          }),

          confirmPassword: defineField({
            name: 'confirmPassword',
            type: 'string',
            required: true,
            validation: rule()
              .required('Password confirmation is required')
              .custom((value, context) => {
                const password = context.getValue('password');
                return value === password;
              }, 'Passwords do not match')
              .getRules(),
            dependsOn: ['password'],
            config: {
              required: true
            }
          }),

          agreeToTerms: defineField({
            name: 'agreeToTerms',
            type: 'boolean',
            required: true,
            validation: rule()
              .custom((value) => value === true, 'You must agree to the terms and conditions')
              .getRules()
          }),

          newsletter: defineField({
            name: 'newsletter',
            type: 'boolean',
            defaultValue: false,
            showIf: ConditionalUtils.equals('agreeToTerms', true)
          })
        }
      });

      // Test field visibility
      const contextWithAgreement = FieldUtils.createMockContext({
        document: { agreeToTerms: true },
        getValue: jest.fn((path) => path === 'agreeToTerms' ? true : undefined)
      });

      const contextWithoutAgreement = FieldUtils.createMockContext({
        document: { agreeToTerms: false },
        getValue: jest.fn((path) => path === 'agreeToTerms' ? false : undefined)
      });

      const newsletterField = userRegistrationSchema.fields.newsletter;
      expect(await FieldUtils.isHidden(newsletterField, contextWithAgreement)).toBe(false);
      expect(await FieldUtils.isHidden(newsletterField, contextWithoutAgreement)).toBe(true);

      // Test field dependencies
      const confirmPasswordField = userRegistrationSchema.fields.confirmPassword;
      expect(FieldUtils.getFieldDependencies(confirmPasswordField)).toEqual(['password']);
    });

    it('should validate e-commerce product form', async () => {
      const productSchema = defineType({
        name: 'product',
        type: 'document',
        fields: {
          name: defineField({
            name: 'name',
            type: 'string',
            required: true,
            config: { required: true, minLength: 2 }
          }),

          sku: defineField({
            name: 'sku',
            type: 'string',
            required: true,
            validation: rule()
              .required('SKU is required')
              .pattern(/^[A-Z0-9-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens')
              .unique('SKU must be unique')
              .getRules(),
            config: { required: true }
          }),

          category: defineField({
            name: 'category',
            type: 'string',
            required: true,
            config: { required: true }
          }),

          price: defineField({
            name: 'price',
            type: 'string', // Using string for simplicity in this test
            required: true,
            validation: rule()
              .required('Price is required')
              .custom((value) => {
                const num = parseFloat(value);
                return !isNaN(num) && num > 0;
              }, 'Price must be a positive number')
              .getRules(),
            config: { required: true }
          }),

          salePrice: defineField({
            name: 'salePrice',
            type: 'string',
            showIf: ConditionalUtils.exists('price'),
            validation: rule()
              .custom((value, context) => {
                if (!value) return true; // Optional field
                const saleNum = parseFloat(value);
                const regularNum = parseFloat(context.getValue('price') || '0');
                return !isNaN(saleNum) && saleNum < regularNum;
              }, 'Sale price must be less than regular price')
              .getRules(),
            dependsOn: ['price']
          }),

          trackInventory: defineField({
            name: 'trackInventory',
            type: 'boolean',
            defaultValue: true
          }),

          stockQuantity: defineField({
            name: 'stockQuantity',
            type: 'string',
            showIf: ConditionalUtils.equals('trackInventory', true),
            requiredIf: ConditionalUtils.equals('trackInventory', true),
            validation: rule()
              .custom((value, context) => {
                if (!context.getValue('trackInventory')) return true;
                const num = parseInt(value || '0');
                return !isNaN(num) && num >= 0;
              }, 'Stock quantity must be a non-negative number')
              .getRules(),
            dependsOn: ['trackInventory']
          }),

          lowStockAlert: defineField({
            name: 'lowStockAlert',
            type: 'string',
            showIf: ConditionalUtils.and(
              ConditionalUtils.equals('trackInventory', true),
              ConditionalUtils.exists('stockQuantity')
            ),
            validation: rule()
              .custom((value, context) => {
                if (!value) return true;
                const alertNum = parseInt(value);
                const stockNum = parseInt(context.getValue('stockQuantity') || '0');
                return !isNaN(alertNum) && alertNum <= stockNum;
              }, 'Low stock alert must be less than or equal to stock quantity')
              .getRules(),
            dependsOn: ['trackInventory', 'stockQuantity']
          })
        }
      });

      // Test complex conditional logic
      const contextWithInventory = FieldUtils.createMockContext({
        document: {
          trackInventory: true,
          stockQuantity: '100',
          price: '29.99'
        },
        getValue: jest.fn((path) => {
          const doc = contextWithInventory.document as any;
          return doc[path];
        })
      });

      const contextWithoutInventory = FieldUtils.createMockContext({
        document: {
          trackInventory: false,
          price: '29.99'
        },
        getValue: jest.fn((path) => {
          const doc = contextWithoutInventory.document as any;
          return doc[path];
        })
      });

      // Test field visibility
      const stockQuantityField = productSchema.fields.stockQuantity;
      expect(await FieldUtils.isHidden(stockQuantityField, contextWithInventory)).toBe(false);
      expect(await FieldUtils.isHidden(stockQuantityField, contextWithoutInventory)).toBe(true);

      const lowStockAlertField = productSchema.fields.lowStockAlert;
      expect(await FieldUtils.isHidden(lowStockAlertField, contextWithInventory)).toBe(false);
      expect(await FieldUtils.isHidden(lowStockAlertField, contextWithoutInventory)).toBe(true);

      // Test field requirements
      expect(await FieldUtils.isRequired(stockQuantityField, contextWithInventory)).toBe(true);
      expect(await FieldUtils.isRequired(stockQuantityField, contextWithoutInventory)).toBe(false);

      // Test dependencies
      expect(FieldUtils.getFieldDependencies(lowStockAlertField).sort()).toEqual(['stockQuantity', 'trackInventory']);
    });
  });

  describe('Permission-based Field Access', () => {
    beforeEach(() => {
      FieldTypeRegistry.register(new class implements FieldType {
        name = 'string';
        validate = jest.fn().mockResolvedValue({ valid: true, errors: [] });
        serialize = (v: any) => v;
        deserialize = (v: any) => v;
      });
    });

    it('should control field access based on user permissions', async () => {
      const contentSchema = defineType({
        name: 'content',
        type: 'document',
        fields: {
          title: defineField({
            name: 'title',
            type: 'string',
            required: true
          }),

          content: defineField({
            name: 'content',
            type: 'string',
            readOnly: (context) => !context.permissions.includes('write')
          }),

          publishedAt: defineField({
            name: 'publishedAt',
            type: 'string',
            hidden: (context) => !context.permissions.includes('publish')
          }),

          adminNotes: defineField({
            name: 'adminNotes',
            type: 'string',
            hidden: (context) => context.user.role !== 'admin'
          }),

          moderation: defineField({
            name: 'moderation',
            type: 'string',
            hidden: (context) => !['admin', 'moderator'].includes(context.user.role),
            readOnly: (context) => context.user.role === 'moderator'
          })
        }
      });

      // Admin user context
      const adminContext = FieldUtils.createMockContext({
        user: {
          ...FieldUtils.createMockContext().user,
          role: 'admin'
        },
        permissions: ['read', 'write', 'publish', 'admin'],
        userRole: 'admin'
      });

      // Editor user context
      const editorContext = FieldUtils.createMockContext({
        user: {
          ...FieldUtils.createMockContext().user,
          role: 'editor'
        },
        permissions: ['read', 'write'],
        userRole: 'editor'
      });

      // Viewer user context
      const viewerContext = FieldUtils.createMockContext({
        user: {
          ...FieldUtils.createMockContext().user,
          role: 'viewer'
        },
        permissions: ['read'],
        userRole: 'viewer'
      });

      const contentField = contentSchema.fields.content;
      const publishedAtField = contentSchema.fields.publishedAt;
      const adminNotesField = contentSchema.fields.adminNotes;
      const moderationField = contentSchema.fields.moderation;

      // Test content field read-only access
      expect(await FieldUtils.isReadOnly(contentField, adminContext)).toBe(false);
      expect(await FieldUtils.isReadOnly(contentField, editorContext)).toBe(false);
      expect(await FieldUtils.isReadOnly(contentField, viewerContext)).toBe(true);

      // Test publishedAt field visibility
      expect(await FieldUtils.isHidden(publishedAtField, adminContext)).toBe(false);
      expect(await FieldUtils.isHidden(publishedAtField, editorContext)).toBe(true);
      expect(await FieldUtils.isHidden(publishedAtField, viewerContext)).toBe(true);

      // Test admin notes visibility
      expect(await FieldUtils.isHidden(adminNotesField, adminContext)).toBe(false);
      expect(await FieldUtils.isHidden(adminNotesField, editorContext)).toBe(true);
      expect(await FieldUtils.isHidden(adminNotesField, viewerContext)).toBe(true);

      // Test moderation field
      expect(await FieldUtils.isHidden(moderationField, adminContext)).toBe(false);
      expect(await FieldUtils.isReadOnly(moderationField, adminContext)).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large schemas efficiently', () => {
      const startTime = performance.now();

      // Create a large schema with many fields
      const fields: Record<string, FieldDefinition> = {};
      for (let i = 0; i < 1000; i++) {
        fields[`field_${i}`] = defineField({
          name: `field_${i}`,
          type: 'string',
          showIf: ConditionalUtils.equals('showAll', true),
          dependsOn: i > 0 ? [`field_${i - 1}`] : []
        });
      }

      const largeSchema = defineType({
        name: 'largeDocument',
        type: 'document',
        fields
      });

      const endTime = performance.now();

      expect(Object.keys(largeSchema.fields)).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle circular dependencies gracefully', () => {
      const fieldA = defineField({
        name: 'fieldA',
        type: 'string',
        dependsOn: ['fieldB']
      });

      const fieldB = defineField({
        name: 'fieldB',
        type: 'string',
        dependsOn: ['fieldA']
      });

      // Should not throw when analyzing dependencies
      const depsA = FieldUtils.getFieldDependencies(fieldA);
      const depsB = FieldUtils.getFieldDependencies(fieldB);

      expect(depsA).toEqual(['fieldB']);
      expect(depsB).toEqual(['fieldA']);
    });

    it('should handle malformed field definitions', () => {
      expect(() => {
        defineField({
          name: '',
          type: 'string'
        });
      }).not.toThrow();

      expect(() => {
        defineField({
          name: 'test',
          type: '',
          showIf: {} as any // Malformed condition
        });
      }).not.toThrow();
    });

    it('should handle async errors in conditional evaluation', async () => {
      const errorContext = FieldUtils.createMockContext({
        getValue: jest.fn().mockImplementation(() => {
          throw new Error('Field access error');
        })
      });

      const field = defineField({
        name: 'test',
        type: 'string',
        showIf: ConditionalUtils.equals('problematicField', 'value')
      });

      await expect(FieldUtils.isHidden(field, errorContext)).rejects.toThrow();
    });
  });

  describe('Multi-language Support', () => {
    it('should handle localized field definitions', () => {
      const multiLangSchema = defineType({
        name: 'multiLangContent',
        type: 'document',
        fields: {
          title_en: defineField({
            name: 'title_en',
            type: 'string',
            title: 'Title (English)',
            required: true
          }),

          title_es: defineField({
            name: 'title_es',
            type: 'string',
            title: 'Title (Spanish)',
            showIf: ConditionalUtils.exists('title_en')
          }),

          title_fr: defineField({
            name: 'title_fr',
            type: 'string',
            title: 'Title (French)',
            showIf: ConditionalUtils.exists('title_en')
          }),

          defaultLanguage: defineField({
            name: 'defaultLanguage',
            type: 'string',
            defaultValue: 'en',
            config: {
              options: ['en', 'es', 'fr']
            }
          }),

          requiredTranslations: defineField({
            name: 'requiredTranslations',
            type: 'string',
            showIf: ConditionalUtils.notEquals('defaultLanguage', 'en'),
            validation: rule()
              .custom((value, context) => {
                const defaultLang = context.getValue('defaultLanguage');
                if (defaultLang !== 'en') {
                  // Require translation for non-English default
                  return !!value;
                }
                return true;
              }, 'Translation is required when default language is not English')
              .getRules()
          })
        }
      });

      expect(Object.keys(multiLangSchema.fields)).toHaveLength(5);
      
      // Test conditional display of translation fields
      const mockContext = FieldUtils.createMockContext({
        document: { title_en: 'English Title' },
        getValue: jest.fn((path) => path === 'title_en' ? 'English Title' : undefined)
      });

      const titleEsField = multiLangSchema.fields.title_es;
      const titleFrField = multiLangSchema.fields.title_fr;

      const esShowCondition = titleEsField.showIf!;
      const frShowCondition = titleFrField.showIf!;

      expect(ConditionalEvaluator.evaluate(esShowCondition, mockContext)).toBe(true);
      expect(ConditionalEvaluator.evaluate(frShowCondition, mockContext)).toBe(true);
    });
  });
});

describe('Error Recovery and Resilience', () => {
  beforeEach(() => {
    FieldTypeRegistry.clear();
  });

  afterEach(() => {
    FieldTypeRegistry.clear();
  });

  it('should handle missing field types gracefully', () => {
    const field = defineField({
      name: 'test',
      type: 'nonexistentType'
    });

    expect(field.type).toBe('nonexistentType');
    expect(FieldTypeRegistry.get('nonexistentType')).toBeUndefined();
  });

  it('should handle field type registration errors', () => {
    const invalidFieldType = {
      // Missing required properties
    } as FieldType;

    expect(() => {
      FieldTypeRegistry.register(invalidFieldType);
    }).toThrow(FieldTypeRegistrationError);
  });

  it('should handle validation errors gracefully', async () => {
    const errorFieldType = new class implements FieldType {
      name = 'errorType';
      
      async validate() {
        throw new Error('Validation error');
      }
      
      serialize(value: any) {
        return value;
      }
      
      deserialize(data: any) {
        return data;
      }
    };

    FieldTypeRegistry.register(errorFieldType);

    const mockContext = FieldUtils.createMockContext();
    
    await expect(
      errorFieldType.validate('test', {}, mockContext)
    ).rejects.toThrow('Validation error');
  });

  it('should handle context errors in field evaluation', async () => {
    const field = defineField({
      name: 'test',
      type: 'string',
      required: (context) => {
        throw new Error('Context error');
      }
    });

    const mockContext = FieldUtils.createMockContext();

    await expect(FieldUtils.isRequired(field, mockContext)).rejects.toThrow('Context error');
  });
});