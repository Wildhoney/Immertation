import { Immer, enablePatches, immerable } from 'immer';
import { A } from '@mobily/ts-belt';

/**
 * Configuration for the state management system.
 */
export class Config {
  /**
   * The property name used to access the current value in Node instances.
   */
  static separator = 'current' as const;

  /**
   * The Immer instance used for producing and applying patches.
   */
  static get immer() {
    const immer = new Immer();
    enablePatches();
    immer.setAutoFreeze(false);
    return immer;
  }
}

/**
 * A function that mutates a draft of the model.
 *
 * @template M - The model type
 */
export type Recipe<M> = (draft: M) => void;

/**
 * A function that returns a unique identifier for a value.
 * Used to track values through array operations (sort, reorder, replacement).
 *
 * @template T - The value type
 * @returns A unique identifier (string, number, or symbol), or undefined/void to fall back to F.equals
 */
export type Identity<T = unknown> = [T] extends [never]
  ? (value: unknown) => string | number | symbol | undefined | void
  : (
      value: Exclude<
        T extends (infer U)[]
          ? Identity<U> | U
          : T extends object
            ? { [K in keyof T]: Identity<T[K]> }[keyof T] | T
            : never,
        undefined
      >
    ) => string | number | symbol | undefined | void;

export const defaultIdentity: Identity = () => undefined;

/**
 * Helper type for extracting identity value types from a model.
 * @internal
 */
export type IdentityValueType<M> = Exclude<
  M extends (infer U)[]
    ? Identity<U> | U
    : M extends object
      ? { [K in keyof M]: Identity<M[K]> }[keyof M] | M
      : never,
  undefined
>;

/**
 * A unique identifier for a mutation process.
 */
export type Process = symbol;

/**
 * A listener function that is called when state changes.
 *
 * @template T - The state type
 */
export type Listener<T> = (state: T) => void;

/**
 * Operation events that can be applied to values.
 */
export enum Event {
  /** Value was added */
  Add,
  /** Value was removed */
  Remove,
  /** Value was updated */
  Update,
  /** Value was moved */
  Move,
  /** Value was replaced */
  Replace,
  /** Value was sorted */
  Sort,
}

/**
 * A record of a value change with associated metadata.
 *
 * @template T - The value type
 */
export type Task<T> = {
  /** The value at this point */
  state: T;
  /** The operations applied */
  operations: Event[];
  /** The process that created this record */
  process: Process;
};

/**
 * A path segment for navigating nested structures.
 */
export type Path = string | number | symbol;

/**
 * Tracks changes to a value through a series of tasks.
 *
 * @template T - The value type
 */
export class Annotation<T> {
  /** The list of change tasks */
  public tasks: Task<T>[] = [];

  /**
   * Creates an empty annotation with no tasks.
   *
   * @template T - The value type
   * @returns An empty annotation
   */
  static empty<T>() {
    return new Annotation<T>();
  }

  /**
   * Creates an annotation with a single task.
   *
   * @template T - The value type
   * @param value - The value
   * @param operations - The operations applied
   * @param process - The process identifier
   * @returns A new annotation with the task
   */
  static create<T>(value: T, operations: Event[], process: Process) {
    const annotation = new Annotation<T>();
    annotation.tasks = [{ state: value, operations, process }];
    return annotation;
  }

  /**
   * Merges two annotations by concatenating their tasks.
   *
   * @template T - The value type
   * @param a - First annotation
   * @param b - Second annotation
   * @returns A new annotation with combined tasks
   */
  static merge<T>(a: Annotation<T>, b: Annotation<T>): Annotation<T> {
    const annotation = new Annotation<T>();
    annotation.tasks = [...A.concat(a.tasks, b.tasks)];
    return annotation;
  }

  /**
   * Restores an annotation from a filtered set of tasks.
   *
   * This is primarily used for pruning operations where tasks need to be filtered
   * by process and restored into a new annotation instance.
   *
   * @template T - The value type
   * @param tasks - The tasks to restore
   * @returns A new annotation with the provided tasks
   *
   * @example
   * ```typescript
   * const filtered = annotation.tasks.filter(task => task.process !== processToRemove);
   * const restored = Annotation.restore(filtered);
   * ```
   */
  static restore<T>(tasks: Task<T>[]): Annotation<T> {
    const annotation = new Annotation<T>();
    annotation.tasks = tasks;
    return annotation;
  }

  /**
   * Gets the value from the most recent task.
   *
   * This is used internally when unwrapping Annotation instances during patch operations.
   *
   * @returns The value from the last task, or undefined if no tasks exist
   */
  state(): T | undefined {
    const task = A.last(this.tasks);
    return task?.state;
  }
}

