# YAMA Roadmap

This document outlines planned features and improvements for YAMA.

## Backend-as-Config Enhancements

### Current State
- ✅ CRUD endpoints are fully config-based (no code required)
- ✅ Custom endpoints can be defined in YAML but require TypeScript handler files
- ⚠️ Default handlers only return placeholder messages

### Planned Features

#### 1. Database Access in Handler Context
**Priority: High**

Add database access to `HandlerContext` so handlers can use repositories without manual imports.

**Implementation:**
- Populate `context.db` with the database adapter
- Provide entity repositories through `context.repositories` or `context.entities`
- Allow handlers to access database operations directly from context

**Example:**
```typescript
export async function myHandler(context: HandlerContext) {
  const products = await context.entities.Product.findAll();
  return products;
}
```

**Benefits:**
- Reduces boilerplate in handlers
- Makes database access consistent across handlers
- Enables easier testing and mocking

---

#### 2. Smart Default Handlers for Entity Endpoints
**Priority: High**

Enable endpoints without handlers to automatically query entity repositories based on response type detection.

**Current State:**
- Endpoints without handlers use `createDefaultHandler` which returns placeholder messages
- No automatic database querying for entity-based endpoints

**Implementation:**
- Enhance `createDefaultHandler` to detect entity-based response types (e.g., `ProductArray`, `Product`)
- Dynamically load and use the appropriate repository based on entity name
- Support CRUD operations automatically:
  - `GET /path` with `ProductArray` response → calls `productRepository.findAll(query)`
  - `GET /path/:id` with `Product` response → calls `productRepository.findById(params.id)`
  - `POST /path` with `Product` response → calls `productRepository.create(body)`
  - `PUT/PATCH /path/:id` → calls `productRepository.update(params.id, body)`
  - `DELETE /path/:id` → calls `productRepository.delete(params.id)`
- Map query parameters to repository method options
- Support pagination, filtering, and sorting through query parameters

**Example:**
```yaml
endpoints:
  - path: /featured-products
    method: GET
    # No handler specified - auto-detects ProductArray and queries repository
    query:
      featured: { type: "boolean", required: false }
      limit: { type: "number", required: false }
      offset: { type: "number", required: false }
    response:
      type: ProductArray
```

The default handler would:
1. Detect `ProductArray` response type
2. Load `productRepository` dynamically
3. Query with `findAll({ featured: true, limit: 10, offset: 0 })` based on query params
4. Return results automatically

**Benefits:**
- No handler code needed for simple entity queries
- Declarative endpoint definitions
- Automatic repository integration
- Reduces boilerplate significantly

---

#### 3. Auto-Implemented Search in CRUD
**Priority: High**

Add configurable search functionality to CRUD endpoints that automatically implements search across specified fields.

**Current State:**
- CRUD GET list endpoints only support `limit` and `offset` query parameters
- No built-in search functionality
- Users must implement search manually in handlers

**Implementation:**
- Extend `CrudConfig` interface with search configuration:
  ```typescript
  export interface CrudConfig {
    // ... existing fields ...
    search?: {
      /**
       * Fields that can be searched (default: all string/text fields)
       * Can be array of field names or true to enable all searchable fields
       */
      fields?: string[] | true;
      
      /**
       * Search mode: "contains" (default), "starts", "ends", "exact"
       */
      mode?: "contains" | "starts" | "ends" | "exact";
      
      /**
       * Enable full-text search across multiple fields with a single query parameter
       */
      fullText?: boolean;
    };
  }
  ```
- Update `generateCrudEndpoints` to add `search` query parameter when search is enabled
- Enhance repository `findAll` method to support search across configured fields
- Support both individual field search and full-text search modes

**Example Configuration:**
```yaml
entities:
  Product:
    table: products
    crud:
      enabled: true
      search:
        fields: ["name", "description"]  # Only search these fields
        mode: "contains"  # Search mode: contains, starts, ends, or exact
        fullText: true    # Enable ?search=query parameter for multi-field search
    fields:
      id:
        type: uuid
        primary: true
        generated: true
      name:
        type: string
        required: true
      description:
        type: text
      price:
        type: number
```

**Generated Endpoints Would Support:**
- `GET /products?search=laptop` - Full-text search across name and description for "laptop"
- `GET /products?name=laptop` - Exact field matching (existing functionality)
- `GET /products?name=laptop&price=1000` - Multiple field filters (existing)
- `GET /products?limit=10&offset=0&search=laptop` - Combined search and pagination

