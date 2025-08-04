"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityValidator = void 0;
const index_js_1 = require("../errors/index.js");
class SecurityValidator {
    static validateCollectionName(name) {
        if (typeof name !== 'string') {
            throw new index_js_1.InvalidInputError('Collection name must be a string', 'collection');
        }
        if (!name || name.length === 0) {
            throw new index_js_1.InvalidInputError('Collection name cannot be empty', 'collection');
        }
        if (name.length > this.MAX_COLLECTION_NAME_LENGTH) {
            throw new index_js_1.InvalidInputError(`Collection name too long (max ${this.MAX_COLLECTION_NAME_LENGTH} characters)`, 'collection');
        }
        if (!this.COLLECTION_NAME_REGEX.test(name)) {
            throw new index_js_1.InvalidInputError('Collection name must start with a letter and contain only letters, numbers, underscores, and hyphens', 'collection');
        }
        // Prevent reserved names
        const reservedNames = ['admin', 'api', 'system', 'config', 'schema', 'migration'];
        if (reservedNames.includes(name.toLowerCase())) {
            throw new index_js_1.InvalidInputError(`Collection name '${name}' is reserved`, 'collection');
        }
    }
    static validateDocumentId(id) {
        if (typeof id !== 'string') {
            throw new index_js_1.InvalidInputError('Document ID must be a string', 'id');
        }
        if (!id || id.length === 0) {
            throw new index_js_1.InvalidInputError('Document ID cannot be empty', 'id');
        }
        if (id.length > this.MAX_ID_LENGTH) {
            throw new index_js_1.InvalidInputError(`Document ID too long (max ${this.MAX_ID_LENGTH} characters)`, 'id');
        }
        if (!this.ID_REGEX.test(id)) {
            throw new index_js_1.InvalidInputError('Document ID must contain only letters, numbers, underscores, and hyphens', 'id');
        }
    }
    static sanitizeListOptions(options) {
        if (!options || typeof options !== 'object') {
            return undefined;
        }
        const sanitized = {};
        // Sanitize limit
        if (options.limit !== undefined) {
            if (typeof options.limit !== 'number' || !Number.isInteger(options.limit)) {
                throw new index_js_1.InvalidInputError('Limit must be an integer', 'limit');
            }
            sanitized.limit = Math.min(Math.max(options.limit, 1), this.MAX_LIMIT);
        }
        // Sanitize offset
        if (options.offset !== undefined) {
            if (typeof options.offset !== 'number' || !Number.isInteger(options.offset)) {
                throw new index_js_1.InvalidInputError('Offset must be an integer', 'offset');
            }
            sanitized.offset = Math.max(options.offset, 0);
        }
        // Sanitize sort
        if (options.sort !== undefined) {
            if (typeof options.sort === 'string') {
                this.validateSortField(options.sort);
                sanitized.sort = options.sort;
            }
            else if (Array.isArray(options.sort)) {
                if (options.sort.length > this.MAX_SORT_FIELDS) {
                    throw new index_js_1.InvalidInputError(`Too many sort fields (max ${this.MAX_SORT_FIELDS})`, 'sort');
                }
                for (const field of options.sort) {
                    this.validateSortField(field);
                }
                sanitized.sort = options.sort.slice(0, this.MAX_SORT_FIELDS);
            }
            else {
                throw new index_js_1.InvalidInputError('Sort must be a string or array of strings', 'sort');
            }
        }
        // Sanitize filter
        if (options.filter !== undefined) {
            sanitized.filter = this.sanitizeFilter(options.filter);
        }
        return sanitized;
    }
    static validateSortField(field) {
        if (typeof field !== 'string') {
            throw new index_js_1.InvalidInputError('Sort field must be a string', 'sort');
        }
        const sortPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.(asc|desc))?$/;
        if (!sortPattern.test(field)) {
            throw new index_js_1.InvalidInputError('Invalid sort field format. Use "field" or "field.asc" or "field.desc"', 'sort');
        }
    }
    static sanitizeFilter(filter) {
        if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
            return {};
        }
        const sanitized = {};
        const filterObj = filter;
        // Limit filter depth and complexity
        const maxFilterKeys = 10;
        const keys = Object.keys(filterObj).slice(0, maxFilterKeys);
        for (const key of keys) {
            if (typeof key !== 'string' || key.length === 0) {
                continue;
            }
            // Validate field names
            if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(key)) {
                throw new index_js_1.InvalidInputError(`Invalid filter field name: ${key}`, 'filter');
            }
            // Prevent dangerous operators and properties
            const dangerousFields = ['__proto__', 'constructor', 'prototype'];
            if (key.startsWith('$') || dangerousFields.some(dangerous => key.includes(dangerous))) {
                throw new index_js_1.InvalidInputError(`Forbidden filter field: ${key}`, 'filter');
            }
            const value = filterObj[key];
            // Basic type validation for filter values
            if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
                if (Array.isArray(value)) {
                    // Allow simple arrays for "in" queries
                    sanitized[key] = value.slice(0, 100); // Limit array size
                }
                else if (typeof value === 'object') {
                    // Allow simple comparison objects
                    sanitized[key] = this.sanitizeFilterValue(value);
                }
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    static sanitizeFilterValue(value) {
        const allowedOperators = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin'];
        const sanitized = {};
        for (const [op, val] of Object.entries(value)) {
            if (allowedOperators.includes(op)) {
                // Basic validation for operator values
                if (['$in', '$nin'].includes(op) && Array.isArray(val)) {
                    sanitized[op] = val.slice(0, 100); // Limit array size
                }
                else if (val !== null && ['string', 'number', 'boolean'].includes(typeof val)) {
                    sanitized[op] = val;
                }
            }
        }
        return sanitized;
    }
    static validateDocumentData(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new index_js_1.InvalidInputError('Document data must be an object', 'data');
        }
        const dataObj = data;
        // Check for dangerous properties
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        for (const key of Object.keys(dataObj)) {
            if (dangerousKeys.includes(key)) {
                throw new index_js_1.InvalidInputError(`Forbidden property name: ${key}`, 'data');
            }
            // Validate field names
            if (typeof key !== 'string' || key.length === 0) {
                throw new index_js_1.InvalidInputError('Field names must be non-empty strings', 'data');
            }
            if (key.length > 100) {
                throw new index_js_1.InvalidInputError('Field name too long (max 100 characters)', 'data');
            }
            // Validate field name format (letters, numbers, underscores only)
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
                throw new index_js_1.InvalidInputError(`Invalid field name format: ${key}`, 'data');
            }
        }
        // Check object size
        const jsonString = JSON.stringify(data);
        if (jsonString.length > 10 * 1024 * 1024) { // 10MB limit
            throw new index_js_1.InvalidInputError('Document too large (max 10MB)', 'data');
        }
    }
    static validateUsername(username) {
        if (typeof username !== 'string') {
            throw new index_js_1.InvalidInputError('Username must be a string', 'username');
        }
        if (!username || username.length === 0) {
            throw new index_js_1.InvalidInputError('Username cannot be empty', 'username');
        }
        if (username.length < 3) {
            throw new index_js_1.InvalidInputError('Username must be at least 3 characters long', 'username');
        }
        if (username.length > 50) {
            throw new index_js_1.InvalidInputError('Username too long (max 50 characters)', 'username');
        }
        // Username can contain letters, numbers, underscores, and hyphens
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            throw new index_js_1.InvalidInputError('Username must contain only letters, numbers, underscores, and hyphens', 'username');
        }
        // Must start with a letter or number
        if (!/^[a-zA-Z0-9]/.test(username)) {
            throw new index_js_1.InvalidInputError('Username must start with a letter or number', 'username');
        }
        // Reserved usernames (system-level reservations, but allow admin for CMS)
        const reservedUsernames = [
            'root', 'system', 'api', 'www', 'mail', 'ftp',
            'user', 'guest', 'anonymous', 'test', 'demo', 'support', 'null', 'undefined'
        ];
        if (reservedUsernames.includes(username.toLowerCase())) {
            throw new index_js_1.InvalidInputError(`Username '${username}' is reserved`, 'username');
        }
    }
    static validateEmail(email) {
        if (typeof email !== 'string') {
            throw new index_js_1.InvalidInputError('Email must be a string', 'email');
        }
        if (!email || email.length === 0) {
            throw new index_js_1.InvalidInputError('Email cannot be empty', 'email');
        }
        if (email.length > 320) { // RFC 5321 limit
            throw new index_js_1.InvalidInputError('Email too long (max 320 characters)', 'email');
        }
        // Basic email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new index_js_1.InvalidInputError('Invalid email format', 'email');
        }
        // Check for dangerous characters
        const dangerousChars = ['<', '>', '"', "'", '&', '%', '$', '#', '!', '?', '*'];
        if (dangerousChars.some(char => email.includes(char))) {
            throw new index_js_1.InvalidInputError('Email contains invalid characters', 'email');
        }
        // Validate local part length (before @)
        const [localPart, domain] = email.split('@');
        if (localPart.length > 64) {
            throw new index_js_1.InvalidInputError('Email local part too long (max 64 characters)', 'email');
        }
        if (domain.length > 253) {
            throw new index_js_1.InvalidInputError('Email domain too long (max 253 characters)', 'email');
        }
    }
}
exports.SecurityValidator = SecurityValidator;
SecurityValidator.COLLECTION_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
SecurityValidator.ID_REGEX = /^[a-zA-Z0-9-_]+$/;
SecurityValidator.MAX_COLLECTION_NAME_LENGTH = 50;
SecurityValidator.MAX_ID_LENGTH = 100;
SecurityValidator.MAX_LIMIT = 1000;
SecurityValidator.MAX_SORT_FIELDS = 5;
