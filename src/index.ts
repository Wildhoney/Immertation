import type { Objectish } from 'immer';
import type { Recipe, Extended, Annotated } from './types';
import { apply, annotate } from './utils';
// import clone from 'lodash/cloneDeep';

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
  #model: M;
  #annotations: Annotated<M>;

  /**
   * Creates a new Immeration instance.
   *
   * @param model - The initial model state
   */
  constructor(model: M) {
    this.#model = model;
    this.#annotations = annotate(model);
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
    const [draft, annotations] = apply<M>(this.#model, this.#annotations, recipe);
    this.#model = draft;
    this.#annotations = annotations;
    return draft as unknown as Extended<M>;
  }

  get annotation() {
    return this.#annotations;
  }
}

export { Operation, Revision } from './types';
