# Trokky v2 - Future Roadmap

This document tracks future improvements, enhancements, and features planned for Trokky v2. Items are organized by severity/priority levels.

## Severity Levels

- **P0 (Critical)** - Blocking issues for production use
- **P1 (High)** - Important features needed for full functionality  
- **P2 (Medium)** - Nice-to-have improvements that enhance UX
- **P3 (Low)** - Polish, optimization, and future considerations

---

## Media Library & Performance

### P1 (High Priority)

**FUTURE-001**: Implement pagination for MediaPage
- Current: Loads all files at once (max 1000 limit)
- Needed: UI pagination controls with configurable page sizes (25/50/100 per page)
- Impact: Required for production sites with large media libraries
- Implementation: Server-side pagination in API + UI controls

**FUTURE-006**: Implement server-side search/filtering for paginated media
- Current: Client-side filtering only works on loaded files (incomplete results)
- Needed: Server-side search across all media files with proper pagination
- Impact: Essential for accurate search results when pagination is implemented
- Implementation: Add search/filter parameters to API endpoints, debounced search input
- Technical notes:
  - API: GET /api/media?search=query&type=images&page=1&limit=50
  - Debounce search input (300ms) to avoid excessive API calls
  - Show loading states during search
  - Cache recent searches for better UX

**FUTURE-002**: Add image thumbnail generation for Studio
- Current: Media library shows full-resolution images (heavy bandwidth)
- Needed: Automatic thumbnail variants for Studio UI regardless of user's processing engine choice
- Impact: Significantly improves Studio performance and user experience
- Implementation: Internal thumbnail processor separate from user-configurable image processing

### P2 (Medium Priority)

**FUTURE-003**: Implement virtual scrolling for large media grids
- Enhancement for handling thousands of media files smoothly
- Alternative/complement to pagination for better UX

---

## Field System

### P1 (High Priority)

**FUTURE-004**: Complete filesystem image processor with Sharp integration
- Currently pending from image processing architecture
- Required for production-ready image variants and optimization

---

## Developer Experience

### P2 (Medium Priority)

**FUTURE-005**: Add file upload progress indicators
- Current: Basic upload state without detailed progress
- Needed: Discrete progress bars showing individual file upload status
- UX improvement for multi-file uploads

---

## Template for New Items

When adding new items, use this format:

```
**FUTURE-XXX**: Brief description
- Current: Current state/limitation
- Needed: What should be implemented
- Impact: Why this matters
- Implementation: High-level technical approach (optional)
```

---

*Last updated: 2025-07-26*