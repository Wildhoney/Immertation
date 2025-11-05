import { A, G, D } from '@mobily/ts-belt';

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
 * A slice of the model state.
 */
export type Slice = any;

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
 * Error exceptions for Immertation operations.
 */
export enum Exception {
  EmptyAnnotations = 'EmptyAnnotations',
}

/**
 * Custom error class for Immertation errors.
 */
export class ImmertationError extends Error {
  constructor(exception: Exception) {
    super(exception);
    this.name = 'ImmertationError';
  }
}

/**
 * A record of a change operation in an annotation.
 */
export type AnnotationRecord<T, S> = {
  value: T;
  operations: State[];
  slice: S | null;
  process: Process;
};

/**
 * A record stored in a Node to track changes.
 */
export type Annotation<T> = {
  value: T;
  state: State;
  process: Process;
};

/**
 * Recursive tree type that wraps all values in Nodes.
 *
 * @template T - The base type to convert to a tree
 */
export type Tree<T> = T extends null | undefined
  ? Node<T>
  : T extends (infer U)[]
    ? Node<Tree<U>[]>
    : T extends object
      ? Node<{ [K in keyof T]: Tree<T[K]> }> & { [K in keyof T]: Tree<T[K]> }
      : Node<T>;

/**
 * Unwraps a Tree type to get the original plain type.
 *
 * @template T - The Tree type to unwrap
 */
export type Value<T> =
  T extends Node<infer U>
    ? Value<U>
    : T extends (infer U)[]
      ? Value<U>[]
      : T extends object
        ? { [K in keyof T]: Value<T[K]> }
        : T;

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
 * Base class for wrapping values in the tree structure.
 * Nodes enable tracking and annotation of changes at any level of the data structure.
 *
 * @template T - The type of value being wrapped
 */
export class Node<T> {
  #value: T;
  #annotations: Annotation<T>[] = [];

  constructor(value: T) {
    this.#value = value;

    // Create getters for object properties
    if (!G.isNullable(value) && G.isObject(value) && !G.isArray(value)) {
      Object.keys(value as any).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(this, key)) {
          const getValue = () => this.#value;
          const getAnnotations = () => this.#annotations;
          Object.defineProperty(this, key, {
            get() {
              const currentNode = (getValue() as any)[key];
              const annotation = A.head(getAnnotations());

              if (annotation && currentNode instanceof Node) {
                // If there's an annotation on the parent, the nested node should get an annotation too
                const draftValue = (annotation.value as any)[key];
                if (draftValue instanceof Node) {
                  // Add an annotation to the current node with the draft node's value
                  const draftPrimitiveValue = draftValue.get(0 as any);
                  (currentNode as any).#annotations = [
                    {
                      value: draftPrimitiveValue,
                      state: annotation.state,
                      process: annotation.process,
                    },
                  ];
                }
              }

              return currentNode;
            },
            enumerable: true,
            configurable: true,
          });
        }
      });
    }
  }

  /**
   * Gets the wrapped value.
   *
   * @param revision - The revision to retrieve (Current or Draft)
   * @returns The wrapped value
   */
  get(revision: Revision): T {
    if (revision === Revision.Current) return this.#value;
    const annotation = A.head(this.#annotations);
    if (annotation) return annotation.value as T;
    return this.#value;
  }

  /**
   * Sets the value of this node.
   *
   * @param value - The new value to set
   * @param states - Optional state flags for the update
   */
  set(value: Value<T>, states?: State | number): void {
    // For object nodes, encapsulate the value. For primitive nodes, use as-is
    const wrappedValue =
      G.isObject(this.#value) && !G.isArray(this.#value) && !G.isNullable(this.#value)
        ? D.map(value as Record<string, unknown>, (v) => this.#encapsulate(v))
        : value;

    if (!G.isNullable(states)) {
      // Add annotation to this node
      this.#annotations = [
        {
          value: wrappedValue as T,
          state: states,
          process: Symbol('update'), // TODO: Pass process from somewhere
        },
        ...this.#annotations,
      ];
    } else {
      // Replace the value directly
      this.#value = wrappedValue as T;
    }
  }

  /**
   * Wraps a value in Nodes. Similar to the encapsulate function in utils.
   * @private
   */
  #encapsulate(value: unknown): unknown {
    if (G.isNullable(value)) return new NodeP(value);
    if (G.isArray(value)) return new NodeA(A.map(value, (v) => this.#encapsulate(v)));
    if (G.isObject(value)) return new NodeO(D.map(value, (v) => this.#encapsulate(v)));
    return new NodeP(value);
  }

  /**
   * Checks if this node has pending changes (annotations).
   *
   * @returns True if there are annotations, false otherwise
   */
  pending(): boolean {
    return A.isNotEmpty(this.#annotations);
  }
}

/**
 * Node wrapper for primitive values (strings, numbers, booleans, null, undefined).
 *
 * @template T - The primitive type being wrapped
 */
export class NodeP<T> extends Node<T> {}

/**
 * Node wrapper for object values.
 *
 * @template T - The object type being wrapped
 */
export class NodeO<T> extends Node<T> {}

/**
 * Node wrapper for array values.
 *
 * @template T - The array type being wrapped
 */
export class NodeA<T> extends Node<T> {}
