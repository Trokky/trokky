"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrokkyCore = void 0;
const adapter_js_1 = require("../crypto/adapter.js");
const registry_js_1 = require("../schema/registry.js");
const validator_js_1 = require("../validation/validator.js");
const validation_js_1 = require("../security/validation.js");
const rate_limiter_js_1 = require("../security/rate-limiter.js");
const id_generator_js_1 = require("../utils/id-generator.js");
const logger_js_1 = require("../utils/logger.js");
const image_processor_js_1 = require("../media/image-processor.js");
const index_js_1 = require("../errors/index.js");
class TrokkyCore {
    constructor(config, storageAdapter, options = {}) {
        this.logger = (0, logger_js_1.createLogger)('core', 'TrokkyCore');
        this.auditLog = (0, logger_js_1.createLogger)('core', 'Audit');
        this.storage = storageAdapter;
        this.options = options;
        this.schemas = options.schemaRegistry || new registry_js_1.SchemaRegistry(config.schemas);
        this.validator = options.validator || new validator_js_1.DocumentValidator(this.schemas);
        this.idGenerator = options.idGenerator || new id_generator_js_1.IdGenerator();
        this.securityEnabled = options.enableSecurity ?? config.security?.validateInput ?? true;
        // Initialize JWT secret (use provided secret, environment variable, or generate one)
        this.jwtSecret = options.jwtSecret ||
            process.env.TROKKY_JWT_SECRET ||
            this.generateSecureSecret();
        // Initialize audit logger
        this.auditLogger = options.auditLogger;
        // Initialize crypto adapter
        this.cryptoAdapter = options.cryptoAdapter || (0, adapter_js_1.detectCryptoAdapter)({
            ...options.cryptoOptions,
            adapterType: options.cryptoOptions?.adapterType || 'auto'
        });
        // Initialize image processor from config or options
        const imageProcessorConfig = options.imageProcessorConfig || {
            type: config.media?.imageProcessor || 'none',
            variants: config.media?.imageVariants || [],
            options: config.media?.imageProcessorOptions || {}
        };
        this.imageProcessor = options.imageProcessor || (0, image_processor_js_1.createImageProcessor)(imageProcessorConfig);
        if (config.security?.rateLimitEnabled || config.api?.rateLimit) {
            const rateLimitConfig = {
                windowMs: config.api?.rateLimit?.windowMs || 60 * 1000,
                maxRequests: config.api?.rateLimit?.maxRequests || 1000
            };
            this.rateLimiter = options.rateLimiter || new rate_limiter_js_1.RateLimiter(rateLimitConfig);
        }
    }
    // Initialization
    async init() {
        // Setup admin user from environment variables if configured
        if (this.options.setupAdminFromEnv) {
            await this.setupAdminFromEnv();
        }
    }
    // Document operations
    async getDocument(collection, id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getDocument');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateCollectionName(collection);
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.schemas.hasSchema(collection)) {
            throw new index_js_1.SchemaNotFoundError(collection);
        }
        const document = await this.storage.getDocument(collection, id);
        return document;
    }
    async saveDocument(collection, data) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('saveDocument');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateCollectionName(collection);
            validation_js_1.SecurityValidator.validateDocumentData(data);
            if (data.id) {
                validation_js_1.SecurityValidator.validateDocumentId(data.id);
            }
        }
        if (!this.schemas.hasSchema(collection)) {
            throw new index_js_1.SchemaNotFoundError(collection);
        }
        // Validate document against schema
        const validation = this.validateDocument(collection, data);
        if (!validation.valid) {
            throw new index_js_1.ValidationError('Document validation failed', validation.errors);
        }
        // Generate ID if not provided
        const id = data.id || this.idGenerator.generate({ prefix: collection });
        const { id: _, ...documentData } = data;
        const savedDocument = await this.storage.saveDocument(collection, id, documentData);
        return savedDocument;
    }
    async listDocuments(collection, options) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('listDocuments');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateCollectionName(collection);
        }
        if (!this.schemas.hasSchema(collection)) {
            throw new index_js_1.SchemaNotFoundError(collection);
        }
        const sanitizedOptions = this.securityEnabled
            ? validation_js_1.SecurityValidator.sanitizeListOptions(options)
            : options;
        const documents = await this.storage.listDocuments(collection, sanitizedOptions);
        return documents;
    }
    async deleteDocument(collection, id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('deleteDocument');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateCollectionName(collection);
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.schemas.hasSchema(collection)) {
            throw new index_js_1.SchemaNotFoundError(collection);
        }
        // Check if document exists
        const existingDocument = await this.storage.getDocument(collection, id);
        if (!existingDocument) {
            throw new index_js_1.DocumentNotFoundError(collection, id);
        }
        return await this.storage.deleteDocument(collection, id);
    }
    // Media operations
    async uploadMedia(file) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('uploadMedia');
        }
        if (this.securityEnabled) {
            this.validateMediaFile(file);
        }
        const metadata = {
            id: this.idGenerator.generate({ prefix: 'media' }),
            filename: file.name,
            contentType: file.type,
            size: file.size,
            extension: this.getFileExtension(file.name)
        };
        // Upload to storage first
        const mediaFile = await this.storage.uploadFile(file, metadata);
        // Process image if it's an image file
        if (file.type.startsWith('image/')) {
            try {
                const processedImage = await this.imageProcessor.processImage(file, {
                    id: metadata.id,
                    filename: metadata.filename,
                    path: mediaFile.url
                });
                // Save variant files directly to storage without creating separate MediaFile records
                const savedVariants = {};
                for (const [variantName, variantData] of Object.entries(processedImage.variants)) {
                    if (variantData.buffer) {
                        try {
                            // Save variant file directly using storage adapter's variant support
                            if (this.storage.saveVariantFile) {
                                const variantPath = await this.storage.saveVariantFile(metadata.id, variantName, variantData.buffer, variantData.format);
                                // Store variant info with the correct URL
                                savedVariants[variantName] = {
                                    url: `${this.storage.getVariantUrl ? this.storage.getVariantUrl(metadata.id, variantName) : variantPath}`,
                                    width: variantData.width,
                                    height: variantData.height,
                                    format: variantData.format,
                                    size: variantData.size
                                };
                                this.logger.info('Variant file saved directly', {
                                    parentId: metadata.id,
                                    variantName,
                                    path: variantPath
                                });
                            }
                            else {
                                // Fallback: just store metadata without physical files for now
                                savedVariants[variantName] = {
                                    url: variantData.url,
                                    width: variantData.width,
                                    height: variantData.height,
                                    format: variantData.format,
                                    size: variantData.size
                                };
                                this.logger.warn('Storage adapter does not support variant files - storing metadata only', {
                                    parentId: metadata.id,
                                    variantName
                                });
                            }
                        }
                        catch (variantError) {
                            this.logger.warn('Failed to save variant file', {
                                parentId: metadata.id,
                                variantName,
                                error: variantError instanceof Error ? variantError.message : 'Unknown error'
                            });
                        }
                    }
                }
                // Store processed image metadata in the media file
                mediaFile.metadata = {
                    ...mediaFile.metadata,
                    imageVariants: savedVariants,
                    originalDimensions: {
                        width: processedImage.original.width,
                        height: processedImage.original.height
                    }
                };
                // Save the updated metadata back to storage
                try {
                    if (this.storage.updateFile) {
                        await this.storage.updateFile(mediaFile.id, mediaFile.metadata);
                    }
                    this.logger.info('Image variants metadata saved', {
                        fileId: metadata.id,
                        variantCount: Object.keys(processedImage.variants).length
                    });
                }
                catch (updateError) {
                    this.logger.warn('Failed to save image variants metadata', {
                        fileId: metadata.id,
                        error: updateError instanceof Error ? updateError.message : 'Unknown error'
                    });
                }
            }
            catch (error) {
                // Log error but don't fail the upload - image processing is optional
                this.logger.warn('Image processing failed', {
                    fileId: metadata.id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return mediaFile;
    }
    async getMedia(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getMedia');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        return await this.storage.getFile(id);
    }
    async updateMedia(id, metadata) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('updateMedia');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        // Check if media exists first
        const existingMedia = await this.storage.getFile(id);
        if (!existingMedia) {
            throw new index_js_1.DocumentNotFoundError('media', id);
        }
        // Use the storage adapter's updateFile method if available
        if (!this.storage.updateFile) {
            throw new Error('Media update not supported by storage adapter');
        }
        return await this.storage.updateFile(id, metadata);
    }
    async getMediaContent(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getMediaContent');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        return await this.storage.getFileContent(id);
    }
    async listMedia(options) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('listMedia');
        }
        // Use the storage adapter's listMedia method if available
        if (!this.storage.listMedia) {
            throw new Error('Media listing not supported by storage adapter');
        }
        return await this.storage.listMedia(options || {});
    }
    async deleteMedia(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('deleteMedia');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        // Check if media exists
        const existingMedia = await this.storage.getFile(id);
        if (!existingMedia) {
            throw new index_js_1.DocumentNotFoundError('media', id);
        }
        // Delete image variants if it's an image
        if (existingMedia.contentType.startsWith('image/')) {
            try {
                await this.imageProcessor.deleteImage(id);
            }
            catch (error) {
                // Log error but don't fail the deletion - variants cleanup is optional
                this.logger.warn('Image variants cleanup failed', {
                    fileId: id,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        return await this.storage.deleteFile(id);
    }
    async regenerateMediaVariants(id) {
        try {
            await this.rateLimiter?.checkRateLimit('regenerateMediaVariants');
            // Get the existing media file
            const mediaFile = await this.storage.getFile(id);
            if (!mediaFile) {
                throw new Error(`Media file with id ${id} not found`);
            }
            // Check if it's an image file
            if (!mediaFile.contentType.startsWith('image/')) {
                throw new index_js_1.InvalidInputError('Variant regeneration is only supported for image files', 'contentType');
            }
            this.logger.info('Starting variant regeneration', { id, filename: mediaFile.filename });
            // Get the original file content
            const fileContent = await this.storage.getFileContent(id);
            if (!fileContent) {
                throw new Error('Unable to read original file content');
            }
            // Convert ArrayBuffer to File object for image processing
            const file = new File([new Uint8Array(fileContent)], mediaFile.filename, {
                type: mediaFile.contentType
            });
            // Process the image to generate new variants
            const processedImage = await this.imageProcessor.processImage(file, {
                id: mediaFile.id,
                filename: mediaFile.filename,
                path: mediaFile.url
            });
            // Delete existing variants first
            if (this.storage.deleteVariantFiles) {
                try {
                    await this.storage.deleteVariantFiles(id);
                    this.logger.info('Existing variants deleted', { id });
                }
                catch (deleteError) {
                    this.logger.warn('Failed to delete existing variants', { id, error: deleteError });
                }
            }
            // Save new variant files
            const savedVariants = {};
            for (const [variantName, variantData] of Object.entries(processedImage.variants)) {
                if (variantData.buffer) {
                    try {
                        if (this.storage.saveVariantFile) {
                            const variantPath = await this.storage.saveVariantFile(id, variantName, variantData.buffer, variantData.format);
                            savedVariants[variantName] = {
                                url: `${this.storage.getVariantUrl ? this.storage.getVariantUrl(id, variantName) : variantPath}`,
                                width: variantData.width,
                                height: variantData.height,
                                format: variantData.format,
                                size: variantData.size
                            };
                            this.logger.info('New variant saved', {
                                parentId: id,
                                variantName,
                                path: variantPath
                            });
                        }
                    }
                    catch (variantError) {
                        this.logger.warn('Failed to save new variant', {
                            parentId: id,
                            variantName,
                            error: variantError instanceof Error ? variantError.message : 'Unknown error'
                        });
                    }
                }
            }
            // Update metadata with new variants
            const updatedMetadata = {
                ...mediaFile.metadata,
                imageVariants: savedVariants,
                originalDimensions: {
                    width: processedImage.original.width,
                    height: processedImage.original.height
                }
            };
            // Save updated metadata
            const updatedMediaFile = await this.storage.updateFile?.(id, updatedMetadata);
            if (!updatedMediaFile) {
                throw new Error('Failed to update media file metadata');
            }
            this.logger.info('Variants regenerated successfully', {
                id,
                variantCount: Object.keys(savedVariants).length
            });
            return updatedMediaFile;
        }
        catch (error) {
            this.logger.error('Failed to regenerate variants', {
                id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    // Schema operations
    getSchema(name) {
        return this.schemas.getSchema(name);
    }
    getAllSchemas() {
        return this.schemas.getAllSchemas();
    }
    validateDocument(collection, data) {
        return this.validator.validateDocument(collection, data);
    }
    // Image processing operations
    getImageUrl(imageId, variantName) {
        return this.imageProcessor.getImageUrl(imageId, variantName);
    }
    async getImageProcessor() {
        return this.imageProcessor;
    }
    /**
     * Get storage adapter
     */
    getStorageAdapter() {
        return this.storage;
    }
    // Health check
    async healthCheck() {
        try {
            const storageHealthy = await this.storage.healthCheck();
            const schemasLoaded = this.schemas.getAllSchemas().length > 0;
            const imageProcessorHealthy = await this.imageProcessor.healthCheck();
            return storageHealthy && schemasLoaded && imageProcessorHealthy;
        }
        catch {
            return false;
        }
    }
    // Utility methods
    validateMediaFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm',
            'audio/mp3', 'audio/wav', 'audio/ogg',
            'application/pdf', 'text/plain'
        ];
        if (file.size > maxSize) {
            throw new index_js_1.InvalidInputError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 'file');
        }
        if (!allowedTypes.includes(file.type)) {
            throw new index_js_1.InvalidInputError(`File type not allowed: ${file.type}`, 'file');
        }
        // Validate filename
        if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
            throw new index_js_1.InvalidInputError('Invalid filename characters', 'file');
        }
    }
    getFileExtension(filename) {
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop() : '';
    }
    // User management operations (system entities)
    async createUser(userData) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('createUser');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateEmail(userData.email);
            validation_js_1.SecurityValidator.validateUsername(userData.username);
        }
        if (!this.storage.saveUser) {
            throw new Error('User operations not supported by storage adapter');
        }
        // Check if user already exists
        const existingUserByEmail = await this.getUserByEmail(userData.email);
        if (existingUserByEmail) {
            throw new Error(`User with email ${userData.email} already exists`);
        }
        const existingUserByUsername = await this.getUserByUsername(userData.username);
        if (existingUserByUsername) {
            throw new Error(`User with username ${userData.username} already exists`);
        }
        // Hash password before saving
        const passwordHash = await this.hashPassword(userData.password);
        const userId = this.idGenerator.generate({ prefix: 'user' });
        const now = new Date().toISOString();
        const userToSave = {
            username: userData.username,
            email: userData.email,
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role,
            permissions: userData.permissions || this.getDefaultPermissions(userData.role),
            isActive: userData.isActive ?? true,
            profileImage: userData.profileImage,
            preferences: userData.preferences || {},
            createdAt: now,
            updatedAt: now
        };
        const createdUser = await this.storage.saveUser(userId, userToSave);
        // Log audit event
        this.logAuditEvent({
            type: 'user_created',
            targetUserId: userId,
            username: userData.username,
            action: `User created with role: ${userData.role}`,
            timestamp: new Date().toISOString(),
            success: true,
            details: {
                email: userData.email,
                role: userData.role,
                permissions: userData.permissions || this.getDefaultPermissions(userData.role)
            }
        });
        return createdUser;
    }
    async getUser(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getUser');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.storage.getUser) {
            throw new Error('User operations not supported by storage adapter');
        }
        return await this.storage.getUser(id);
    }
    async getUserByUsername(username) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getUserByUsername');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateUsername(username);
        }
        if (!this.storage.getUserByUsername) {
            throw new Error('User operations not supported by storage adapter');
        }
        return await this.storage.getUserByUsername(username);
    }
    async getUserByEmail(email) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getUserByEmail');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateEmail(email);
        }
        if (!this.storage.getUserByEmail) {
            throw new Error('User operations not supported by storage adapter');
        }
        return await this.storage.getUserByEmail(email);
    }
    async updateUser(id, userData) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('updateUser');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
            if (userData.email)
                validation_js_1.SecurityValidator.validateEmail(userData.email);
            if (userData.username)
                validation_js_1.SecurityValidator.validateUsername(userData.username);
        }
        if (!this.storage.saveUser) {
            throw new Error('User operations not supported by storage adapter');
        }
        const existingUser = await this.getUser(id);
        if (!existingUser) {
            throw new index_js_1.DocumentNotFoundError('users', id);
        }
        const updatedUserData = {
            ...userData,
            updatedAt: new Date().toISOString()
        };
        const updatedUser = await this.storage.saveUser(id, updatedUserData);
        // Log audit event
        this.logAuditEvent({
            type: 'user_updated',
            targetUserId: id,
            username: existingUser.username,
            action: `User updated`,
            timestamp: new Date().toISOString(),
            success: true,
            details: {
                updatedFields: Object.keys(userData),
                previousRole: existingUser.role,
                newRole: userData.role || existingUser.role
            }
        });
        return updatedUser;
    }
    async listUsers(options) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('listUsers');
        }
        if (!this.storage.listUsers) {
            throw new Error('User operations not supported by storage adapter');
        }
        return await this.storage.listUsers(options);
    }
    async deleteUser(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('deleteUser');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.storage.deleteUser) {
            throw new Error('User operations not supported by storage adapter');
        }
        const existingUser = await this.getUser(id);
        if (!existingUser) {
            throw new index_js_1.DocumentNotFoundError('users', id);
        }
        await this.storage.deleteUser(id);
        // Log audit event
        this.logAuditEvent({
            type: 'user_deleted',
            targetUserId: id,
            username: existingUser.username,
            action: `User deleted`,
            timestamp: new Date().toISOString(),
            success: true,
            details: {
                email: existingUser.email,
                role: existingUser.role
            }
        });
    }
    // App Token management operations
    async listAppTokens(options) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('listAppTokens');
        }
        if (!this.storage.listAppTokens) {
            throw new Error('App token operations not supported by storage adapter');
        }
        return await this.storage.listAppTokens(options);
    }
    async createAppToken(tokenData, createdBy) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('createAppToken');
        }
        if (!this.storage.saveAppToken) {
            throw new Error('App token operations not supported by storage adapter');
        }
        try {
            // Generate token and hash using crypto adapter
            const token = this.cryptoAdapter.generateSecureRandom(32);
            const tokenHash = await this.cryptoAdapter.hashPassword(token);
            const now = new Date().toISOString();
            const tokenId = this.idGenerator.generate();
            const appToken = {
                id: tokenId,
                name: tokenData.name,
                description: tokenData.description,
                tokenHash,
                permissions: tokenData.permissions,
                isActive: true,
                createdAt: now,
                updatedAt: now,
                createdBy,
                lastUsedAt: undefined,
                expiresAt: tokenData.expiresAt
            };
            const savedToken = await this.storage.saveAppToken(tokenId, appToken);
            return {
                success: true,
                token, // Plain text token (only returned once)
                appToken: savedToken
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create app token'
            };
        }
    }
    async getAppToken(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('getAppToken');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.storage.getAppToken) {
            throw new Error('App token operations not supported by storage adapter');
        }
        return await this.storage.getAppToken(id);
    }
    async deleteAppToken(id) {
        if (this.rateLimiter) {
            await this.rateLimiter.checkRateLimit('deleteAppToken');
        }
        if (this.securityEnabled) {
            validation_js_1.SecurityValidator.validateDocumentId(id);
        }
        if (!this.storage.deleteAppToken) {
            throw new Error('App token operations not supported by storage adapter');
        }
        const existingToken = await this.getAppToken(id);
        if (!existingToken) {
            throw new index_js_1.DocumentNotFoundError('tokens', id);
        }
        await this.storage.deleteAppToken(id);
        // Log audit event
        this.logAuditEvent({
            type: 'app_token_deleted',
            targetTokenId: id,
            tokenName: existingToken.name,
            action: `App token deleted`,
            timestamp: new Date().toISOString(),
            success: true,
            details: {
                permissions: existingToken.permissions,
                createdBy: existingToken.createdBy
            }
        });
    }
    // Authentication utilities
    async verifyPassword(plainPassword, hashedPassword) {
        return await this.cryptoAdapter.verifyPassword(plainPassword, hashedPassword);
    }
    async hashPassword(password) {
        return await this.cryptoAdapter.hashPassword(password);
    }
    getDefaultPermissions(role) {
        switch (role) {
            case 'admin':
                return ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access'];
            case 'editor':
                return ['content:read', 'content:write', 'media:upload', 'studio:access'];
            case 'viewer':
                return ['content:read', 'studio:access'];
            default:
                return ['content:read', 'studio:access'];
        }
    }
    checkWeakPassword(password) {
        // Common weak passwords
        const commonPasswords = [
            'password', 'admin', 'changeme', 'changeme123', '123456',
            'qwerty', 'abc123', 'password123', 'admin123', 'letmein',
            'welcome', 'monkey', 'dragon', 'master', 'secret'
        ];
        // Check if password is too short
        if (password.length < 8) {
            return { isWeak: true, reason: 'Password is too short (minimum 8 characters)' };
        }
        // Check for common weak passwords
        if (commonPasswords.includes(password.toLowerCase())) {
            return { isWeak: true, reason: 'Password is a common weak password' };
        }
        // Check for simple patterns
        if (/^(.)\1+$/.test(password)) {
            return { isWeak: true, reason: 'Password contains only repeated characters' };
        }
        if (/^(012|123|234|345|456|567|678|789|890|abc|def|qwe|asd|zxc)/i.test(password)) {
            return { isWeak: true, reason: 'Password contains sequential characters' };
        }
        // Warn if password is short (8-11 characters) even if not technically weak
        if (password.length < 12) {
            return { isWeak: true, reason: 'Password is shorter than recommended (12+ characters)' };
        }
        // Check password complexity
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const complexityCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
        if (complexityCount < 3) {
            return { isWeak: true, reason: 'Password lacks complexity (needs lowercase, uppercase, numbers, and/or symbols)' };
        }
        return { isWeak: false };
    }
    // JWT Token Management
    async generateAuthToken(user, expiresIn = '24h') {
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions
        };
        return await this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn });
    }
    async verifyAuthToken(token) {
        const decoded = await this.cryptoAdapter.verifyJWT(token, this.jwtSecret);
        if (!decoded || !decoded.userId || !decoded.username || !decoded.role || !decoded.permissions) {
            return null;
        }
        return {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            permissions: decoded.permissions,
            loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
            expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
        };
    }
    async authenticateUser(username, password, options = {}) {
        try {
            // Get user by username
            const user = await this.getUserByUsername(username);
            if (!user || !user.isActive) {
                return null;
            }
            // Verify password
            const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
            if (!isPasswordValid) {
                return null;
            }
            // Update last login time
            await this.updateUser(user.id, { lastLoginAt: new Date().toISOString() });
            // Generate tokens - different expiry times based on rememberMe
            const tokenExpiresIn = options.rememberMe ? '7d' : '2h'; // 2 hours for normal sessions
            const refreshTokenExpiresIn = options.rememberMe ? '30d' : '7d'; // 7 days for refresh tokens
            const token = await this.generateAuthToken(user, tokenExpiresIn);
            const refreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn);
            // Log successful login
            this.logAuditEvent({
                type: 'user_login',
                userId: user.id,
                username: user.username,
                action: 'User authenticated successfully',
                timestamp: new Date().toISOString(),
                success: true,
                details: {
                    role: user.role,
                    lastLoginAt: new Date().toISOString(),
                    rememberMe: options.rememberMe
                }
            });
            // Return user without password hash
            const { passwordHash, ...safeUser } = user;
            return {
                user: { ...safeUser, passwordHash: '' }, // Keep type but empty the hash
                token,
                refreshToken
            };
        }
        catch (error) {
            console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    async refreshAuthToken(refreshToken) {
        try {
            // Verify the refresh token
            const session = await this.verifyAuthToken(refreshToken);
            if (!session) {
                return null;
            }
            // Get the user
            const user = await this.getUser(session.userId);
            if (!user || !user.isActive) {
                return null;
            }
            // Generate new tokens with consistent expiration times
            const newToken = await this.generateAuthToken(user, '2h'); // Match login token expiry
            const newRefreshToken = await this.generateAuthToken(user, '7d'); // Match refresh token expiry
            // Get the new token's expiration time
            const newSession = await this.verifyAuthToken(newToken);
            const expiresAt = newSession?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            return {
                token: newToken,
                refreshToken: newRefreshToken,
                user,
                expiresAt
            };
        }
        catch (error) {
            this.logger.error('Failed to refresh auth token', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    generateSecureSecret() {
        // Generate a cryptographically secure random secret using crypto adapter
        // This will be called during initialization, but we need to create a temporary adapter
        const tempAdapter = (0, adapter_js_1.detectCryptoAdapter)();
        const secret = tempAdapter.generateSecureRandom(64);
        // Warn if using generated secret (should use environment variable in production)
        if (process.env.NODE_ENV !== 'test') {
            console.warn('⚠️  Using auto-generated JWT secret. Set TROKKY_JWT_SECRET environment variable for production.');
        }
        return secret;
    }
    logAuditEvent(event) {
        // Always call custom audit logger if provided
        if (this.auditLogger) {
            this.auditLogger(event);
        }
        // Log through our structured logger system
        const logData = {
            type: event.type,
            action: event.action,
            user: event.username,
            target: event.targetUserId,
            timestamp: event.timestamp,
            ...event.details
        };
        if (event.success) {
            this.auditLog.info(`${event.type}: ${event.action}`, logData);
        }
        else {
            this.auditLog.warn(`${event.type}: ${event.action} - FAILED`, logData);
        }
    }
    // Development utility: Setup admin user from environment variables
    async setupAdminFromEnv() {
        const adminEmail = process.env.TROKKY_ADMIN_EMAIL;
        const adminPassword = process.env.TROKKY_ADMIN_PASSWORD;
        // Only proceed if environment variables are set
        if (!adminEmail || !adminPassword) {
            return null;
        }
        // Check if any users exist
        try {
            const existingUsers = await this.listUsers({ limit: 1 });
            if (existingUsers.length > 0) {
                // Users already exist, don't create admin
                return null;
            }
        }
        catch (error) {
            // If user operations aren't supported, skip
            if (error instanceof Error && error.message.includes('not supported by storage adapter')) {
                return null;
            }
            throw error;
        }
        // Create admin user from environment variables
        const adminUser = await this.createUser({
            username: 'admin',
            email: adminEmail,
            password: adminPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'admin',
            permissions: ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access'],
            isActive: true,
            preferences: {
                theme: 'dark',
                language: 'en'
            }
        });
        // Log admin creation with security warning
        if (process.env.NODE_ENV !== 'test') {
            console.log('🔧 Admin user created from environment variables');
            console.log(`   Email: ${adminEmail}`);
            console.log('   Username: admin');
            // Enhanced password strength warnings
            const isWeakPassword = this.checkWeakPassword(adminPassword);
            if (isWeakPassword.isWeak) {
                console.warn('');
                console.warn('🚨 SECURITY WARNING: Weak admin password detected!');
                console.warn(`   Reason: ${isWeakPassword.reason}`);
                console.warn('   Please use a strong password with:');
                console.warn('   • At least 12 characters');
                console.warn('   • Mixed case letters (A-z)');
                console.warn('   • Numbers (0-9)');
                console.warn('   • Special characters (!@#$%^&*)');
                console.warn('   • No common words or patterns');
                if (process.env.NODE_ENV === 'production') {
                    console.warn('🔥 CRITICAL: Change this password immediately in production!');
                }
            }
            else {
                console.log('✅ Password strength check passed');
            }
            console.log('');
        }
        return adminUser;
    }
    // Rate limiter cleanup (call periodically)
    cleanup() {
        if (this.rateLimiter) {
            this.rateLimiter.cleanup();
        }
    }
}
exports.TrokkyCore = TrokkyCore;
