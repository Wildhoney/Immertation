<p align="center">
  <img src="media/logo.png" alt="Immertation" width="33%" />
</p>

<p align="center">
  <a href="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml">
    <img src="https://github.com/Wildhoney/Immertation/actions/workflows/checks.yml/badge.svg" alt="Checks">
  </a>
</p>

<p align="center">
  🧶 <a href="https://wildhoney.github.io/Immertation">View Live Demo →</a>
</p>

> State management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Using operations](#using-operations)
  - [Available operations](#available-operations)
  - [Pruning operations](#pruning-operations)
  - [Listening to changes](#listening-to-changes)
  - [Passing state to components](#passing-state-to-components)
  - [Value-based tracking](#value-based-tracking)
    - [Arrays](#arrays)
    - [Objects](#objects)

## Getting started

```typescript
import { State, Operation } from 'immertation';

type Model = {
  name: string;
  age: number;
};

const state = new State<Model>({
  name: 'John',
  age: 30
});

state.mutate((draft) => {
  draft.name = 'Jane';
  draft.age = 31;
});

console.log(state.model.name);
console.log(state.model.age);

console.log(state.inspect.name.pending());
console.log(state.inspect.age.pending());
```

## Complete Example: User Management with Async Operations

Here's a real-world example showing how to manage a list of users with optimistic updates:

```tsx
import { State, Draft, Op } from 'immertation';
import { useEffect, useReducer, useMemo } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
};

type Model = {
  users: User[];
};

const state = new State<Model>(
  { users: [] },
  (value) => {
    if ('id' in value) return `user/${value.id}`;
    return String(value);
  }
);

function useAppState<M>(state: State<M>) {
  const forceUpdate = useReducer((x) => x + 1, 0)[1];

  useEffect(() => {
    return state.observe(() => forceUpdate());
  }, [state]);

  return state;
}

function useUserController(state: State<Model>) {
  const updateUser = async (id: number, updates: Partial<User>) => {
    const process = state.mutate((draft) => {
      const user = draft.users.find((user) => user.id === id);
      if (user && updates.name) {
        user.name = Draft(updates.name, Op.Update);
      }
    });

    try {
      await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      state.mutate((draft) => {
        const user = draft.users.find((user) => user.id === id);
        if (user && updates.name) user.name = updates.name;
      });
      state.prune(process);
    } catch (error) {
      const originalUser = state.model.users.find((user) => user.id === id);
      state.mutate((draft) => {
        const user = draft.users.find((user) => user.id === id);
        if (user && originalUser) user.name = originalUser.name;
      });
      state.prune(process);
    }
  };

  const deleteUser = async (id: number) => {
    const process = state.mutate((draft) => {
      const index = draft.users.findIndex((user) => user.id === id);
      if (index !== -1) {
        draft.users[index].email = Draft(draft.users[index].email, Op.Remove);
      }
    });

    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });

      state.mutate((draft) => {
        const index = draft.users.findIndex((user) => user.id === id);
        if (index !== -1) draft.users.splice(index, 1);
      });
      state.prune(process);
    } catch (error) {
      state.prune(process);
    }
  };

  const createUser = async (user: Omit<User, 'id'>) => {
    const tempUser: User = { id: Date.now(), ...user };

    const process = state.mutate((draft) => {
      draft.users.push(Draft(tempUser, Op.Add));
    });

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(user),
      });
      const created = await response.json();

      state.mutate((draft) => {
        const index = draft.users.findIndex((user) => user.id === tempUser.id);
        if (index !== -1) draft.users[index] = created;
      });
      state.prune(process);
    } catch (error) {
      state.mutate((draft) => {
        const index = draft.users.findIndex((user) => user.id === tempUser.id);
        if (index !== -1) draft.users.splice(index, 1);
      });
      state.prune(process);
    }
  };

  return { updateUser, deleteUser, createUser };
}

function UserList() {
  const state = useAppState(appState);
  const { updateUser, deleteUser, createUser } = useUserController(state);

  return (
    <div>
      {state.inspect.users.draft().map((user, index) => {
        const annotations = state.inspect.users[index];
        const isDeleting = annotations.email.is(Op.Remove);
        const isCreating = annotations.pending();
        const isUpdating = annotations.name.is(Op.Update);

        return (
          <div key={user.id}>
            <span style={{ opacity: isDeleting ? 0.5 : 1 }}>
              {user.name}
              {isCreating && ' (Creating...)'}
              {isUpdating && ' (Updating...)'}
              {isDeleting && ' (Deleting...)'}
            </span>
            <button
              onClick={() => updateUser(user.id, { name: 'New Name' })}
              disabled={isCreating || isUpdating}
            >
              Update
            </button>
            <button
              onClick={() => deleteUser(user.id)}
              disabled={isCreating || isDeleting}
            >
              Delete
            </button>
          </div>
        );
      })}
      <button onClick={() => createUser({ name: 'New User', email: 'new@example.com' })}>
        Add User
      </button>
    </div>
  );
}
```

### Using operations

Operations allow you to track pending changes with annotations. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
const process = Symbol('update-user');

state.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

console.log(state.model.name);
console.log(state.model.age);

console.log(state.inspect.name.pending());
console.log(state.inspect.name.remaining());
console.log(state.inspect.name.is(Operation.Update));
console.log(state.inspect.name.is(Operation.Add));

console.log(state.inspect.name.draft());
console.log(state.inspect.age.draft());
```

### Available operations

- `Operation.Add` - Mark a value as being added
- `Operation.Remove` - Mark a value as being removed
- `Operation.Update` - Mark a value as being updated
- `Operation.Replace` - Mark a value as being updated and replaced
- `Operation.Move` - Mark a value as being moved
- `Operation.Sort` - Mark a value as being sorted

### Pruning operations

Remove operation records by process. This is useful when async operations complete or fail, allowing you to clean up tracked operations:

```typescript
const process1 = Symbol('process1');
const process2 = Symbol('process2');

state.mutate((draft) => {
  draft.name = Operation.Update('Alice', process1);
});

state.mutate((draft) => {
  draft.age = Operation.Update(25, process2);
});

state.prune(process1);

console.log(state.model.name);
console.log(state.model.age);

console.log(state.inspect.name.pending());
console.log(state.inspect.name.is(Operation.Update));

console.log(state.inspect.age.pending());
console.log(state.inspect.age.is(Operation.Update));
```

### Listening to changes

Register listeners to be notified whenever the model or annotations change. This is particularly useful for integrating with reactive frameworks like React:

```typescript
const state = new State({ count: 0 });

const unsubscribe = state.listen((state) => {
  console.log('Count changed:', state.model.count);
  console.log('Has pending operations:', state.inspect.count.pending());
});

state.mutate((draft) => {
  draft.count = 1;
});

unsubscribe();
```

**React integration example:**

```typescript
function useState<M>(state: State<M>) {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = state.listen(() => forceUpdate());
    return unsubscribe;
  }, [state]);

  return state;
}
```

### Passing state to components

Use `box()` to pass values with their annotations to components:

```tsx
import type { Box } from 'immertation';

type Props = {
  count: Box<number>;
};

function Counter({ count }: Props) {
  return (
    <div>
      <span>{count.model}</span>
      {count.inspect.pending() && <Spinner />}
    </div>
  );
}

<Counter count={state.inspect.count.box()} />
```

### Value-based tracking

Annotations follow values, not positions. When values match by identity, annotations are preserved through sorts, replacements, and reorders.

#### Arrays

```typescript
const state = new State({ friends: ['Alice', 'Bob', 'Charlie'] });
const process = Symbol('update');

state.mutate((draft) => {
  draft.friends[0] = Operation.Update('Alice-Updated', process);
  draft.friends.sort();
});
```

For object arrays, provide an identity function:

```typescript
const state = new State(
  { people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
  (person) => person.id
);
```

#### Objects

Annotations survive object replacements when values match:

```typescript
const state = new State({ user: { name: 'Alice', age: 30 } });

state.mutate((draft) => {
  draft.user.name = Operation.Update('Alice', process);
});

state.mutate((draft) => {
  draft.user = { name: 'Alice', age: 31 };
});
```

## Implementation

### Core Algorithm

The library uses Immer's `produceWithPatches` to track state changes. When mutations occur with `Draft()` annotations:

1. **Iterate over patches**: Loop through all patches generated by Immer
2. **Clone and apply**: For each patch, clone the model and apply patches up to that point
3. **Find annotations**: Recursively search for `Annotation` instances in `patch.value`
4. **Replace with current values**: Replace annotations with actual values from the cloned model at that path
5. **Store in registry**: Use the identity function to generate a unique key and store the annotation in the registry

### Identity Function

The identity function (`(item) => item?.id ? \`person/\${item.id}\` : undefined`) provides stable keys for tracking values across mutations, similar to React keys. This allows the library to match annotations to current model values even when arrays are sorted or filtered.

### Inspection

The `inspect` proxy uses the identity function to look up annotations in the registry:
- `pending()`: Returns true if an annotation exists for this value
- `draft()`: Returns the draft value from the annotation
- `is(Op)`: Checks if the annotation contains a specific operation type