After you write code, use the Task tool to launch a code review agent that will:
  - Review TypeScript code for type safety, best practices, and architecture compliance
  - Check for security vulnerabilities and performance issues
  - Verify code follows Trokky v2 patterns from the specs
  - Suggest improvements and flag any issues
  - Return a detailed review report




Always pass your work to our Task tool to launch a code review agent before build or conclude.


# Todo Immediate

## ArrayField UI Issues & Field Development Pattern

### ArrayField Issues to Fix
- Fix UI layout issues in ArrayField (various layout modes may have rendering problems)
- Review and test all 6 layout types: select, checkboxes, radio, tags, list, grid
- Ensure responsive design works across all layouts
- Test accessibility features and keyboard navigation
- Verify security sanitization doesn't break legitimate use cases

### FieldsDemo Component Architecture
- **Need to refactor FieldsDemo page to use reusable field renderer component**
- Create `FieldRenderer` component that can render any field type generically
- This component should handle:
  - Field definition parsing
  - Value state management  
  - Error handling and display
  - Consistent styling across all field types
  - Demo mode vs production mode differences

### Next Field Development Priorities

#### 1. Media & File Fields
- **Port Media component/page from legacy Trokky**
- Implement **FileField** as base with variants:
  - `MediaField` - General media upload (images, videos, audio, documents)
  - `AudioField` - Audio-specific upload with playback
  - `VideoField` - Video-specific upload with preview
  - `ImageField` - Image-specific with crop/resize options
  - `DocumentField` - PDF/document upload with preview
- Features needed:
  - Drag & drop upload
  - File type validation
  - File size limits
  - Preview generation
  - Cloud storage integration
  - Image optimization
  - Accessibility (alt text, captions)

#### 2. Complex Structural Fields
- **ObjectField** - Nested object structures with defined schema
  - Dynamic field rendering based on object definition
  - Validation of nested fields
  - Collapsible UI for complex objects
- **ReferenceField** - References to other documents
  - Search/select interface for referenced documents
  - Preview of referenced content
  - Validation of reference integrity
  - Support for multiple reference types

#### 3. Special Fields
- **SlugField** - URL-friendly identifiers
  - Auto-generation from title fields
  - Manual override capability
  - Uniqueness validation
  - URL-safe character enforcement
  - **Decision needed**: Required for collections, optional/hidden for singletons?

#### 4. Document Editor
- **Rich document editing interface**
- **Integration with all field types**
- **Real-time validation and preview**
- **Collaborative editing features**
- **Auto-save and version history**

### Development Pattern Established
- Start with comprehensive field definition (types, validation, options)
- Implement robust validation with security hardening
- Create multiple UI layouts/variants where applicable  
- Add comprehensive accessibility features
- Include extensive demo configurations
- Pass through security code review before integration
- Follow Trokky v2 plugin architecture consistently




---
- Continue Fields: MediaFields and variants
- Update/ trokky/client
- Ensure/improve the relevance of trokkt config file
- Study the relevance to have a higher trokky orchestrator/cms to setup thing quicky, more quickly than how it's done in examples/blog-integrated/server.ts
- - Thing of other implentation like Hono for cloudflare - can we still use express on cloudflare? which one is better
- 
- Circling back to Media Page, currently, the libray is using the real image which an be very heavy. Do you think, we could have an internet automatic variant that could create a thumbnail that Studio could use, regardless of the processing engine selected by user? It's a design and I dont know how this will be possible. How that could be possible?
- In media Library, List view: file has long name sometimes. find a way to truncate them
- 