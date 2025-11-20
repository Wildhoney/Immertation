import { A } from '@mobily/ts-belt';
import { Immer, type Patch, enablePatches, type Objectish, current, isDraft } from 'immer';

export type { Objectish };

/**
 * A record with string keys and unknown values.
 */
export type Object = Record<string, unknown>;

/**
 * Configuration class for internal library settings.
 *
 * @remarks
 * Holds the Immer instance used for producing patches and tracking state changes.
 */
export class Config {
  /** Immer instance used for patch-based state tracking */
  static immer = (() => {
    enablePatches();
    return new Immer();
  })();
}

/**
 * A function that mutates a draft of the model.
 *
 * @template M - The model type (must be an object or array)
 */
export type Recipe<M extends Objectish> = (draft: M) => void;

/**
 * Helper type that extracts object types from a value, handling arrays and nested objects.
 * Includes both the array itself and the items within it.
 */
type ExtractFromValue<T> = T extends (infer U)[]
  ? U extends object
    ? T | U | ExtractObjectish<U>
    : never
  : T extends object
    ? T | ExtractObjectish<T>
    : never;

/**
 * Recursively extracts all Objectish types from a model type.
 * This creates a union of all objects and arrays within the model structure.
 * If no nested objects are found, returns the model itself.
 *
 * @template M - The model type to extract Objectish types from
 */
export type ExtractObjectish<M> = M extends object
  ? {
      [K in keyof M]: ExtractFromValue<M[K]>;
    }[keyof M] extends never
    ? M
    : {
        [K in keyof M]: ExtractFromValue<M[K]>;
      }[keyof M]
  : never;

/**
 * A function that returns a unique string identifier for a value, similar to React keys.
 * Used to track values and match annotations to current model state.
 *
 * The identity function must handle both objects and arrays. The developer decides
 * what makes each unique.
 *
 * @template T - The union of all Objectish types from the model
 * @returns A unique string key
 *
 * @example
 * ```typescript
 * // Handle both objects and arrays:
 * const identity = (value: any) => {
 *   if (Array.isArray(value)) {
 *     return `friends/${value.map(item => item.id).join(',')}`;
 *   }
 *   return `friend/${value.id}`;
 * };
 *
 * // For simple values:
 * const identity = (value: any) => String(value);
 * ```
 */
export type Identity<T = unknown> = (value: T) => string;

/**
 * An identifier that uniquely identifies a value in the model.
 * Uses the identity function result as the stable key.
 */
export type Id = string;

/**
 * Stores patches for a specific process.
 */
export type PatchSet = {
  process: Process;
  patches: Patch[];
};

/**
 * A registry mapping identity keys to their annotations.
 */
export type Registry = Map<Id, Annotation<unknown>>;

/**
 * A registry of patches for each process.
 */
export type PatchRegistry = Map<Process, PatchSet>;

/**
 * A unique identifier for a mutation process.
 */
export type Process = symbol;

/**
 * An observer function that is called when state changes.
 *
 * @template T - The state type
 */
export type Observer<T> = (state: T) => void;

/**
 * A set of observer functions.
 *
 * @template T - The state type
 */
export type Observers<T> = Set<Observer<T>>;

/**
 * Op kinds that can be applied to values.
 * Uses bitwise flags so multiple operations can be combined.
 */
export enum Op {
  /** Value was added */
  Add = 1,
  /** Value was removed */
  Remove = 2,
  /** Value was updated */
  Update = 4,
  /** Value was moved */
  Move = 8,
  /** Value was replaced */
  Replace = 16,
  /** Value was sorted */
  Sort = 32,
}

/**
 * A record of a value change with associated metadata.
 *
 * @template T - The value type
 */
export type Task<T> = {
  value: T;
  property: Property;
  state: Op[];
  process: Process;
};

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

  /**
   * Creates an annotation with a single task.
   *
   * @template T - The value type
   * @param current - The current value
   * @param next - The next value for the operation
   * @param operations - The operations applied
   * @param process - The process identifier
   * @param property - The property name/index if this was a property assignment
   * @returns A new annotation with the task
   */
  static new<T>(value: T, state: Op[], process: Process, property: Property = null) {
    const annotation = new Annotation<T>();
    annotation.tasks = [{ value, property, state, process }];
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
   * Removes tasks associated with a specific process from this annotation.
   *
   * @template T - The value type
   * @param process - The process identifier whose tasks should be removed
   * @returns A new annotation with tasks filtered to exclude the specified process, or null if no tasks remain
   *
   * @example
   * ```typescript
   * const prunedAnnotation = annotation.prune(processToRemove);
   * if (prunedAnnotation === null) {
   *   // All tasks were removed
   * }
   * ```
   */
  prune(process: Process): Annotation<T> | null {
    const tasks = this.tasks.filter((task) => task.process !== process);
    if (A.length(tasks) === 0) return null;
    const annotation = new Annotation<T>();
    annotation.tasks = tasks;
    return annotation;
  }
}

/**
 * Creates an annotated draft value with the specified state operations.
 *
 * @template T - The value type
 * @param value - The value to annotate
 * @param op - Bitwise combination of Op enum values
 * @returns The annotated value
 *
 * @example
 * ```typescript
 * // Single operation
 * Draft(name, Op.Update)
 *
 * // Multiple operations using bitwise OR
 * Draft(name, Op.Update | Op.Replace)
 * ```
 */
export function Draft<T>(value: T, op: number): T {
  const ops = [
    op & Op.Add ? Op.Add : null,
    op & Op.Remove ? Op.Remove : null,
    op & Op.Update ? Op.Update : null,
    op & Op.Move ? Op.Move : null,
    op & Op.Replace ? Op.Replace : null,
    op & Op.Sort ? Op.Sort : null,
  ].filter((o): o is Op => o !== null);

  // Convert Immer draft proxies to plain objects to avoid revoked proxy errors
  const rawValue = isDraft(value) ? current(value) : value;

  return Annotation.new(rawValue, ops, null as unknown as Process) as T;
}

/**
 * A property key that can be a string (object property), number (array index), or null (no property).
 *
 * @remarks
 * - `string`: represents an object property key
 * - `number`: represents an array index
 * - `null`: represents no property association (root level)
 */
export type Property = string | number | null;

/**
 * Inspection methods available on proxies for querying operation state.
 *
 * These methods are dynamically added to all properties in the model structure
 * via the proxy returned by the `inspect` getter.
 *
 * @template T - The value type being wrapped
 */
type Inspectors<T = unknown> = {
  /** Returns true if this property has any pending annotation tasks */
  pending: () => boolean;
  /** Returns the count of annotation tasks for this property */
  remaining: () => number;
  /** Checks if this property has a specific operation type in its annotation tasks */
  is(op: Op): boolean;
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
    } & Inspectors<M>
  : M extends object
    ? { [K in keyof M]: Inspectable<M[K]> } & Inspectors<M>
    : Inspectors<M>;

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
 * Example type representing a person entity used in tests and examples.
 *
 * @remarks
 * This type is exported for use in examples and tests to demonstrate
 * the library's functionality with a concrete data structure.
 */
export type Person = {
  /** Unique identifier for the person */
  id: symbol;
  /** Person's name */
  name: string;
  /** Person's age */
  age: number;
};

/**
 * Example type representing the root model structure used in tests and examples.
 *
 * @remarks
 * This type is exported for use in examples and tests to demonstrate
 * the library's functionality with a concrete data structure.
 */
export type Model = {
  /** Collection of people in the model */
  people: Person[];
};
