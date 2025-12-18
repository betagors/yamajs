# Variants Feature Removal - Complete

**Date:** 2025-12-18  
**Decision:** Clean architectural removal (not disabled, **removed**)

## Rationale

Variants violated Yama's core principles:
1. **Single source of truth** - Variants introduced parallel schema truth
2. **Deterministic derivation** - Variants reintroduced manual shaping where inference is stronger  
3. **Minimal config surface** - Variants added knobs without unlocking new capabilities

## What Was Removed

### Code Removed
- ✅ `packages/kernel/src/variants/` directory (entire feature)
  - `variants/types.ts` - Type definitions
  - `variants/generator.ts` - Generation logic
  - `variants/index.ts` - Exports
- ✅ `variants` property from `EntityDefinition` interface
- ✅ `variants` property from `SchemaDefinition` interface
- ✅ Variant preservation code in `normalizeSchemaDefinition()`
- ✅ Variant preservation code in `normalizeEntityDefinition()`
- ✅ Variant check/error in `generateCrudInputSchemas()`
- ✅ Variant exports from `packages/kernel/src/index.ts`

### What Remains (Strengthened)
- ✅ **Auto-CRUD input inference** - Automatically excludes `id`, `createdAt`, `updatedAt`
- ✅ **Readonly/generated field semantics** - Proper field-level control
- ✅ **Partial update logic** - Update inputs are automatically optional
- ✅ **Operation-level overrides** - Explicit `inputTypes` and `responseTypes` in CRUD config

## Build Status

✅ **Runtime Build:** SUCCESS  
✅ **No Breaking Changes:** Auto-generation handles all previous variant use cases

## Migration Path

Users who were using variants should:
1. **Remove `variants:` from entity definitions** - They're no longer supported
2. **Use auto-generated CRUD schemas** - They already handle create/update differences intelligently
3. **For custom needs:** Use explicit `inputTypes` and `responseTypes` in CRUD config:

```yaml
entities:
  User:
    crud:
      inputTypes:
        POST: CustomCreateUserInput
        PATCH: CustomUpdateUserInput
      responseTypes:
        GET_ONE: UserDetail
        GET_LIST: UserSummary
```

## Future Consideration

If schema variants are needed in the future, they will be:
- Designed with real usage data
- Implemented without legacy constraints
- Aligned with IR stabilization
- Compatible with MCP and plugins

**Note:** This removal **increases** design freedom for future features.

## Changelog Entry

```
Removed schema variants.
CRUD input schemas are now derived deterministically from entity definitions.
Explicit overrides remain available at the operation level.
```

---

**This is a senior architectural cleanup, not a retreat.**
