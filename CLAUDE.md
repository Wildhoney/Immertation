# Immertation

A state management library that tracks model mutations with annotations using Immer. It allows you to mark specific changes as "pending" operations (add, update, remove, etc.) while preserving the original state until explicitly committed.

## Core Concepts

### State Class (`src/index.ts`)

The main entry point. Wraps a model and provides:

- `produce(recipe)` - Apply mutations to the model using Immer's draft pattern
- `hydrate(model)` - Initialize the model (can include annotations)
- `model` - Access the current state
- `inspect` - Proxy-based API to check if properties have pending annotations
- `registry` - Map of identity → annotations for tracking pending changes

```typescript
const state = new State<Model>(identity);
state.hydrate(model);
state.produce((draft) => {
  draft.name = state.annotate(Op.Update, { first: 'New' });
});
state.inspect.name.pending(); // true
```

### Annotation Class (`src/utils.ts`)

Wraps a value with metadata about the intended operation. Uses `[immerable] = true` so Immer treats it as a draftable object.

Properties (defined via `Keys` enum for single source of truth):
- `value` - The annotated value
- `operations` - Bitmask of `Op` flags
- `property` - Which property this annotation targets (null for object-level)
- `process` - Symbol identifying the mutation batch

### Identity Function

User-provided function that returns a unique string ID for any snapshot in the model. Used as registry keys to track annotations across mutations.

```typescript
function identity(snapshot: Snapshot<Model>): string {
  if ('id' in snapshot) return snapshot.id;
  // ... handle other cases
}
```

### Registry

`Map<Id, Annotation[]>` storing all pending annotations keyed by identity. When you annotate a value, it's stored here against either:
- The existing value in the snapshot (if updating)
- The new value itself (if adding)

## Key Implementation Details

### Reconcile Function (`src/utils.ts:69-110`)

Processes Immer patches to extract annotations and return clean values:

1. If value is an `Annotation`:
   - Get the `present` value from the snapshot at this path
   - Check for nested annotations added directly to the Annotation object (via Immer's immerable behavior)
   - For primitives: store against the parent container
   - For objects: store against `present ?? model.value`
   - Return `present` if it exists, otherwise recurse into `model.value`

2. If value is an array: map and recurse
3. If value is an object: map entries and recurse
4. Otherwise: return as-is

### Nested Annotations on Annotation Objects

When you do:
```typescript
draft.name = state.annotate(Op.Update, { first: 'A' });
draft.name.first = state.annotate(Op.Update, 'B');
```

The second annotation gets added as a property on the first Annotation object (because `[immerable] = true`). The reconcile function detects this by filtering `Object.entries(model)` for keys not in `Annotation.keys`.

### Inspect Proxy (`src/index.ts:65-96`)

Creates a recursive Proxy that intercepts property access:
- Any property access returns another proxy for that path
- `.pending()` checks the registry for annotations at this path
- `.is(op)` checks if annotations have a specific operation type

Checks both:
1. Object-level annotations (property === null)
2. Property-level annotations on the parent

### Prune Method (`src/index.ts:58-62`)

Removes all annotations associated with a specific process symbol from the registry. Used after async operations complete to clean up tracking.

## Code Standards

### Functional Patterns
- Use `reduce()` instead of mutable `let` variables
- Avoid variable mutation; prefer immutable transformations
- Use ts-belt's `G.isArray`, `G.isObject`, `G.isNullable` for type guards

### TypeScript
- Explicit return types on exported functions
- Use `satisfies` for type-safe object literals
- Avoid `Function` type; use `(...args: unknown[]) => unknown`
- Use `function` declarations over arrow function constants

### Naming
- `Keys` enum for Annotation property names (single source of truth)
- `Op` enum for operation flags (bitmask)
- `Id` type alias for string identifiers
- `Process` type alias for mutation batch symbols

### Testing
- Use Vitest with `describe`/`it` blocks
- Use faker for test data
- Test both the state changes and the `inspect` API

## File Structure

```
src/
  index.ts      - State class, exports Op
  types.ts      - Type definitions
  utils.ts      - Config, Annotation, reconcile, store, primitive
```

## Type Definitions (`src/types.ts`)

- `Model` - Immer's `Objectish` type
- `Snapshot<T>` - Recursive type for any value in the model tree
- `Identity<M>` - Function type: `(snapshot: Snapshot<M[keyof M]>) => Id`
- `Recipe<M>` - Immer recipe: `(draft: M) => void`
- `Registry<M>` - `Map<Id, Annotation<M>[]>`
- `Inspect<T>` - Recursive type with `pending()` method, excluding function properties

## Operations (`Op` enum)

Bitmask flags for annotation operations:
- `Add = 1`
- `Remove = 2`
- `Update = 4`
- `Move = 8`
- `Replace = 16`
- `Sort = 32`
