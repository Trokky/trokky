# Trokky Known Issues

This document tracks known issues, bugs, and improvements needed in Trokky CMS.

## Critical Issues

### Studio & API

- [x] **Total Count Bug** - Studio was showing page limit instead of actual document count
  - **Fixed in**: `packages/routes/src/routes.ts:501-513`
  - **Solution**: Added `countDocuments()` call to get accurate total from database
  - **Status**: ✅ Fixed and verified

- [x] **Sort Format Mismatch** - Studio sends `-field` format but backend expected different format
  - **Fixed in**: `packages/routes/src/routes.ts:489-499` and `packages/adapters/postgres-data/src/postgres-data-adapter.ts:336`
  - **Solution**: Convert prefix notation to `field.desc` format using dot separator
  - **Status**: ✅ Fixed and verified

- [x] **Filter Parsing** - Studio sends bracket notation `filter[field]=value`, routes expected JSON
  - **Fixed in**: `packages/routes/src/routes.ts:473-487`
  - **Solution**: Handle both JSON string and object formats from Express query parser
  - **Status**: ✅ Fixed (needs testing with real data)

- [ ] **Duplicate Document IDs in List Response** - API returns duplicate document IDs in list queries
  - **Affected**: `listDocuments` endpoint returns same documents multiple times
  - **Example**: With 6 unique documents in DB, API returns 36 (each duplicated 6 times)
  - **Impact**: Critical - Trokky CLI clean command fails, Studio shows wrong counts
  - **Symptoms**:
    - CLI shows documents to delete that don't exist
    - Delete operations fail with "Document not found"
    - Total counts are inflated
  - **Root Cause**: Unknown - needs investigation in postgres adapter query logic
  - **Reproduced**: Yes, consistently with postgres adapter
  - **Status**: ⚠️ Needs investigation

### Security

- [x] **SQL Injection Prevention** - Added field name validation in postgres adapter
  - **Fixed in**: `packages/adapters/postgres-data/src/postgres-data-adapter.ts:302-360`
  - **Solution**: Validate field names with regex `/^[a-zA-Z0-9_.\-]+$/`
  - **Status**: ✅ Implemented

### Process Management

- [x] **Multiple Backend Instances Caching Issue** - Multiple backend processes served stale data
  - **Cause**: Multiple `tsx server.ts` processes running simultaneously (4+ instances found)
  - **Symptom**: API returned deleted documents for hours after deletion
  - **Solution**: Kill all processes and ensure single instance via monorepo `npm run dev`
  - **Status**: ✅ Resolved with proper process management
  - **Prevention**: Always use monorepo root `npm run dev` instead of manual backend starts

## Package Issues

### Adapter Naming Inconsistency

- [ ] **Adapter Package Names Don't Match Link Script**
  - **Issue**: Published packages use `@trokky/adapter-*` prefix but link script looks for `@trokky/*-adapter`
  - **Examples**:
    - Published: `@trokky/adapter-postgres-data`
    - Script expects: `@trokky/postgres-data`
  - **Impact**: Link scripts show adapters as [MISSING] even when installed
  - **Affected Files**: `/Users/amen/Projects/Perso/a production site-trokky/scripts/link-trokky.sh`
  - **Status**: ⚠️ Needs standardization

## CLI Issues

- [ ] **Trokky CLI Shows Duplicate Documents**
  - **Symptom**: `npx trokky clean` shows many more documents than actually exist
  - **Example**: Shows 527 documents to delete, but only 63 actually deleted
  - **Related to**: Duplicate Document IDs issue above
  - **Impact**: CLI unreliable for cleanup operations
  - **Status**: ⚠️ Blocked by duplicate IDs bug

## Testing Needed

- [ ] **Filter Functionality** - Backend code fixed but needs testing with real data
  - **Fixed**: Filter parsing handles bracket notation
  - **TODO**: Verify filters actually apply to query results
  - **Test Case**: Create documents with different statuses, filter by status in Studio

---

## Issue Reporting Template

When adding new issues, please use this format:

```markdown
- [ ] **Issue Title** - Brief description
  - **Affected**: What components/files are affected
  - **Symptom**: What users/developers see
  - **Example**: Concrete example if applicable
  - **Impact**: How severe (Critical/High/Medium/Low)
  - **Root Cause**: Known cause or "Unknown - needs investigation"
  - **Reproduced**: Yes/No
  - **Status**: 🔴 Critical / ⚠️ Needs investigation / 🟡 In progress / ✅ Fixed
```

---

**Last Updated**: 2025-11-21
**Tracking**: This file tracks issues found during a production site production development
