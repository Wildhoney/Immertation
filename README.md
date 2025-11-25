<p align="center">
  <img src="media/logo.png" alt="Immertation" width="33%" />
</p>

<p align="center">
  <a href="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml">
    <img src="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml/badge.svg" alt="Checks">
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
  - [Identity function](#identity-function)
  - [Inspecting state](#inspecting-state)
  - [Pruning annotations](#pruning-annotations)

## Getting started

```typescript
import { State, Op } from 'immertation';

type Model = {
  name: string;
  age: number;
};

const state = new State<Model>(
  { name: 'Adam', age: 30 },
  (snapshot) => JSON.stringify(snapshot)
);

state.mutate((draft) => {
  draft.name = 'Maria';
  draft.age = 31;
});

console.log(state.model.name); // 'Maria'
console.log(state.model.age); // 31

console.log(state.inspect.name.pending()); // false
console.log(state.inspect.age.pending()); // false
```

### Using annotations

Annotations allow you to track pending changes. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
import { State, Op } from 'immertation';

// Annotate a value to mark it as pending
state.mutate((draft) => {
  draft.name = state.annotate(Op.Update, 'Maria');
});

// The model retains the original value
console.log(state.model.name); // 'Adam'

// But we can check if it has a pending operation
console.log(state.inspect.name.pending()); // true

// Later, commit the actual change
state.mutate((draft) => {
  draft.name = 'Maria';
});

console.log(state.model.name); // 'Maria'
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
state.mutate((draft) => {
  draft.locations.push(state.annotate(Op.Add, { id: State.pk(), name: 'London' }));
});

// Marking for removal (keeps item until actually removed)
state.mutate((draft) => {
  const index = draft.locations.findIndex((loc) => loc.id === id);
  draft.locations[index] = state.annotate(Op.Remove, draft.locations[index]);
});

// Updating a property
state.mutate((draft) => {
  draft.user.name = state.annotate(Op.Update, 'New Name');
});
```

### Identity function

The identity function provides stable keys for tracking values across mutations. It receives any value from your model and should return a unique string identifier:

```typescript
type Person = { id: string; name: string };
type Model = { people: Person[] };

const state = new State<Model>(
  { people: [] },
  (snapshot) => {
    // Handle different value types
    if ('id' in snapshot) return snapshot.id;
    if (Array.isArray(snapshot)) return snapshot.map((p) => p.id).join(',');
    return JSON.stringify(snapshot);
  }
);
```

This allows annotations to follow values even when arrays are sorted or reordered.

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

// Works with nested paths
state.inspect.user.profile.email.pending();

// Works with array indices
state.inspect.locations[0].name.pending();
```

### Pruning annotations

Remove annotations by process after async operations complete:

```typescript
const process = state.mutate((draft) => {
  draft.name = state.annotate(Op.Update, 'New Name');
});

// After async operation completes
state.prune(process);
```

## Complete Example

```tsx
import { State, Op } from 'immertation';
import { useReducer, useMemo } from 'react';

type User = { id: string; name: string };
type Model = { users: User[] };

function UserList() {
  const state = useMemo(
    () => new State<Model>(
      { users: [] },
      (value) => ('id' in value ? value.id : JSON.stringify(value))
    ),
    []
  );
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const updateUser = async (id: string) => {
    const name = 'Updated Name';

    // Mark as updating (optimistic)
    state.mutate((draft) => {
      const user = draft.users.find((u) => u.id === id);
      if (user) user.name = state.annotate(Op.Update, name);
    });
    forceUpdate();

    // Simulate API call
    await fetch(`/api/users/${id}`, { method: 'PATCH' });

    // Commit the change
    state.mutate((draft) => {
      const user = draft.users.find((u) => u.id === id);
      if (user) user.name = name;
    });
    forceUpdate();
  };

  return (
    <div>
      {state.model.users.map((user, index) => (
        <div key={user.id}>
          <span>{user.name}</span>
          {state.inspect.users[index].name.pending() && ' (Updating...)'}
          <button onClick={() => updateUser(user.id)}>Update</button>
        </div>
      ))}
    </div>
  );
}
```
