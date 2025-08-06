# Trokky Storage Architecture Refactor Plan

## Overview

This plan addresses the critical architectural limitation in Trokky's current unified `StorageAdapter` interface, which prevents optimal Cloudflare deployment patterns (D1 for data + R2 for media).

## Problem Statement

**Current Issue:**
- Single `StorageAdapter` handles documents, users, AND media
- Cannot mix storage backends (e.g., D1 for data + R2 for media)
- Prevents optimal cloud deployment patterns

**Target Solution:**
- Separate `DataStorageAdapter` (documents + users)
- Separate `MediaStorageAdapter` (media files)
- Independent configuration and scaling

## Phase 1: Core Architecture Split

### 1.1 Interface Design
- [ ] Create new `DataStorageAdapter` interface
  - [ ] Document operations (getDocument, saveDocument, listDocuments, deleteDocument)
  - [ ] User operations (getUser, saveUser, listUsers, deleteUser, getUserByUsername, getUserByEmail)
  - [ ] App token operations (getAppToken, saveAppToken, listAppTokens, deleteAppToken)
- [ ] Create new `MediaStorageAdapter` interface
  - [ ] File operations (uploadFile, getFile, getFileContent, deleteFile, listMedia)
  - [ ] Variant operations (saveVariantFile, getVariantContent)
- [ ] Update TypeScript type exports in `@trokky/core`

### 1.2 Configuration System
- [ ] Design new configuration schema
  ```typescript
  storage: {
    data: { adapter: 'filesystem' | 'd1' | 's3', options: {...} },
    media: { adapter: 'filesystem' | 'r2' | 's3', options: {...} }
  }
  ```
- [ ] Update `TrokkyConfig` interface
- [ ] Create configuration validation schemas
- [ ] Ensure backward compatibility warnings

### 1.3 TrokkyCore Engine Refactor
- [ ] Update constructor to accept separate adapters
- [ ] Refactor document operations to use `DataStorageAdapter`
- [ ] Refactor media operations to use `MediaStorageAdapter`
- [ ] Update user management to use `DataStorageAdapter`
- [ ] Update all internal method signatures
- [ ] Ensure proper error handling for adapter failures

## Phase 2: Adapter Implementation

### 2.1 Filesystem Adapters Split
- [ ] Create `@trokky/adapter-filesystem-data`
  - [ ] Document storage (JSON files in content/)
  - [ ] User storage (JSON files in users/)
  - [ ] App token storage
- [ ] Create `@trokky/adapter-filesystem-media`
  - [ ] File upload handling
  - [ ] Variant storage
  - [ ] Metadata management
- [ ] Replace existing `@trokky/adapter-filesystem` with new split implementation

### 2.2 Cloudflare Adapters (New)
- [ ] Create `@trokky/adapter-cloudflare-d1` (Data)
  - [ ] D1 database schema design
  - [ ] Document CRUD operations
  - [ ] User management operations
  - [ ] Query optimization
  - [ ] Transaction support
- [ ] Create `@trokky/adapter-cloudflare-r2` (Media)
  - [ ] R2 bucket operations
  - [ ] File upload/download
  - [ ] Variant storage strategy
  - [ ] Metadata handling
  - [ ] CDN integration

### 2.3 S3 Adapters (Future)
- [ ] Create `@trokky/adapter-s3-data` (DynamoDB)
- [ ] Create `@trokky/adapter-s3-media` (S3 buckets)

## Phase 3: Integration Layer Updates

### 3.1 Routes Package Updates
- [ ] Update `@trokky/routes` to handle separate adapters
- [ ] Document routes → use `DataStorageAdapter`
- [ ] Media routes → use `MediaStorageAdapter`
- [ ] User routes → use `DataStorageAdapter`
- [ ] Update all route handlers signatures
- [ ] Add adapter selection logic

### 3.2 Express Integration Updates
- [ ] Update `@trokky/express` configuration parsing
- [ ] Update `TrokkyExpress.create()` method
- [ ] Update middleware to pass correct adapters to routes
- [ ] Update static file serving logic

### 3.3 Studio Integration Updates
- [ ] Update Studio API calls if needed
- [ ] Ensure media upload flows work with new adapters
- [ ] Update configuration UI (if any)

## Phase 4: Clean Implementation & Examples

### 4.1 Configuration Examples
- [ ] Update demo configuration files
- [ ] Create Cloudflare deployment examples
- [ ] Create mixed-environment examples
- [ ] Update documentation with new patterns

## Phase 5: Testing & Validation

### 5.1 Core Testing
- [ ] Unit tests for split adapter interfaces
- [ ] Integration tests for TrokkyCore with separate adapters
- [ ] Error handling tests (adapter failures)
- [ ] Performance testing with different adapter combinations

### 5.2 Adapter Testing
- [ ] Filesystem data adapter tests
- [ ] Filesystem media adapter tests
- [ ] Cloudflare D1 adapter tests
- [ ] Cloudflare R2 adapter tests
- [ ] Cross-adapter integration tests

### 5.3 End-to-End Testing
- [ ] Demo application with split adapters
- [ ] Cloudflare Workers deployment test
- [ ] Mixed environment testing (filesystem + R2, etc.)

## Phase 6: Documentation & Examples

### 6.1 Architecture Documentation
- [ ] Update architecture diagrams
- [ ] Document adapter selection guidelines
- [ ] Performance characteristics comparison
- [ ] Best practices for different deployment scenarios

