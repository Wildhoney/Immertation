import type { Objectish } from 'immer';
import type { Recipe, Annotated, Process, Identity, Listener, Decorate } from './types';
import { apply, annotate, decorate, prune as cleanup } from './utils';
import { F } from '@mobily/ts-belt';

const defaultIdentity: Identity<any> = (F as any).ignore;

/**
 * Main class for managing immutable state with operation tracking.
 *
 * State provides a way to track mutations to immutable state through operation annotations.
 * Each mutation can be marked with an operation type (Add, Update, Remove, etc.) and a process
 * identifier, allowing you to query what operations are pending and prune them when complete.
 *
 * Use the `model` getter to access the current state and the `inspect` getter to access
 * the annotation proxy for querying operation state.
 *
 * @template M - The model type to manage
 *
 * @example
 * ```typescript
 * type Model = { name: string; age: number };
 * const store = new State<Model>({ name: 'John', age: 30 });
 *
 * const process = Symbol('update');
 * store.mutate((draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 *
 * console.log(store.model.name); // 'Jane'
 * console.log(store.inspect.name.pending()); // true - has annotation tasks
 * console.log(store.inspect.name.is(Operation.Update)); // true - has Update operation
 * ```
 */
export class State<M extends Objectish> {
  /**
   * The current model state.
   * @private
   */
  #model: M;

  /**
   * The annotation tree tracking all operation tasks.
   * @private
   */
  #annotations: Annotated<M>;

  /**
   * Identity function for tracking values through operations.
   * @private
   */
  #identity: Identity<M>;

  /**
   * Set of listener functions to call when state changes.
   * @private
   */
  #listeners: Set<Listener<this>> = new Set();

  /**
   * Creates a new State instance.
   *
   * @param model - The initial model state
   * @param identity - Optional function to extract unique identifiers from values (e.g., `(value) => value.id`).
   *                   If it returns undefined or is not provided, F.equals is used for structural comparison.
   *
   * @example
   * ```typescript
   * // Uses F.equals for all comparisons
   * const state = new State({ friends: ['Alice', 'Bob'] });
   *
   * // Uses id field for tracking objects
   * const state = new State(
   *   { users: [{ id: 1, name: 'Alice' }] },
   *   (value) => value.id
   * );
   * ```
   */
  constructor(model: M, identity: Identity<M> = defaultIdentity as Identity<M>) {
    this.#model = model;
    this.#annotations = annotate(model);
    this.#identity = identity;
  }
  /**
   * Gets the current model state.
   *
   * @returns The current model
   *
   * @example
   * ```typescript
   * const store = new State({ name: 'John', age: 30 });
   * console.log(store.model.name); // 'John'
   * ```
   */
  get model(): M {
    return this.#model;
  }

  /**
   * Gets an inspection proxy for querying operation state on the model.
   *
   * The inspect proxy provides helper methods for checking operation state
   * on any property path in the model structure. Use `pending()` to check if a property has
   * pending operations, `remaining()` to get the count of pending operations, `is(Operation)`
   * to check for specific operation types, and `draft()` to get the value from the most recent
   * annotation record.
   *
   * @returns An inspection proxy providing `pending()`, `remaining()`, `is()`, and `draft()` methods on all properties
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * console.log(store.model.name); // 'Jane'
   * console.log(store.inspect.name.pending()); // true - has annotation tasks
   * console.log(store.inspect.name.remaining()); // 1 - number of annotation tasks
   * console.log(store.inspect.name.is(Operation.Update)); // true - has Update operation
   * console.log(store.inspect.name.draft()); // 'Jane' - value from latest record
   * ```
   */
  get inspect(): Decorate<M> {
    return decorate(this.#annotations, this.#model);
  }

  /**
   * Applies mutations to the model using Immer-style draft updates.
   *
   * Changes to the draft are tracked as patches and applied to both the model and its annotations.
   * You can mark changes with Operation helpers (Add, Update, Remove, etc.) to track pending operations.
   * The model and inspection proxy can be accessed via the `model` and `inspect` getters.
   *
   * @param recipe - A function that mutates a draft of the model
   *
   * @example
   * ```typescript
   * // Simple mutation
   * store.mutate((draft) => {
   *   draft.name = 'Jane';
   * });
   *
   * // With operation tracking
   * const process = Symbol('update');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * console.log(store.model.name); // 'Jane'
   * console.log(store.inspect.name.pending()); // true - has annotation tasks
   * console.log(store.inspect.name.is(Operation.Update)); // true - has Update operation
   * console.log(store.inspect.name.draft()); // 'Jane' - value from latest record
   * ```
   */
  mutate(recipe: Recipe<M>): void {
    const [model, annotations] = apply<M>(this.#model, this.#annotations, recipe, this.#identity);
    this.#model = model;
    this.#annotations = annotations;
    this.#notify();
  }

  /**
   * Removes all annotation tasks that match the given process identifier.
   *
   * This is useful for cleaning up annotations after async operations complete successfully.
   * For example, after an API request finishes, you can prune all operations associated with
   * that request's process symbol.
   *
   * The model and inspection proxy can be accessed via the `model` and `inspect` getters.
   *
   * @param process - The process identifier to remove from all annotations
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * store.prune(process);
   * console.log(store.inspect.name.pending()); // false - annotation was removed
   * console.log(store.model.name); // 'Jane' - model unchanged
   * ```
   */
  prune(process: Process): void {
    this.#annotations = cleanup(this.#annotations, process);
    this.#notify();
  }

  /**
   * Registers a listener function to be called whenever the model or annotations change.
   *
   * The listener receives the State instance (this) as its argument, allowing access to
   * the updated model and inspection proxy. This is useful for integrating with reactive
   * frameworks like React.
   *
   * @param listener - Function to call when state changes, receives the State instance
   * @returns A function to unsubscribe the listener
   *
   * @example
   * ```typescript
   * const store = new State({ count: 0 });
   *
   * const unsubscribe = store.listen((state) => {
   *   console.log('Count changed:', state.model.count);
   * });
   *
   * store.mutate((draft) => {
   *   draft.count = 1;
   * }); // Logs: "Count changed: 1"
   *
   * unsubscribe(); // Remove listener
   * ```
   *
   * @example
   * ```typescript
   * // React integration
   * const [, forceUpdate] = useReducer((x) => x + 1, 0);
   *
   * useEffect(() => {
   *   const unsubscribe = store.listen(() => forceUpdate());
   *   return unsubscribe;
   * }, []);
   * ```
   */
  listen(listener: Listener<this>): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Notifies all registered listeners of a state change.
   * @private
   */
  #notify(): void {
    this.#listeners.forEach((listener) => listener(this));
  }
}

export { Operation, Event } from './types';
export type { Decorate } from './types';
