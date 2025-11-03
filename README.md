# Immertation

Immertation is a state management library that tracks changes to your data using Immer patches and provides a powerful annotation system for operation tracking.

## Getting Started

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

### Using Operations

Operations allow you to track how values change with annotations:

```typescript
const process = Symbol('update-user');

const model = store.mutate((draft) => {
  draft.name = Operation.Update('Jane', process);
  draft.age = Operation.Update(31, process);
});

// Check the current value (before operation applied)
console.log(model.name.get(Revision.Current)); // 'John'

// Check the draft value (after operation applied)
console.log(model.name.get(Revision.Draft)); // 'Jane'

// Check if specific operations were applied
console.log(model.name.is(Operation.Update)); // true
console.log(model.name.is(Operation.Add));    // false
```

### Available Operations

- `Operation.Add` - Mark a value as added
- `Operation.Remove` - Mark a value as removed
- `Operation.Update` - Mark a value as updated
- `Operation.Replace` - Mark a value as updated and replaced
- `Operation.Move` - Mark a value as moved
- `Operation.Sort` - Mark a value as sorted

### Pruning Operations

Remove operation records by process:

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

## How It Works

1. On instantiation of Immeration we create new model that is then augmented with Node values
2. Augment receipt paths and assignments to map to the Node shape
3. Reconciliation by merging annotations when an Annotation type appears in the "current" prop
