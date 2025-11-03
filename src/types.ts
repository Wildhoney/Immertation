import { immerable, type Objectish, Immer, enablePatches } from 'immer';
import * as immer from 'immer';
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
   * Symbol used to mark items that should be filtered out during distillation.
   * This is used instead of null/undefined to avoid conflicts with legitimate null/undefined values in the model.
   */
  static nil = Symbol('nil');

  /**
   * The Immer instance used for producing and applying patches.
   */
  static immer = (() => {
    const immer = new Immer();
    enablePatches();
    immer.setAutoFreeze(false);
    return immer;
  })();
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
 * @template S - The slice type
 */
export type Record<T, S extends Slice> = {
  /** The value at this point */
  value: T;
  /** The operations applied */
  operations: State[];
  /** The process that created this record */
  process: Process;
  /** A snapshot of the model at this point */
  slice: null | S;
};

/**
 * A path segment for navigating nested structures.
 */
export type Path = string | number | symbol;

/**
 * A node in the encapsulated tree structure.
 *
 * Wraps values with annotations to track changes.
 *
 * @template T - The value type
 * @template S - The slice type
 */
export class Node<T = unknown, S extends Slice = Slice> {
  [immerable] = true;
  declare [Config.separator]: T;

  /**
   * Creates a new Node.
   *
   * @param current - The current value
   * @param annotation - The annotation containing change records
   */
  constructor(
    current: T,
    public annotation: Annotation<T, S> = Annotation.empty<T, S>()
  ) {
    this[Config.separator] = current;
  }
}

/**
 * Tracks changes to a value through a series of records.
 *
 * @template T - The value type
 * @template S - The slice type
 */
export class Annotation<T, S extends Slice> {
  /** The list of change records */
  public records: Record<T, S>[] = [];

  /**
   * Creates an empty annotation with no records.
   *
   * @template T - The value type
   * @template S - The slice type
   * @returns An empty annotation
   */
  static empty<T, S extends Slice>() {
    return new Annotation<T, S>();
  }

  /**
   * Creates an annotation with a single record.
   *
   * @template T - The value type
   * @template S - The slice type
   * @param value - The value
   * @param operations - The operations applied
   * @param slice - Optional snapshot of the model
   * @param process - The process identifier
   * @returns A new annotation with the record
   */
  static create<T, S extends Slice>(value: T, operations: State[], slice = null, process: Process) {
    const annotation = new Annotation<T, S>();
    annotation.records = [{ value, operations, slice, process }];
    return annotation;
  }

  /**
   * Merges two annotations by concatenating their records.
   *
   * @template T - The value type
   * @template S - The slice type
   * @param a - First annotation
   * @param b - Second annotation
   * @returns A new annotation with combined records
   */
  static merge<T, S extends Slice>(a: Annotation<T, S>, b: Annotation<T, S>): Annotation<T, S> {
    const annotation = new Annotation<T, S>();
    annotation.records = [...A.concat(a.records, b.records)];
    return annotation;
  }

  /**
   * Inserts a slice into the first record of an annotation.
   *
   * @template T - The value type
   * @template S - The slice type
   * @param annotation - The annotation to modify
   * @param slice - The slice to insert
   * @returns A new annotation with the slice inserted
   * @throws {ImmertationError} If the annotation has no records
   */
  static insert<T, S extends Slice>({ records }: Annotation<T, S>, slice: S): Annotation<T, S> {
    if (A.isEmpty(records)) throw new ImmertationError(Exception.EmptyAnnotations);
    const annotation = new Annotation<T, S>();
    annotation.records = [{ ...records[0], slice }, ...records.slice(1)];
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
    try {
      return Annotation.create(immer.current(value) as T, [State.Add], null, process) as T;
    } catch {
      return Annotation.create(value, [State.Add], null, process) as T;
    }
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
    try {
      return Annotation.create(immer.current(value) as T, [State.Remove], null, process) as T;
    } catch {
      return Annotation.create(value, [State.Remove], null, process) as T;
    }
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
    try {
      return Annotation.create(immer.current(value) as T, [State.Update], null, process) as T;
    } catch {
      return Annotation.create(value, [State.Update], null, process) as T;
    }
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
    try {
      return Annotation.create(immer.current(value) as T, [State.Move], null, process) as T;
    } catch {
      return Annotation.create(value, [State.Move], null, process) as T;
    }
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
    try {
      return Annotation.create(
        immer.current(value) as T,
        [State.Update, State.Replace],
        null,
        process
      ) as T;
    } catch {
      return Annotation.create(value, [State.Update, State.Replace], null, process) as T;
    }
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
    try {
      return Annotation.create(immer.current(value) as T, [State.Sort], null, process) as T;
    } catch {
      return Annotation.create(value, [State.Sort], null, process) as T;
    }
  }
}

/**
 * Internal type for proxied values with get and is methods.
 *
 * @internal
 */
type Item<T> = {
  get: (revision?: Revision) => T;
  is: (operation: Operations) => boolean;
} & (T extends (infer U)[]
  ? { [K in keyof T]: Item<U> }
  : T extends object
    ? { [K in keyof T]: Item<T[K]> }
    : Record<string, never>);

/**
 * Extended type that provides get and is methods on all properties.
 *
 * @template T - The base type to extend
 */
export type Extended<T> = T extends (infer U)[]
  ? { [K in keyof T]: Item<U> }
  : T extends object
    ? { [K in keyof T]: Item<T[K]> }
    : never;

/**
 * Recursive tree type that wraps all values in Nodes.
 *
 * @template T - The base type to convert to a tree
 */
export type Tree<T> = T extends null | undefined
  ? Node<T>
  : T extends Annotation<infer U, infer S>
    ? Node<Annotation<U, S>>
    : T extends (infer U)[]
      ? Node<Tree<U>[]>
      : T extends object
        ? Node<{ [K in keyof T]: Tree<T[K]> }>
        : Node<T>;
