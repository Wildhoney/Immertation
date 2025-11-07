import type { Objectish } from 'immer';
import type { Recipe, Annotated, Target, Process } from './types';
import { apply, annotate, helpers, prune as cleanup } from './utils';

/**
 * Main class for managing immutable state with operation tracking.
 *
 * State provides a way to track mutations to immutable state through operation annotations.
 * Each mutation can be marked with an operation type (Add, Update, Remove, etc.) and a process
 * identifier, allowing you to query what operations are pending and prune them when complete.
 *
 * @template M - The model type to manage
 *
 * @example
 * ```typescript
 * type Model = { name: string; age: number };
 * const store = new State<Model>({ name: 'John', age: 30 });
 *
 * const process = Symbol('update');
 * const [model, annotations] = store.mutate((draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 *
 * console.log(model.name); // 'Jane'
 * console.log(annotations.name.pending()); // true
 * console.log(annotations.name.is(Operation.Update)); // true
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
   * Creates a new State instance.
   *
   * @param model - The initial model state
   */
  constructor(model: M) {
    this.#model = model;
    this.#annotations = annotate(model);
  }

  /**
   * Applies mutations to the model and returns a tuple of the updated model and annotations.
   *
   * The annotations object is a proxy that provides helper methods for checking operation state
   * on any property path in the model structure. Use `pending()` to check if a property has
   * pending operations, `is(Operation)` to check for specific operation types, and `draft()` to
   * get the value from the most recent annotation record.
   *
   * @param recipe - A function that mutates a draft of the model
   * @returns A tuple containing:
   *   - The updated model with all changes applied
   *   - An annotations proxy providing `pending()`, `is()`, and `draft()` methods on all properties
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * const [model, annotations] = store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * console.log(model.name); // 'Jane'
   * console.log(annotations.name.pending()); // true - has annotation tasks
   * console.log(annotations.name.is(Operation.Update)); // true - has Update operation
   * console.log(annotations.name.draft()); // 'Jane' - value from latest record
   * ```
   */
  mutate(recipe: Recipe<M>): [M, Target<M>] {
    const [model, annotations] = apply<M>(this.#model, this.#annotations, recipe);
    this.#model = model;
    this.#annotations = annotations;
    return [model, helpers(annotations, model)];
  }

  /**
   * Removes all annotation tasks that match the given process identifier.
   *
   * This is useful for cleaning up annotations after async operations complete successfully.
   * For example, after an API request finishes, you can prune all operations associated with
   * that request's process symbol.
   *
   * @param process - The process identifier to remove from all annotations
   * @returns A tuple containing:
   *   - The unchanged model (pruning only affects annotations, not the model itself)
   *   - An annotations proxy with all matching process tasks removed
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * const [model, annotations] = store.prune(process);
   * console.log(annotations.name.pending()); // false - annotation was removed
   * console.log(model.name); // 'Jane' - model unchanged
   * ```
   */
  prune(process: Process): [M, Target<M>] {
    this.#annotations = cleanup(this.#annotations, process);
    return [this.#model, helpers(this.#annotations, this.#model)];
  }
}

export { Operation } from './types';