/**
 * A node that wraps a value with its annotations.
 */
export class Node<T = unknown> {
  [immerable] = true;

  /**
   * Creates a new Node instance.
   *
   * @param current - The current value stored in this node
   * @param annotation - The annotation tracking operations on this value (defaults to empty)
   */
  constructor(
    public current: T,
    public annotation: Annotation<T> = Annotation.empty<T>()
  ) {}
}

/**
 * Union type of all operation types.
 */
export type Operations =
  | typeof Operation.Add
  | typeof Operation.Remove
  | typeof Operation.Update
  | typeof Operation.Move
  | typeof Operation.Replace
  | typeof Operation.Sort
  | typeof Operation.Custom;

/**
 * Factory for creating annotated values with operation markers.
 *
 * @example
 * ```typescript
 * const process = Symbol('update');
 * draft.name = Operation.Update('Jane', process);
 * ```
 */
export class Operation {
  /**
   * Marks a value as added.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Add<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Add], process) as T;
  }

  /**
   * Marks a value as removed.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Remove<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Remove], process) as T;
  }

  /**
   * Marks a value as updated.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Update<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Update], process) as T;
  }

  /**
   * Marks a value as moved.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Move<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Move], process) as T;
  }

  /**
   * Marks a value as replaced (combines Update and Replace events).
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Replace<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Replace], process) as T;
  }

  /**
   * Marks a value as sorted.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Sort<T>(value: T, process: Process): T {
    return Annotation.create(value, [Event.Sort], process) as T;
  }

  /**
   * Marks a value with custom operation events.
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param operations - The array of operation events to apply
   * @param process - The process identifier
   * @returns The annotated value
   *
   * @example
   * ```typescript
   * const process = Symbol('custom');
   * draft.item = Operation.Custom(newValue, [Event.Update, Event.Move], process);
   * ```
   */
  static Custom<T>(value: T, operations: Event[], process: Process): T {
    return Annotation.create(value, operations, process) as T;
  }
}

/**
 * Recursively wraps a type in Node instances.
 *
 * @template T - The base type to wrap
 */
export type Tree<T> = T extends (infer U)[]
  ? Node<Tree<U>[]>
  : T extends object
    ? Node<{ [K in keyof T]: Tree<T[K]> }>
    : Node<T>;

/**
 * Annotated methods available on annotation proxies for querying operation state.
 *
 * These methods are dynamically added to all properties in the model structure
 * via the proxy returned by `mutate()` and `prune()`.
 *
 * @template T - The value type being wrapped
 */
type Annotated<T = unknown> = {
  /** Returns true if this property has any pending annotation tasks */
  pending: () => boolean;
  /** Returns the count of annotation tasks for this property */
  remaining: () => number;
  /** Checks if this property has a specific operation type in its annotation tasks */
  is(operation: Operations): boolean;
  /** Returns the value from the most recent annotation task, or the current value if no tasks */
  draft(): T;
  /** Returns a tuple of [value, annotated proxy] for easy prop passing with annotations */
  box(): Box<T>;
};

/**
 * Recursively decorates a type with helper methods at every level.
 *
 * This mapped type ensures that the annotation proxy maintains the same structure
 * as the original model while adding `pending()`, `is()`, and `draft()` methods
 * to every property at every level of nesting.
 *
 * @template M - The base model type to make inspectable
 */
export type Inspectable<M> = M extends (infer U)[]
  ? {
      [K in keyof M]: Inspectable<U>;
    } & Annotated<U>
  : M extends object
    ? { [K in keyof M]: Inspectable<M[K]> } & Annotated<M>
    : Annotated<M>;

/**
 * A boxed value containing both the raw value and its annotated proxy.
 *
 * This type represents the return value of the `box()` method, making it easy
 * to pass values with their annotations to components.
 *
 * @template T - The value type being boxed
 *
 * @example
 * ```typescript
 * type Props = {
 *   count: Box<number>;
 * };
 *
 * function Component({ count }: Props) {
 *   return (
 *     <div>
 *       <span>{count.model}</span>
 *       {count.inspect.pending() && <Spinner />}
 *     </div>
 *   );
 * }
 * ```
 */
export type Box<T> = {
  model: T;
  inspect: Inspectable<T>;
};

/**
 * Internal container that holds the actual model value.
 *
 * This type is used internally by the proxy handler to wrap the model in an object,
 * allowing the proxy to work with primitive values as well as objects and arrays.
 *
 * @template T - The value type being wrapped
 * @internal
 */
export type Container<T> = { value: T };