**Search Modes:**
- `contains` (default): `ILIKE '%query%'` - matches anywhere in field
- `starts`: `ILIKE 'query%'` - matches at start of field
- `ends`: `ILIKE '%query'` - matches at end of field
- `exact`: `= 'query'` - exact match

**Benefits:**
- Zero-code search implementation
- Configurable search fields per entity
- Multiple search modes for flexibility
- Full-text search across multiple fields
- Consistent search patterns across all entities

---

#### 4. Inline Handler Definitions in YAML
**Priority: Medium**

Support built-in handler types that can be configured directly in YAML without writing code.

**Handler Types:**

##### Query Handler
Execute database queries directly from config:
```yaml
endpoints:
  - path: /products/search
    method: GET
    handler:
      type: query
      entity: Product
      filters:
        - field: name
          operator: ilike
          param: search
        - field: price
          operator: lte
          param: maxPrice
      pagination:
        limit: query.limit
        offset: query.offset
      orderBy:
        field: created_at
        direction: desc
    query:
      search:
        type: string
        required: false
      maxPrice:
        type: number
        required: false
    response:
      type: ProductArray
```

##### Relation Handler
Access related entities:
```yaml
endpoints:
  - path: /products/:id/reviews
    method: GET
    handler:
      type: relation
      entity: Product
      relation: reviews
      parentId: params.id
    params:
      id:
        type: string
        required: true
    response:
      type: ReviewArray
```

##### Aggregate Handler
Perform aggregations:
```yaml
endpoints:
  - path: /products/stats
    method: GET
    handler:
      type: aggregate
      entity: Product
      operations:
        - type: count
          alias: total
        - type: avg
          field: price
          alias: avgPrice
        - type: sum
          field: stock
          alias: totalStock
    response:
      type: ProductStats
```

**Benefits:**
- No code required for common operations
- Faster development for simple endpoints
- Consistent query patterns

---

#### 3. Handler Templates/Presets
**Priority: Medium**

Support configurable handler templates for common patterns.

**Template Types:**

##### CRUD Override Templates
Override specific CRUD operations with custom logic:
```yaml
entities:
  Product:
    table: products
    crud: true
    crudOverrides:
      POST:
        handler:
          type: template
          template: create-with-validation
          validate:
            - field: price
              min: 0
            - field: stock
              min: 0
```

##### Custom Templates
Define reusable handler templates:
```yaml
handlerTemplates:
  searchWithFilters:
    type: query
    filters: ${filters}
    pagination: true
    orderBy: ${orderBy}

endpoints:
  - path: /products/search
    method: GET
    handler:
      type: template
      template: searchWithFilters
      filters:
        - field: name
          operator: ilike
          param: q
      orderBy:
        field: created_at
        direction: desc
```

**Benefits:**
- Reusable handler patterns
- Consistent implementation across endpoints
- Easier maintenance

---

#### 4. Expression-Based Handlers
**Priority: Low**

Support SQL-like expressions or JavaScript expressions for simple transformations.

**SQL Expression Handler:**
```yaml
endpoints:
  - path: /stats
    method: GET
    handler:
      type: sql
      query: |
        SELECT 
          COUNT(*) as total_products,
          AVG(price) as avg_price,
          SUM(stock) as total_stock
        FROM products
        WHERE created_at > NOW() - INTERVAL '7 days'
    response:
      type: Stats
```

**JavaScript Expression Handler:**
```yaml
endpoints:
  - path: /products/:id/price-formatted
    method: GET
    handler:
      type: expression
      entity: Product
      expression: |
        const product = await context.entities.Product.findById(params.id);
        return {
          ...product,
          priceFormatted: `$${product.price.toFixed(2)}`
        };
    response:
      type: ProductWithFormattedPrice
```

**Benefits:**
- Quick transformations without full handler files
- SQL queries for complex aggregations
- JavaScript for simple data manipulation

---

## Plugin Ecosystem Development

### Current State
- ✅ Plugin system with `YamaPlugin` interface
- ✅ Plugin loading from npm packages
- ✅ Plugin registry and validation
- ✅ CLI commands: `yama plugin install`, `yama plugin list`, `yama plugin validate`
- ⚠️ No plugin creation guide or templates
- ⚠️ No plugin discovery/search mechanism
- ⚠️ No official plugin registry or marketplace
- ⚠️ Limited documentation for plugin developers