### 6.2 Deployment Examples
- [ ] Local development (filesystem + filesystem)
- [ ] Cloudflare Workers (D1 + R2)
- [ ] AWS deployment (DynamoDB + S3)
- [ ] Hybrid deployments (filesystem + R2, etc.)

## Success Criteria

- [ ] Can deploy Trokky with D1 for data + R2 for media
- [ ] No performance degradation from current unified approach
- [ ] All existing functionality preserved
- [ ] Clear path for future storage backend additions
- [ ] Clean, maintainable architecture

## Risk Mitigation

### Performance Impact
- [ ] Benchmark current vs new architecture
- [ ] Optimize adapter selection overhead
- [ ] Cache adapter instances appropriately

### Development Complexity
- [ ] Clear interface contracts
- [ ] Comprehensive testing strategy
- [ ] Good error messages and debugging tools

## Timeline Estimate

- **Phase 1-2**: 4-5 days (Core + Adapters)
- **Phase 3**: 2 days (Integration updates)
- **Phase 4**: 1 day (Clean examples)
- **Phase 5**: 2-3 days (Testing)
- **Phase 6**: 1-2 days (Documentation)

**Total Estimate: 10-13 days of focused development** (40% reduction!)

## Development Workflow with editor tooling

### Quality Gates for Each Phase

**🔄 Standard Development Cycle:**
1. **Implementation** → Write/modify code
2. **Code Review** → Use specialized editor tooling agents
3. **Build Verification** → Ensure clean builds and type safety
4. **Testing** → Validate functionality
5. **Phase Gate** → Review before proceeding

### Phase-Specific Agent Usage

#### Phase 1: Core Architecture Split
- [ ] **After interface design**: Use `code-security-reviewer` agent to review new interfaces for security implications
- [ ] **After TrokkyCore changes**: Use `general-purpose` agent to search for all TrokkyCore usages across packages
- [ ] **Before Phase 1 completion**: Run full type-check and build verification across all packages

#### Phase 2: Adapter Implementation  
- [ ] **After each adapter**: Use `code-security-reviewer` agent to review storage operations for vulnerabilities
- [ ] **After filesystem split**: Use `general-purpose` agent to verify all file operations are correctly categorized
- [ ] **After Cloudflare adapters**: Use `code-security-reviewer` agent to review D1/R2 security patterns
- [ ] **Before Phase 2 completion**: Test adapter interfaces with mock implementations

#### Phase 3: Integration Layer Updates
- [ ] **After routes updates**: Use `code-security-reviewer` agent to review route-to-adapter mappings
- [ ] **After Express integration**: Use `general-purpose` agent to verify configuration parsing logic
- [ ] **Before Phase 3 completion**: End-to-end build verification with new configuration structure

#### Phase 4: Clean Implementation & Examples
- [ ] **After config examples**: Use `general-purpose` agent to validate configuration schemas
- [ ] **Before Phase 4 completion**: Manual testing of all configuration examples

#### Phase 5: Testing & Validation
- [ ] **After each test suite**: Use `code-security-reviewer` agent to review test coverage for security scenarios
- [ ] **Before Phase 5 completion**: Full test suite execution with coverage reports

#### Phase 6: Documentation & Examples
- [ ] **After documentation**: Use `general-purpose` agent to verify code examples in documentation
- [ ] **Final review**: Use `code-security-reviewer` agent for comprehensive security review

### Mandatory Checks Between Phases

#### Build Integrity
- [ ] `npm run build` succeeds for all packages
- [ ] `npm run type-check` passes with zero errors
- [ ] `npm run lint` passes with zero errors
- [ ] No TypeScript compilation errors or warnings

#### Dependency Verification
- [ ] All package imports resolve correctly
- [ ] No circular dependencies introduced
- [ ] Package.json dependencies are accurate

#### Breaking Change Detection
- [ ] Interface changes are intentional and documented
- [ ] All affected packages are updated consistently
- [ ] Demo applications still build and run

### Error Handling Protocol

**🚨 If Build Errors Occur:**
1. **Stop immediately** - Don't proceed to next phase
2. **Use editor tooling agents** to diagnose and fix issues
3. **Re-run all checks** before continuing
4. **Document any architecture decisions** that caused the errors

**🔍 If Type Errors Occur:**
1. **Analyze root cause** - interface mismatch vs implementation issue
2. **Use general-purpose agent** to find all affected code locations
3. **Fix consistently** across all packages
4. **Verify fix doesn't introduce new type issues**

**⚠️ If Security Issues Found:**
1. **Use code-security-reviewer agent** for detailed analysis
2. **Fix before proceeding** - security is non-negotiable
3. **Review similar patterns** in other adapters
4. **Update security documentation** if needed

### Quality Metrics

**Code Quality Targets:**
- [ ] 100% TypeScript type coverage
- [ ] Zero build warnings or errors
- [ ] All security recommendations addressed
- [ ] Comprehensive error handling
- [ ] Clean, consistent interfaces

**Testing Targets:**
- [ ] Unit test coverage > 85%
- [ ] Integration tests for all adapter combinations
- [ ] End-to-end tests for common workflows
- [ ] Security test scenarios covered

## Next Steps

1. [ ] **Decision**: Approve this architectural change
2. [ ] **Planning**: Detailed interface design review
3. [ ] **Implementation**: Start with Phase 1.1 (Interface Design)
4. [ ] **Validation**: Create proof-of-concept with split filesystem adapters

---

**Note**: Since no applications are currently using Trokky v2, we can implement this as a clean architectural improvement without backward compatibility concerns. This enables optimal cloud deployment patterns with a much faster development timeline.