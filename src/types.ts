import { type Objectish, Immer, enablePatches, immerable } from 'immer';
import { A } from '@mobily/ts-belt';

/**
 * Exception types for Immertation errors.
 */
export enum Exception {
  /**
   * Thrown when attempting to access or modify an annotation with no records.
   */
  EmptyAnnotations,
}

/**
 * Custom error class for Immertation-specific exceptions.
 *
 * @example
 * ```typescript
 * throw new ImmertationError(Exception.EmptyAnnotations);
 * ```
 */
export class ImmertationError extends Error {
  /**
   * Creates a new ImmertationError.
   *
   * @param type - The exception type
   */
  constructor(public type: Exception) {
    super();
    this.name = 'ImmertationError';
  }
}

/**
 * Configuration for the Immertation system.
 */
export class Config {
  /**
   * The property name used to access the current value in Node instances.
   */
  static separator = 'current' as const;

  /**
   * A unique symbol representing a nil/empty value.
   */
  static nil = Symbol('nil');

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
 * A unique identifier for a mutation process.
 */
export type Process = symbol;

/**
 * Operation states that can be applied to values.
 */
export enum State {
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
 * Revision types for accessing values.
 */
export enum Revision {
  /** The current committed value */
  Current,
  /** The draft value with operations applied */
  Draft,
}

/**
 * A snapshot of the model state.
 */
export type Slice = Objectish;

/**
 * A record of a value change with associated metadata.
 *
 * @template T - The value type
 */
export type Record<T> = {
  /** The value at this point */
  value: T;
  /** The operations applied */
  operations: State[];
  /** The process that created this record */
  process: Process;
};

/**
 * A path segment for navigating nested structures.
 */
export type Path = string | number | symbol;

/**
 * Tracks changes to a value through a series of records.
 *
 * @template T - The value type
 */
export class Annotation<T> {
  /** The list of change records */
  public records: Record<T>[] = [];

  /**
   * Creates an empty annotation with no records.
   *
   * @template T - The value type
   * @returns An empty annotation
   */
  static empty<T>() {
    return new Annotation<T>();
  }

  /**
   * Creates an annotation with a single record.
   *
   * @template T - The value type
   * @param value - The value
   * @param operations - The operations applied
   * @param process - The process identifier
   * @returns A new annotation with the record
   */
  static create<T>(value: T, operations: State[], process: Process) {
    const annotation = new Annotation<T>();
    annotation.records = [{ value, operations, process }];
    return annotation;
  }

  /**
   * Merges two annotations by concatenating their records.
   *
   * @template T - The value type
   * @param a - First annotation
   * @param b - Second annotation
   * @returns A new annotation with combined records
   */
  static merge<T>(a: Annotation<T>, b: Annotation<T>): Annotation<T> {
    const annotation = new Annotation<T>();
    annotation.records = [...A.concat(a.records, b.records)];
    return annotation;
  }

  /**
   * Gets the draft value from the last record.
   *
   * @returns The draft value
   * @throws {ImmertationError} If there are no records
   */
  get draft(): T {
    const record = A.last(this.records);
    if (!record) throw new ImmertationError(Exception.EmptyAnnotations);
    return record.value;
  }

  /**
   * Gets the operations from the last record.
   *
   * @returns The operations array, or empty array if no records
   */
  get operations(): State[] {
    const record = A.last(this.records);
    if (!record) {
      return [];
    }
    return record.operations;
  }

  /**
   * Gets the value from the last record.
   *
   * @returns The value
   * @throws {ImmertationError} If there are no records
   */
  get value(): T {
    const record = A.last(this.records);
    if (!record) throw new ImmertationError(Exception.EmptyAnnotations);
    return record.value;
  }
}

/**
 * A node that wraps a value with its annotations.
 */
export class Node<T = unknown> {
  [immerable] = true;

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
  | typeof Operation.Sort;

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
    return Annotation.create(value, [State.Add], process) as T;
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
    return Annotation.create(value, [State.Remove], process) as T;
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
    return Annotation.create(value, [State.Update], process) as T;
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
    return Annotation.create(value, [State.Move], process) as T;
  }

  /**
   * Marks a value as replaced (combines Update and Replace states).
   *
   * @template T - The value type
   * @param value - The value to mark
   * @param process - The process identifier
   * @returns The annotated value
   */
  static Replace<T>(value: T, process: Process): T {
    return Annotation.create(value, [State.Replace], process) as T;
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
    return Annotation.create(value, [State.Sort], process) as T;
  }
}

/**
 * Internal type for proxied values with get, is, and pending methods.
 *
 * @internal
 */
type Item<T> = {
  get: (revision: Revision) => T;
  is: (operation: Operations) => boolean;
  pending: () => boolean;
} & (T extends (infer U)[]
  ? { [K in keyof T]: Item<U> }
  : T extends object
    ? { [K in keyof T]: Item<T[K]> }
    : globalThis.Record<string, never>);

/**
 * Recursively wraps a type in Node instances.
 *
 * @template T - The base type to wrap
 */
export type Annotated<T> = T extends (infer U)[]
  ? Node<Annotated<U>[]>
  : T extends object
    ? Node<{ [K in keyof T]: Annotated<T[K]> }>
    : Node<T>;

/**
 * Extended type that provides get, is, and pending methods on all properties.
 *
 * @template T - The base type to extend
 */
export type Extended<T> = T extends (infer U)[]
  ? { [K in keyof T]: Item<U> }
  : T extends object
    ? { [K in keyof T]: Item<T[K]> }
    : never;