### Planned Features

#### 1. Plugin Creation Guide & Templates
**Priority: High**

Create comprehensive documentation and tooling to help users build their own plugins.

**Implementation:**
- Create `docs/plugins/creating-plugins.md` with:
  - Step-by-step plugin creation guide
  - Plugin interface documentation
  - Examples for different plugin types (database, HTTP, services)
  - Best practices and conventions
- Add `yama plugin create <name>` command that:
  - Generates plugin scaffold with proper structure
  - Includes TypeScript setup, build configuration
  - Provides template based on plugin category
  - Sets up testing framework
- Create plugin templates for common categories:
  - Database adapter plugin
  - HTTP server plugin
  - Service integration plugin (payments, email, etc.)

**Example Usage:**
```bash
yama plugin create my-database-plugin --category database
# Creates:
# - my-database-plugin/
#   - src/
#     - plugin.ts (template)
#     - adapter.ts (if database)
#   - package.json (with yama metadata)
#   - tsconfig.json
#   - README.md
```

**Benefits:**
- Lowers barrier to entry for plugin development
- Ensures consistent plugin structure
- Reduces boilerplate and setup time
- Encourages community plugin development

---

#### 2. Plugin Discovery & Search
**Priority: High**

Enable users to discover and search for available plugins.

**Implementation:**
- Add `yama plugin search <query>` command:
  - Searches npm registry for packages with `yama` keyword
  - Filters by `yama` metadata in package.json
  - Displays plugin information (name, version, category, description)
  - Shows installation instructions
- Add `yama plugin browse` command:
  - Lists plugins by category
  - Shows official vs community plugins
  - Displays plugin popularity/usage metrics (if available)
- Enhance `yama plugin list` to show:
  - Plugin status (installed, outdated, compatible)
  - Plugin metadata (category, version, description)
  - Update availability

**Example Usage:**
```bash
# Search for database plugins
yama plugin search database

# Browse all available plugins
yama plugin browse

# Browse by category
yama plugin browse --category database
```

**Benefits:**
- Makes plugin discovery easy
- Helps users find the right plugin for their needs
- Encourages plugin adoption
- Increases visibility for community plugins

---

#### 3. Plugin Registry System
**Priority: Medium**

Create a centralized registry for official and community plugins.

**Implementation:**
- Create registry JSON file or API endpoint:
  ```json
  {
    "official": [
      {
        "name": "@betagors/yama-postgres",
        "version": "0.1.0",
        "category": "database",
        "description": "PostgreSQL database adapter",
        "npm": "@betagors/yama-postgres",
        "verified": true
      }
    ],
    "community": [
      {
        "name": "yama-mysql",
        "version": "1.0.0",
        "category": "database",
        "description": "MySQL database adapter",
        "npm": "yama-mysql",
        "author": "@username",
        "verified": false,
        "github": "https://github.com/username/yama-mysql"
      }
    ]
  }
  ```
- Host registry at `registry.yama.dev` or in repository
- Add `yama plugin registry` command to:
  - Fetch and display registry contents
  - Show plugin details from registry
  - Install plugins from registry
- Create submission process for community plugins:
  - GitHub issue template for plugin submissions
  - Review process for official listing
  - Verification badges for tested plugins

**Benefits:**
- Centralized source of truth for available plugins
- Quality control through verification
- Better discoverability
- Community engagement

---

#### 4. Plugin Documentation & Examples
**Priority: Medium**

Comprehensive documentation for plugin developers and users.

**Implementation:**
- Create `docs/plugins/` directory with:
  - `creating-plugins.md` - Plugin development guide
  - `plugin-api.md` - Plugin API reference
  - `examples/` - Example plugins for different use cases
  - `registry.md` - Official and community plugins list
  - `best-practices.md` - Plugin development best practices
- Add plugin examples:
  - Database adapter example
  - HTTP server adapter example
  - Payment service integration example
  - Email service integration example
- Create plugin showcase page:
  - Featured plugins
  - Popular plugins
  - Recently added plugins
  - Plugin categories

**Benefits:**
- Better developer experience
- Clear guidelines and examples
- Reduced support burden
- Higher quality plugins

