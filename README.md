<p align="center">
  <img src="media/logo.png" alt="Immertation" width="33%" />
</p>

<p align="center">
  <a href="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml">
    <img src="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml/badge.svg" alt="Checks">
  </a>
</p>

<p align="center">
  <a href="https://github.com/Wildhoney/Immertation/actions/workflows/deploy.yml">
    <img src="https://github.com/Wildhoney/Immertation/actions/workflows/deploy.yml/badge.svg" alt="Checks">
  </a>
</p>

<p align="center">
  <a href="https://wildhoney.github.io/Immertation">View Live Demo</a>
  &nbsp;·&nbsp;
  <a href="https://wildhoney.github.io/Immertation/docs/">API Docs</a>
</p>

> State management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Using annotations](#using-annotations)
  - [Available operations](#available-operations)
  - [Inspecting state](#inspecting-state)
  - [Pruning annotations](#pruning-annotations)
  - [Observing changes](#observing-changes)
  - [Identity function](#custom-identity-function)

## Getting started

```typescript
import { State, Op } from 'immertation';

type Model = {
  name: string;
  age: number;
};

const state = new State<Model>();
state.hydrate({ name: 'Imogen', age: 30 });

state.produce((draft) => {
  draft.name = 'Phoebe';
  draft.age = 31;
});

console.log(state.model.name); // 'Phoebe'
console.log(state.model.age); // 31

console.log(state.inspect.name.pending()); // false
console.log(state.inspect.age.pending()); // false
```

### Using annotations

Annotations allow you to track pending changes. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
import { State, Op } from 'immertation';

// Annotate a value to mark it as pending
state.produce((draft) => void (draft.name = state.annotate(Op.Update, 'Phoebe')));

// The model retains the original value
console.log(state.model.name); // 'Imogen'

// But we can check if it has a pending operation
console.log(state.inspect.name.pending()); // true

// Later, commit the actual change
state.produce((draft) => void (draft.name = 'Phoebe'));

console.log(state.model.name); // 'Phoebe'
console.log(state.inspect.name.pending()); // false
```

### Available operations

The `Op` enum provides operation types for annotations:

- `Op.Add` - Mark a value as being added
- `Op.Remove` - Mark a value as being removed
- `Op.Update` - Mark a value as being updated
- `Op.Replace` - Mark a value as being replaced
- `Op.Move` - Mark a value as being moved
- `Op.Sort` - Mark a value as being sorted

```typescript
// Adding a new item
state.produce((draft) => void draft.locations.push(state.annotate(Op.Add, { id: State.pk(), name: 'Horsham' })));

// Marking for removal (keeps item until actually removed)
state.produce((draft) => {
  const index = draft.locations.findIndex((loc) => loc.id === id);
  draft.locations[index] = state.annotate(Op.Remove, draft.locations[index]);
});

// Updating a property
state.produce((draft) => void (draft.user.name = state.annotate(Op.Update, 'Phoebe')));
```

### Inspecting state

The `inspect` property provides a proxy to check pending operations at any path:

```typescript
// Check if a value has any pending operation
state.inspect.name.pending(); // boolean

// Check for a specific operation type
state.inspect.users[0].is(Op.Add); // true if being created
state.inspect.users[0].is(Op.Remove); // true if being deleted

// Get the draft value (annotated value or actual model value)
state.inspect.name.draft(); // returns annotated value if pending, otherwise model value

// Wait for a value to have no pending annotations
const value = await state.inspect.name.settled(); // resolves when annotations are pruned

// Works with nested paths
state.inspect.user.profile.email.pending();

// Works with array indices
state.inspect.locations[0].name.pending();
```

### Pruning annotations

Remove annotations by process after async operations complete:

```typescript
const process = state.produce((draft) => void (draft.name = state.annotate(Op.Update, 'Phoebe')));

// After async operation completes
state.prune(process);
```

### Observing changes

Subscribe to model changes to react whenever mutations occur:

```typescript
const unsubscribe = state.observe((model) => {
  console.log('Model changed:', model);
});

// Later, stop listening
unsubscribe();
```

### Identity function

By default, Immertation tracks object identity using an internal `κ` property &mdash; you typically don't need to configure this. However, if you need custom identity tracking (e.g., using your own `id` fields), you can optionally pass a custom identity function to the `State` constructor:

```typescript
const state = new State<Model>((snapshot) => {
  if ('id' in snapshot) return snapshot.id;
  if (Array.isArray(snapshot)) return snapshot.map((item) => item.id).join(',');
  return JSON.stringify(snapshot);
});
```
