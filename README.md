# Immertation

A state management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Using operations](#using-operations)
  - [Available operations](#available-operations)
  - [Pruning operations](#pruning-operations)

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

// Mutate the model - returns [model, annotations]
const [model, annotations] = store.mutate((draft) => {
  draft.name = 'Jane';
  draft.age = 31;
});

// Access values from the model
console.log(model.name); // 'Jane'
console.log(model.age);  // 31

// Check operation state from annotations
console.log(annotations.name.pending()); // false - no operations tracked
console.log(annotations.age.pending());  // false
```

### Using operations

Operations allow you to track pending changes with annotations. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
const process = Symbol('update-user');

const [model, annotations] = store.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

// Model contains the updated values
console.log(model.name); // 'Jane'
console.log(model.age);  // 31

// Annotations provide helper methods to check operation state
console.log(annotations.name.pending()); // true - has pending operations
console.log(annotations.name.is(Operation.Update)); // true
console.log(annotations.name.is(Operation.Add));    // false

// Get the draft value from the most recent annotation
console.log(annotations.name.draft()); // 'Jane'
console.log(annotations.age.draft());  // 31
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
const [model, annotations] = store.prune(process1);

// Model is unchanged (pruning only affects annotations)
console.log(model.name); // 'Alice'
console.log(model.age);  // 25

// Annotations from process1 are removed
console.log(annotations.name.pending()); // false - was pruned
console.log(annotations.name.is(Operation.Update)); // false

// Annotations from process2 remain
console.log(annotations.age.pending()); // true
console.log(annotations.age.is(Operation.Update));  // true
```