---

#### 5. Plugin Validation & Testing Tools
**Priority: Medium**

Tools to help plugin developers validate and test their plugins.

**Implementation:**
- Enhance `yama plugin validate` to:
  - Check plugin structure and interface compliance
  - Validate plugin metadata
  - Test plugin initialization
  - Verify version compatibility
  - Run plugin-specific tests
- Add `yama plugin test` command:
  - Run plugin test suite
  - Validate against Yama core versions
  - Check for common issues
- Create plugin testing utilities:
  - Mock Yama context for testing
  - Plugin test helpers
  - Integration test templates
- Add CI/CD templates for plugins:
  - GitHub Actions workflow
  - Automated testing on Yama version updates
  - Automated publishing

**Benefits:**
- Ensures plugin quality
- Catches issues early
- Reduces compatibility problems
- Professional plugin development workflow

---

#### 6. Plugin Marketplace (Web Interface)
**Priority: Low**

Web-based plugin directory and marketplace.

**Implementation:**
- Create web interface at `plugins.yama.dev`:
  - Browse plugins by category
  - Search and filter plugins
  - View plugin details, documentation, and examples
  - Plugin ratings and reviews
  - Installation instructions
- Features:
  - Plugin badges (official, verified, community)
  - Download statistics
  - Version history
  - Compatibility matrix
  - Plugin dependencies
  - Screenshots/demos
- Integration with CLI:
  - `yama plugin open <name>` - Opens plugin page in browser
  - `yama plugin info <name>` - Shows detailed plugin information

**Benefits:**
- Better user experience for plugin discovery
- Visual plugin browsing
- Community engagement
- Plugin promotion

---

#### 7. Plugin Versioning & Compatibility
**Priority: Medium**

Better version management and compatibility checking.

**Implementation:**
- Enhance plugin version validation:
  - Check `yamaCore` compatibility range
  - Validate `pluginApi` version
  - Warn about incompatible versions
  - Suggest compatible alternatives
- Add `yama plugin check-updates` command:
  - Check for plugin updates
  - Show compatibility with current Yama version
  - Suggest update paths
- Create plugin compatibility matrix:
  - Track plugin compatibility across Yama versions
  - Document breaking changes
  - Migration guides for plugin updates
- Add plugin deprecation system:
  - Mark plugins as deprecated
  - Suggest alternatives
  - Show deprecation timeline

**Benefits:**
- Prevents compatibility issues
- Easier plugin maintenance
- Better upgrade experience
- Clear migration paths

---

## Implementation Priority

### Backend-as-Config Features

1. **Phase 1 (High Priority)**
   - Database access in handler context
   - Smart default handlers for entity endpoints
   - Auto-implemented search in CRUD
   - Basic query handler type

2. **Phase 2 (Medium Priority)**
   - Relation handler type
   - Aggregate handler type
   - Handler templates

3. **Phase 3 (Low Priority)**
   - Expression-based handlers
   - SQL expression handler
   - Advanced template features

### Plugin Ecosystem Features

1. **Phase 1 (High Priority)**
   - Plugin creation guide & templates
   - Plugin discovery & search commands
   - Plugin documentation & examples

2. **Phase 2 (Medium Priority)**
   - Plugin registry system
   - Plugin validation & testing tools
   - Plugin versioning & compatibility management

3. **Phase 3 (Low Priority)**
   - Plugin marketplace (web interface)
   - Advanced plugin analytics
   - Plugin monetization features (if needed)

## Related Features

### Schema Enhancements
- Support for computed fields in schemas
- Virtual fields that are calculated at runtime
- Field-level validation rules

### Validation Enhancements
- Custom validation functions in config
- Cross-field validation
- Conditional validation rules

### Documentation
- Auto-generate handler documentation from config
- Examples for each handler type
- Migration guide from code-based to config-based handlers
- Plugin development guides and API reference
- Plugin registry and marketplace documentation

### Plugin Ecosystem
- Plugin creation templates and scaffolding
- Plugin discovery and search capabilities
- Official and community plugin registry
- Plugin validation and testing tools
- Plugin versioning and compatibility management

## Notes

- All features should maintain backward compatibility with existing TypeScript handlers
- Custom handlers will always be supported for complex business logic
- Config-based handlers should be optional, not required
- Performance should be considered for all new handler types

