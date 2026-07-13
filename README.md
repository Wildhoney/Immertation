<div align="center">
  <img src="/media/logo.png" width="475" alt="Immertation" />

[![Checks](https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml/badge.svg)](https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml)
[![Deploy](https://github.com/Wildhoney/Immertation/actions/workflows/deploy.yml/badge.svg)](https://github.com/Wildhoney/Immertation/actions/workflows/deploy.yml)

</div>

> State management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

> **[View Live Demo →](https://wildhoney.github.io/Immertation)** &nbsp;·&nbsp; **[API Docs →](https://wildhoney.github.io/Immertation/docs/)**

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Hydrating state](#hydrating-state)
  - [Using annotations](#using-annotations)
  - [Available operations](#available-operations)
  - [Inspecting state](#inspecting-state)
  - [Pruning annotations](#pruning-annotations)
  - [Observing changes](#observing-changes)
  - [Identity function](#identity-function)

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

### Hydrating state

`hydrate()` seeds the state with its initial model. It's a required first step: it establishes the committed model that patches are later applied against, and it unlocks `produce()` &mdash; calling `produce()` on an un-hydrated state throws, because there is no base state to mutate.

```typescript
const state = new State<Model>();

state.hydrate({ name: 'Imogen', age: 30 });
state.produce((draft) => void (draft.age = 31)); // OK

// Calling produce() first would throw:
// "State must be hydrated using hydrate() before calling produce()"
```

The difference between `hydrate()` and `produce()` shows up when the incoming model contains annotations. `produce()` preserves the current committed value and records the annotated value as a _pending draft_ (see [Using annotations](#using-annotations)). `hydrate()` does the opposite: the annotated value becomes the **actual** committed value, while still being registered as a pending operation.

```typescript
const state = new State<Model>();

// The annotated value becomes the committed model value...
const process = state.hydrate({ name: state.annotate(Op.Update, 'Phoebe'), age: 30 });

console.log(state.model.name); // 'Phoebe'

// ...yet it is still tracked as a pending operation
console.log(state.inspect.name.pending()); // true
console.log(state.inspect.name.is(Op.Update)); // true
```

This makes `hydrate()` the natural entry point for rehydrating data that already carries in-flight operations &mdash; for example server-rendered or persisted state whose optimistic updates haven't settled yet. Like `produce()`, `hydrate()` returns a `Process` symbol you can later [prune](#pruning-annotations) once those operations resolve.

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
