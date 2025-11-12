# Immertation

A state management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

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

// Define your model type
type Model = {
  name: string;
  age: number;
};

// Create an instance with initial data
const state = new State<Model>({
  name: 'John',
  age: 30
});

// Mutate the model
state.mutate((draft) => {
  draft.name = 'Jane';
  draft.age = 31;
});

// Access values from the model
console.log(state.model.name); // 'Jane'
console.log(state.model.age);  // 31

// Check operation state from annotations using inspect
console.log(state.inspect.name.pending()); // false - no operations tracked
console.log(state.inspect.age.pending());  // false
```

### Using operations

Operations allow you to track pending changes with annotations. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
const process = Symbol('update-user');

state.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

// Model contains the updated values
console.log(state.model.name); // 'Jane'
console.log(state.model.age);  // 31

// Inspect provides helper methods to check operation state
console.log(state.inspect.name.pending()); // true - has pending operations
console.log(state.inspect.name.remaining()); // 1 - count of pending operations
console.log(state.inspect.name.is(Operation.Update)); // true
console.log(state.inspect.name.is(Operation.Add));    // false

// Get the draft value from the most recent annotation
console.log(state.inspect.name.draft()); // 'Jane'
console.log(state.inspect.age.draft());  // 31
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

// Remove all operations from process1
state.prune(process1);

// Model is unchanged (pruning only affects annotations)
console.log(state.model.name); // 'Alice'
console.log(state.model.age);  // 25

// Annotations from process1 are removed
console.log(state.inspect.name.pending()); // false - was pruned
console.log(state.inspect.name.is(Operation.Update)); // false

// Annotations from process2 remain
console.log(state.inspect.age.pending()); // true
console.log(state.inspect.age.is(Operation.Update));  // true
```

### Listening to changes

Register listeners to be notified whenever the model or annotations change. This is particularly useful for integrating with reactive frameworks like React:

```typescript
const state = new State({ count: 0 });

// Register a listener
const unsubscribe = state.listen((state) => {
  console.log('Count changed:', state.model.count);
  console.log('Has pending operations:', state.inspect.count.pending());
});

state.mutate((draft) => {
  draft.count = 1;
}); // Logs: "Count changed: 1"

// Clean up when done
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

// Usage
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
  draft.friends.sort(); // Annotation follows 'Alice-Updated' to its new position
});
```

For object arrays, provide an identity function:

```typescript
const state = new State(
  { people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
  (person) => person.id  // Track by id
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
  draft.user = { name: 'Alice', age: 31 };  // 'Alice' annotation preserved
});