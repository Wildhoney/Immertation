# Hyakkaten

Immertation is a state management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

Operations are particularly useful for async operations and optimistic updates, where the model is being operated on but not yet committed to the final value. This allows you to track pending changes and distinguish between the current committed state and the draft state with pending operations.

## Contents

- [Getting started](#getting-started)
  - [Using operations](#using-operations)
  - [Available operations](#available-operations)
  - [Pruning operations](#pruning-operations)

## Getting started

```typescript
import { Immeration, Operation, Revision } from 'immertation';

// Define your model type
type Model = {
  name: string;
  age: number;
};

// Create an instance with initial data
const store = new Immeration<Model>({
  name: 'John',
  age: 30
});

// Mutate the model
const model = store.mutate((draft) => {
  draft.name = 'Jane';
  draft.age = 31;
});

// Access values
console.log(model.name.get()); // 'Jane'
console.log(model.age.get());  // 31
```

### Using operations

Operations allow you to track pending changes with annotations. This is especially useful for optimistic updates in async operations, where you want to immediately reflect changes in the UI while the operation is still in progress:

```typescript
const process = Symbol('update-user');

const model = store.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

// Check the current committed value
console.log(model.name.get(Revision.Current)); // 'John'

// Check the draft value with pending operations
console.log(model.name.get(Revision.Draft)); // 'Jane'

// Check if specific operations are pending
console.log(model.name.is(Operation.Update)); // true
console.log(model.name.is(Operation.Add));    // false

// Check if any operations are pending
console.log(model.name.pending()); // true
```

### Available operations

- `Operation.Add` - Mark a value as being added
- `Operation.Remove` - Mark a value as being removed
- `Operation.Update` - Mark a value as being updated
- `Operation.Replace` - Mark a value as being updated and replaced
- `Operation.Move` - Mark a value as being moved
- `Operation.Sort` - Mark a value as being sorted

### Pruning operations

Remove operation records by process. This is useful when async operations complete or fail, allowing you to commit or rollback optimistic updates:

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
const model = store.prune(process1);

console.log(model.name.is(Operation.Update)); // false
console.log(model.age.is(Operation.Update));  // true
```