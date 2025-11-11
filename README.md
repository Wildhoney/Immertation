# Immertation

A state management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Using operations](#using-operations)
  - [Available operations](#available-operations)
  - [Pruning operations](#pruning-operations)
  - [Listening to changes](#listening-to-changes)
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
const store = new State<Model>({
  name: 'John',
  age: 30
});

// Mutate the model
store.mutate((draft) => {
  draft.name = 'Jane';
  draft.age = 31;
});

// Access values from the model
console.log(store.model.name); // 'Jane'
console.log(store.model.age);  // 31

// Check operation state from annotations using inspect
console.log(store.inspect.name.pending()); // false - no operations tracked
console.log(store.inspect.age.pending());  // false
```

### Using operations

Operations allow you to track pending changes with annotations. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
const process = Symbol('update-user');

store.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

// Model contains the updated values
console.log(store.model.name); // 'Jane'
console.log(store.model.age);  // 31

// Inspect provides helper methods to check operation state
console.log(store.inspect.name.pending()); // true - has pending operations
console.log(store.inspect.name.is(Operation.Update)); // true
console.log(store.inspect.name.is(Operation.Add));    // false

// Get the draft value from the most recent annotation
console.log(store.inspect.name.draft()); // 'Jane'
console.log(store.inspect.age.draft());  // 31
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

store.mutate((draft) => {
  draft.name = Operation.Update('Alice', process1);
});

store.mutate((draft) => {
  draft.age = Operation.Update(25, process2);
});

// Remove all operations from process1
store.prune(process1);

// Model is unchanged (pruning only affects annotations)
console.log(store.model.name); // 'Alice'
console.log(store.model.age);  // 25

// Annotations from process1 are removed
console.log(store.inspect.name.pending()); // false - was pruned
console.log(store.inspect.name.is(Operation.Update)); // false

// Annotations from process2 remain
console.log(store.inspect.age.pending()); // true
console.log(store.inspect.age.is(Operation.Update));  // true
```

### Listening to changes

Register listeners to be notified whenever the model or annotations change. This is particularly useful for integrating with reactive frameworks like React:

```typescript
const store = new State({ count: 0 });

// Register a listener
const unsubscribe = store.listen((state) => {
  console.log('Count changed:', state.model.count);
  console.log('Has pending operations:', state.inspect.count.pending());
});

store.mutate((draft) => {
  draft.count = 1;
}); // Logs: "Count changed: 1"

// Clean up when done
unsubscribe();
```

**React integration example:**

```typescript
function useStore<M>(store: State<M>) {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const unsubscribe = store.listen(() => forceUpdate());
    return unsubscribe;
  }, [store]);

  return store;
}
```

### Value-based tracking

Annotations follow values, not positions. When values match by identity, annotations are preserved through sorts, replacements, and reorders.

#### Arrays

```typescript
const store = new State({ friends: ['Alice', 'Bob', 'Charlie'] });
const process = Symbol('update');

store.mutate((draft) => {
  draft.friends[0] = Operation.Update('Alice-Updated', process);
  draft.friends.sort(); // Annotation follows 'Alice-Updated' to its new position
});
```

For object arrays, provide an identity function:

```typescript
const store = new State(
  { people: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
  (value) => (value as Person).id  // Track by id
);
```

#### Objects

Annotations survive object replacements when values match:

```typescript
const store = new State({ user: { name: 'Alice', age: 30 } });

store.mutate((draft) => {
  draft.user.name = Operation.Update('Alice', process);
});

store.mutate((draft) => {
  draft.user = { name: 'Alice', age: 31 };  // 'Alice' annotation preserved
});