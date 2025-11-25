import type { Objectish, Patch } from 'immer';
import { immerable } from 'immer';

/** Base model type that can be used with State */
export type Model = Objectish;

/** Context for patch reconciliation during mutations */
export type Reconciliation<M extends Model> = {
  snapshot: M;
  patches: Patch[];
};

/** Property key for annotation tracking */
export type Property = undefined | null | string | number;

/** Recursive snapshot type for identity function */
export type Snapshot<T> = T extends (infer U)[] ? T | Snapshot<U> : T extends object ? T | Snapshot<T[keyof T]> : never;

/** Function that generates unique IDs from model snapshots */
export type Identity<M extends Model> = (snapshot: Snapshot<M>) => Id;

/** Immer recipe function for mutating the draft */
export type Recipe<M extends Model> = (draft: M) => void;

/** Unique symbol identifying a mutation batch */
export type Process = symbol;

/** Operation types for annotations */
export enum Operation {
  Add = 1,
  Remove = 2,
  Update = 4,
  Move = 8,
  Replace = 16,
  Sort = 32,
}

/** String identifier for registry keys */
export type Id = string;

/** Array path to a value in the model */
export type Path = (string | number)[];

/** Methods available on inspect proxy */
type Inspectors<T = unknown> = {
  /** Returns true if any pending annotations exist */
  pending(): boolean;
  /** Returns true if annotation matches the given operation */
  is(operation: Operation): boolean;
  /** Returns the draft value from the latest annotation, or the actual value from the model */
  draft(): T | undefined;
  /** Returns a promise that resolves with the value when no more annotations exist at this path */
  settled(): Promise<T>;
};

/** Recursive proxy type for inspecting annotations at any path */
export type Inspect<T> = Inspectors<T> & {
  [K in keyof T as T[K] extends (...args: unknown[]) => unknown ? never : K]: Inspect<T[K]>;
};

/** Internal keys for Annotation class properties */
enum Keys {
  Property = 'property',
  Process = 'process',
  Value = 'value',
  Operation = 'operation',
}

/**
 * Wrapper for values being tracked with pending operations.
 * @template T - The wrapped value type
 */
export class Annotation<T> {
  [immerable] = true;

  static readonly keys: Set<string> = new Set(Object.values(Keys));

  public [Keys.Property]: Property = null;
  public [Keys.Process]: null | Process = null;
  public [Keys.Value]: T;
  public [Keys.Operation]: Operation;

  /**
   * @param {T} value - The value to wrap
   * @param {Operation} operation - The operation type
   */
  constructor(value: T, operation: Operation) {
    this[Keys.Value] = value;
    this[Keys.Operation] = operation;
  }

  /**
   * Creates a copy with property and process assigned.
   * @param {Property} property - The property key
   * @param {Process} process - The process symbol
   * @returns {Annotation<T>} New annotation with assignments
   */
  assign(property: Property, process: Process): Annotation<T> {
    const annotation = new Annotation(this.value, this.operation);
    annotation.property = property;
    annotation.process = process;
    return annotation;
  }
}

/** Map of IDs to their annotations */
export type Registry<M extends Model> = Map<Id, Annotation<M>[]>;

/** Callback for registry change subscriptions */
export type Subscriber = () => void;

/** Function to add or remove a subscriber */
export type Subscribe = (subscriber: Subscriber) => void;
