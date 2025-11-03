import type { Objectish } from 'immer';
import type { Recipe, Tree, Extended, Process } from './types';
import { encapsulate, augment, extend, prune } from './utils';
import { Config } from './types';

/**
 * Main class for managing immutable state with operation tracking.
 *
 * @template M - The model type to manage
 *
 * @example
 * ```typescript
 * type Model = { name: string; age: number };
 * const store = new Immeration<Model>({ name: 'John', age: 30 });
 *
 * const model = store.mutate((draft) => {
 *   draft.name = 'Jane';
 * });
 *
 * console.log(model.name.get()); // 'Jane'
 * ```
 */
export class Immeration<M extends Objectish> {
  #model: Tree<M>;

  /**
   * Creates a new Immeration instance.
   *
   * @param model - The initial model state
   */
  constructor(model: M) {
    this.#model = encapsulate(model);
  }

  /**
   * Applies mutations to the model and returns an extended proxy.
   *
   * @param recipe - A function that mutates a draft of the model
   * @returns An extended model with get and is methods on all properties
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * const model = store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   *
   * console.log(model.name.get(Revision.Current)); // 'John'
   * console.log(model.name.get(Revision.Draft));   // 'Jane'
   * console.log(model.name.is(Operation.Update));  // true
   * ```
   */
  mutate(recipe: Recipe<M>): Extended<M> {
    const patches = augment<M>(this.#model, recipe);
    this.#model = Config.immer.applyPatches(this.#model, patches);
    return extend(this.#model) as unknown as Extended<M>;
  }

  /**
   * Removes all operation records associated with a specific process.
   *
   * @param process - The process identifier to remove
   * @returns An extended model with the process records removed
   *
   * @example
   * ```typescript
   * const process1 = Symbol('process1');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Alice', process1);
   * });
   *
   * const model = store.prune(process1);
   * console.log(model.name.is(Operation.Update)); // false
   * ```
   */
  prune(process: Process): Extended<M> {
    this.#model = prune(this.#model, process);
    return extend(this.#model) as unknown as Extended<M>;
  }
}

export { Operation, Revision } from './types';
