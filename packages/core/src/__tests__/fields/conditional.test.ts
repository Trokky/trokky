/**
 * Comprehensive tests for conditional expression evaluation
 */

import {
  ConditionalEvaluator,
  ConditionalEvaluationError,
  ConditionalUtils
} from '../../fields/conditional';
import {
  ConditionalExpression,
  FieldContext
} from '../../fields/field-type';

describe('ConditionalEvaluationError', () => {
  it('should create error with message', () => {
    const error = new ConditionalEvaluationError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ConditionalEvaluationError');
    expect(error.expression).toBeUndefined();
  });

  it('should create error with expression', () => {
    const expression: ConditionalExpression = {
      field: 'test',
      operator: 'equals',
      value: 'value'
    };
    const error = new ConditionalEvaluationError('Test error', expression);
    expect(error.expression).toBe(expression);
  });

  it('should be instance of Error', () => {
    const error = new ConditionalEvaluationError('Test error');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ConditionalEvaluator', () => {
  let mockContext: FieldContext;

  beforeEach(() => {
    mockContext = {
      document: {
        title: 'Test Document',
        status: 'published',
        featured: true,
        category: 'tech',
        rating: 4.5,
        tags: ['programming', 'javascript'],
        author: {
          id: 'user-1',
          name: 'John Doe'
        },
        publishedAt: '2023-01-01',
        views: 100,
        active: true
      },
      fieldPath: ['test'],
      user: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
        isActive: true,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      },
      permissions: ['read', 'write', 'admin'],
      userRole: 'admin',
      httpClient: {} as any,
      apiClient: {} as any,
      getValue: jest.fn((path: string) => {
        const keys = path.split('.');
        let value = mockContext.document;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      }),
      setValue: jest.fn(),
      getFieldConfig: jest.fn(),
      errors: [],
      touched: {},
      isStudio: true,
      isPreview: false,
      emit: jest.fn(),
      on: jest.fn()
    };
  });

  describe('Basic Field Conditions', () => {
    describe('equals operator', () => {
      it('should evaluate equals condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'status',
          operator: 'equals',
          value: 'published'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should evaluate equals condition with different value', () => {
        const expression: ConditionalExpression = {
          field: 'status',
          operator: 'equals',
          value: 'draft'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should handle null and undefined values', () => {
        const expression1: ConditionalExpression = {
          field: 'nonexistent',
          operator: 'equals',
          value: null
        };

        const expression2: ConditionalExpression = {
          field: 'nonexistent',
          operator: 'equals',
          value: undefined
        };

        expect(ConditionalEvaluator.evaluate(expression1, mockContext)).toBe(true);
        expect(ConditionalEvaluator.evaluate(expression2, mockContext)).toBe(true);
      });

      it('should handle array equality', () => {
        const expression: ConditionalExpression = {
          field: 'tags',
          operator: 'equals',
          value: ['programming', 'javascript']
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should handle object equality', () => {
        const expression: ConditionalExpression = {
          field: 'author',
          operator: 'equals',
          value: { id: 'user-1', name: 'John Doe' }
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should default to equals when no operator specified', () => {
        const expression: ConditionalExpression = {
          field: 'status',
          value: 'published'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });
    });

    describe('notEquals operator', () => {
      it('should evaluate notEquals condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'status',
          operator: 'notEquals',
          value: 'draft'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when values are equal', () => {
        const expression: ConditionalExpression = {
          field: 'status',
          operator: 'notEquals',
          value: 'published'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('in operator', () => {
      it('should evaluate in condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'category',
          operator: 'in',
          values: ['tech', 'science', 'news']
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when value not in array', () => {
        const expression: ConditionalExpression = {
          field: 'category',
          operator: 'in',
          values: ['sports', 'entertainment']
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should handle empty values array', () => {
        const expression: ConditionalExpression = {
          field: 'category',
          operator: 'in',
          values: []
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('notIn operator', () => {
      it('should evaluate notIn condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'category',
          operator: 'notIn',
          values: ['sports', 'entertainment']
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when value is in array', () => {
        const expression: ConditionalExpression = {
          field: 'category',
          operator: 'notIn',
          values: ['tech', 'science']
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('exists operator', () => {
      it('should evaluate exists condition correctly for existing field', () => {
        const expression: ConditionalExpression = {
          field: 'title',
          operator: 'exists'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false for non-existent field', () => {
        const expression: ConditionalExpression = {
          field: 'nonexistent',
          operator: 'exists'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should return false for null values', () => {
        // Mock getValue to return null
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'nullField') return null;
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'nullField',
          operator: 'exists'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('empty operator', () => {
      it('should evaluate empty condition for empty string', () => {
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'emptyString') return '';
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'emptyString',
          operator: 'empty'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should evaluate empty condition for whitespace string', () => {
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'whitespace') return '   ';
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'whitespace',
          operator: 'empty'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should evaluate empty condition for empty array', () => {
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'emptyArray') return [];
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'emptyArray',
          operator: 'empty'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should evaluate empty condition for empty object', () => {
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'emptyObject') return {};
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'emptyObject',
          operator: 'empty'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false for non-empty values', () => {
        const expression: ConditionalExpression = {
          field: 'title',
          operator: 'empty'
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });
  });

  describe('Numeric Comparisons', () => {
    describe('gt (greater than)', () => {
      it('should evaluate gt condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'gt',
          value: 4
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when not greater', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'gt',
          value: 5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should handle string numbers', () => {
        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'stringNumber') return '10';
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'stringNumber',
          operator: 'gt',
          value: 5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should handle Date objects', () => {
        const date1 = new Date('2023-01-01');
        const date2 = new Date('2022-12-31');

        (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
          if (path === 'dateField') return date1;
          return mockContext.document[path];
        });

        const expression: ConditionalExpression = {
          field: 'dateField',
          operator: 'gt',
          value: date2
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false for non-numeric values', () => {
        const expression: ConditionalExpression = {
          field: 'title',
          operator: 'gt',
          value: 100
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('lt (less than)', () => {
      it('should evaluate lt condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'lt',
          value: 5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when not less', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'lt',
          value: 4
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('gte (greater than or equal)', () => {
      it('should evaluate gte condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'gte',
          value: 4.5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return true when equal', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'gte',
          value: 4.5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });
    });

    describe('lte (less than or equal)', () => {
      it('should evaluate lte condition correctly', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'lte',
          value: 5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return true when equal', () => {
        const expression: ConditionalExpression = {
          field: 'rating',
          operator: 'lte',
          value: 4.5
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('Logical Operators', () => {
    describe('AND conditions', () => {
      it('should evaluate AND condition correctly when all are true', () => {
        const expression: ConditionalExpression = {
          field: '',
          and: [
            { field: 'status', operator: 'equals', value: 'published' },
            { field: 'featured', operator: 'equals', value: true }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when any condition is false', () => {
        const expression: ConditionalExpression = {
          field: '',
          and: [
            { field: 'status', operator: 'equals', value: 'published' },
            { field: 'featured', operator: 'equals', value: false }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should handle empty AND array', () => {
        const expression: ConditionalExpression = {
          field: '',
          and: []
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true); // Empty AND should be true
      });
    });

    describe('OR conditions', () => {
      it('should evaluate OR condition correctly when any is true', () => {
        const expression: ConditionalExpression = {
          field: '',
          or: [
            { field: 'status', operator: 'equals', value: 'draft' },
            { field: 'featured', operator: 'equals', value: true }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when all conditions are false', () => {
        const expression: ConditionalExpression = {
          field: '',
          or: [
            { field: 'status', operator: 'equals', value: 'draft' },
            { field: 'featured', operator: 'equals', value: false }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });

      it('should handle empty OR array', () => {
        const expression: ConditionalExpression = {
          field: '',
          or: []
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false); // Empty OR should be false
      });
    });

    describe('NOT conditions', () => {
      it('should evaluate NOT condition correctly', () => {
        const expression: ConditionalExpression = {
          field: '',
          not: {
            field: 'status',
            operator: 'equals',
            value: 'draft'
          }
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should return false when negated condition is true', () => {
        const expression: ConditionalExpression = {
          field: '',
          not: {
            field: 'status',
            operator: 'equals',
            value: 'published'
          }
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(false);
      });
    });

    describe('Complex nested conditions', () => {
      it('should evaluate nested AND/OR conditions', () => {
        const expression: ConditionalExpression = {
          field: '',
          and: [
            {
              field: '',
              or: [
                { field: 'status', operator: 'equals', value: 'published' },
                { field: 'status', operator: 'equals', value: 'scheduled' }
              ]
            },
            { field: 'featured', operator: 'equals', value: true }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });

      it('should evaluate deeply nested conditions', () => {
        const expression: ConditionalExpression = {
          field: '',
          and: [
            {
              field: '',
              or: [
                {
                  field: '',
                  and: [
                    { field: 'status', operator: 'equals', value: 'published' },
                    { field: 'category', operator: 'equals', value: 'tech' }
                  ]
                },
                { field: 'featured', operator: 'equals', value: true }
              ]
            },
            {
              field: '',
              not: {
                field: 'rating',
                operator: 'lt',
                value: 3
              }
            }
          ]
        };

        const result = ConditionalEvaluator.evaluate(expression, mockContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown operator', () => {
      const expression: ConditionalExpression = {
        field: 'status',
        operator: 'unknownOperator' as any,
        value: 'test'
      };

      expect(() => {
        ConditionalEvaluator.evaluate(expression, mockContext);
      }).toThrow(ConditionalEvaluationError);
    });

    it('should wrap evaluation errors', () => {
      // Mock getValue to throw an error
      (mockContext.getValue as jest.Mock).mockImplementation(() => {
        throw new Error('Field access error');
      });

      const expression: ConditionalExpression = {
        field: 'problematicField',
        operator: 'equals',
        value: 'test'
      };

      expect(() => {
        ConditionalEvaluator.evaluate(expression, mockContext);
      }).toThrow(ConditionalEvaluationError);
      
      try {
        ConditionalEvaluator.evaluate(expression, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(ConditionalEvaluationError);
        expect((error as ConditionalEvaluationError).expression).toBe(expression);
        expect(error.message).toContain('Failed to evaluate conditional expression');
      }
    });
  });

  describe('Path Navigation', () => {
    it('should handle nested field paths', () => {
      const expression: ConditionalExpression = {
        field: 'author.id',
        operator: 'equals',
        value: 'user-1'
      };

      const result = ConditionalEvaluator.evaluate(expression, mockContext);
      expect(result).toBe(true);
    });

    it('should handle deep nested paths', () => {
      (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
        if (path === 'deep.nested.field') return 'value';
        const keys = path.split('.');
        let value = mockContext.document;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      });

      const expression: ConditionalExpression = {
        field: 'deep.nested.field',
        operator: 'equals',
        value: 'value'
      };

      const result = ConditionalEvaluator.evaluate(expression, mockContext);
      expect(result).toBe(true);
    });

    it('should handle array index paths', () => {
      (mockContext.getValue as jest.Mock).mockImplementation((path: string) => {
        if (path === 'tags.0') return 'programming';
        if (path === 'tags.1') return 'javascript';
        return mockContext.document[path];
      });

      const expression: ConditionalExpression = {
        field: 'tags.0',
        operator: 'equals',
        value: 'programming'
      };

      const result = ConditionalEvaluator.evaluate(expression, mockContext);
      expect(result).toBe(true);
    });
  });
});

describe('ConditionalUtils', () => {
  describe('Helper Functions', () => {
    it('should create equals condition', () => {
      const condition = ConditionalUtils.equals('status', 'published');
      expect(condition).toEqual({
        field: 'status',
        operator: 'equals',
        value: 'published'
      });
    });

    it('should create notEquals condition', () => {
      const condition = ConditionalUtils.notEquals('status', 'draft');
      expect(condition).toEqual({
        field: 'status',
        operator: 'notEquals',
        value: 'draft'
      });
    });

    it('should create isIn condition', () => {
      const condition = ConditionalUtils.isIn('category', ['tech', 'science']);
      expect(condition).toEqual({
        field: 'category',
        operator: 'in',
        values: ['tech', 'science']
      });
    });

    it('should create exists condition', () => {
      const condition = ConditionalUtils.exists('title');
      expect(condition).toEqual({
        field: 'title',
        operator: 'exists'
      });
    });

    it('should create empty condition', () => {
      const condition = ConditionalUtils.empty('description');
      expect(condition).toEqual({
        field: 'description',
        operator: 'empty'
      });
    });

    it('should create AND condition', () => {
      const condition1 = ConditionalUtils.equals('status', 'published');
      const condition2 = ConditionalUtils.equals('featured', true);
      const andCondition = ConditionalUtils.and(condition1, condition2);

      expect(andCondition).toEqual({
        field: '',
        and: [condition1, condition2]
      });
    });

    it('should create OR condition', () => {
      const condition1 = ConditionalUtils.equals('status', 'published');
      const condition2 = ConditionalUtils.equals('status', 'scheduled');
      const orCondition = ConditionalUtils.or(condition1, condition2);

      expect(orCondition).toEqual({
        field: '',
        or: [condition1, condition2]
      });
    });

    it('should create NOT condition', () => {
      const condition = ConditionalUtils.equals('status', 'deleted');
      const notCondition = ConditionalUtils.not(condition);

      expect(notCondition).toEqual({
        field: '',
        not: condition
      });
    });
  });

  describe('Expression Validation', () => {
    it('should validate correct basic expression', () => {
      const expression: ConditionalExpression = {
        field: 'status',
        operator: 'equals',
        value: 'published'
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toHaveLength(0);
    });

    it('should validate missing field name', () => {
      const expression: ConditionalExpression = {
        field: '',
        operator: 'equals',
        value: 'published'
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain('Field name is required and must be a string');
    });

    it('should validate operators requiring values', () => {
      const expression: ConditionalExpression = {
        field: 'status',
        operator: 'equals'
        // Missing value
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain("Operator 'equals' requires a value");
    });

    it('should validate operators requiring values array', () => {
      const expression: ConditionalExpression = {
        field: 'category',
        operator: 'in'
        // Missing values array
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain("Operator 'in' requires a non-empty values array");
    });

    it('should validate empty values array', () => {
      const expression: ConditionalExpression = {
        field: 'category',
        operator: 'in',
        values: []
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain("Operator 'in' requires a non-empty values array");
    });

    it('should validate AND conditions', () => {
      const expression: ConditionalExpression = {
        field: '',
        and: []
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain('AND condition must have at least one expression');
    });

    it('should validate OR conditions', () => {
      const expression: ConditionalExpression = {
        field: '',
        or: []
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain('OR condition must have at least one expression');
    });

    it('should validate nested conditions', () => {
      const expression: ConditionalExpression = {
        field: '',
        and: [
          {
            field: '',
            operator: 'equals',
            value: 'test'
          }
        ]
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain('AND[0]: Field name is required and must be a string');
    });

    it('should validate NOT conditions', () => {
      const expression: ConditionalExpression = {
        field: '',
        not: {
          field: '',
          operator: 'equals',
          value: 'test'
        }
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors).toContain('NOT: Field name is required and must be a string');
    });

    it('should validate complex nested structure', () => {
      const expression: ConditionalExpression = {
        field: '',
        and: [
          {
            field: '',
            or: [
              {
                field: 'valid',
                operator: 'equals',
                value: 'test'
              },
              {
                field: '',
                operator: 'equals'
                // Missing value and field
              }
            ]
          }
        ]
      };

      const errors = ConditionalUtils.validate(expression);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Field name is required'))).toBe(true);
      expect(errors.some(e => e.includes('requires a value'))).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should work with real-world conditional expressions', () => {
    const mockContext: FieldContext = {
      document: {
        type: 'article',
        status: 'published',
        featured: true,
        category: 'technology',
        author: {
          role: 'editor',
          experience: 5
        },
        publishedAt: '2023-01-01',
        tags: ['javascript', 'react', 'frontend']
      },
      fieldPath: ['test'],
      user: {} as any,
      permissions: [],
      userRole: 'admin',
      httpClient: {} as any,
      apiClient: {} as any,
      getValue: jest.fn((path: string) => {
        const keys = path.split('.');
        let value = mockContext.document;
        for (const key of keys) {
          value = value?.[key];
        }
        return value;
      }),
      setValue: jest.fn(),
      getFieldConfig: jest.fn(),
      errors: [],
      touched: {},
      isStudio: true,
      isPreview: false,
      emit: jest.fn(),
      on: jest.fn()
    };

    // Complex business rule: Show advanced options if:
    // - Article is featured AND published
    // - Author is experienced (5+ years) OR is an editor
    // - Category is technology
    const expression = ConditionalUtils.and(
      ConditionalUtils.and(
        ConditionalUtils.equals('featured', true),
        ConditionalUtils.equals('status', 'published')
      ),
      ConditionalUtils.or(
        ConditionalUtils.gte('author.experience', 5),
        ConditionalUtils.equals('author.role', 'editor')
      ),
      ConditionalUtils.equals('category', 'technology')
    );

    const result = ConditionalEvaluator.evaluate(expression, mockContext);
    expect(result).toBe(true);
  });

  it('should handle dynamic content conditions', () => {
    const mockContext: FieldContext = {
      document: {
        contentType: 'video',
        duration: 300, // 5 minutes
        views: 1000,
        likes: 50,
        engagement: 0.05 // 5%
      },
      fieldPath: ['test'],
      user: {} as any,
      permissions: [],
      userRole: 'admin',
      httpClient: {} as any,
      apiClient: {} as any,
      getValue: jest.fn((path: string) => mockContext.document[path]),
      setValue: jest.fn(),
      getFieldConfig: jest.fn(),
      errors: [],
      touched: {},
      isStudio: true,
      isPreview: false,
      emit: jest.fn(),
      on: jest.fn()
    };

    // Show monetization options if:
    // - Video content longer than 2 minutes
    // - Has good engagement (>3%)
    // - Has sufficient views (>500)
    const expression = ConditionalUtils.and(
      ConditionalUtils.equals('contentType', 'video'),
      ConditionalUtils.gt('duration', 120),
      ConditionalUtils.gt('engagement', 0.03),
      ConditionalUtils.gt('views', 500)
    );

    const result = ConditionalEvaluator.evaluate(expression, mockContext);
    expect(result).toBe(true);
  });
});

describe('Performance Tests', () => {
  it('should handle large conditional expressions efficiently', () => {
    const mockContext: FieldContext = {
      document: { value: 'test' },
      fieldPath: ['test'],
      user: {} as any,
      permissions: [],
      userRole: 'admin',
      httpClient: {} as any,
      apiClient: {} as any,
      getValue: jest.fn(() => 'test'),
      setValue: jest.fn(),
      getFieldConfig: jest.fn(),
      errors: [],
      touched: {},
      isStudio: true,
      isPreview: false,
      emit: jest.fn(),
      on: jest.fn()
    };

    // Create a large OR expression with many conditions
    const conditions = Array.from({ length: 1000 }, (_, i) => 
      ConditionalUtils.equals('value', `test${i}`)
    );
    conditions[0] = ConditionalUtils.equals('value', 'test'); // Make first one match

    const largeExpression = ConditionalUtils.or(...conditions);

    const startTime = performance.now();
    const result = ConditionalEvaluator.evaluate(largeExpression, mockContext);
    const endTime = performance.now();

    expect(result).toBe(true);
    expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
  });

  it('should handle deeply nested expressions efficiently', () => {
    const mockContext: FieldContext = {
      document: { value: true },
      fieldPath: ['test'],
      user: {} as any,
      permissions: [],
      userRole: 'admin',
      httpClient: {} as any,
      apiClient: {} as any,
      getValue: jest.fn(() => true),
      setValue: jest.fn(),
      getFieldConfig: jest.fn(),
      errors: [],
      touched: {},
      isStudio: true,
      isPreview: false,
      emit: jest.fn(),
      on: jest.fn()
    };

    // Create deeply nested AND/OR structure
    let expression: ConditionalExpression = ConditionalUtils.equals('value', true);
    
    for (let i = 0; i < 50; i++) {
      expression = ConditionalUtils.and(
        expression,
        ConditionalUtils.equals('value', true)
      );
    }

    const startTime = performance.now();
    const result = ConditionalEvaluator.evaluate(expression, mockContext);
    const endTime = performance.now();

    expect(result).toBe(true);
    expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
  });
});