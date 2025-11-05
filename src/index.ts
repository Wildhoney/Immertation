import type { Objectish } from 'immer';
import type { Tree, Recipe, Process } from './types';
import { encapsulate } from './utils';
import clone from 'lodash/cloneDeep';

/**
 * Store type that includes model properties as Nodes.
 */
export type StoreWithModel<M extends Objectish> = {
  [K in keyof M]: Tree<M[K]>;
} & {
  read(): M;
  mutate(recipe: Recipe<M>): void;
  prune(process: Process): M;
};

/**
 * Store class for managing immutable state with operation tracking.
 *
 * @template M - The model type to manage
 */
export const Store: {
  new <M extends Objectish>(model: M): StoreWithModel<M>;
} = class Store<M extends Objectish> {
  #model: Tree<M>;

  /**
   * Creates a new Store instance.
   *
   * @param model - The initial model state
   */
  constructor(model: M) {
    this.#model = encapsulate(clone(model));

    // Create getters for each property of the model
    const wrappedModel = this.#model.get(0 as any) as never;
    if (wrappedModel && typeof wrappedModel === 'object') {
      Object.keys(wrappedModel).forEach((key) => {
        Object.defineProperty(this, key, {
          get() {
            return wrappedModel[key];
          },
          enumerable: true,
          configurable: true,
        });
      });
    }
  }

  /**
   * Returns the current state of the model.
   *
   * @returns The current model state
   */
  read(): any {
    // TODO: Implement read method
    return this.#model;
  }

  /**
   * Applies mutations to the model.
   *
   * @param recipe - A function that mutates a draft of the model
   *
   * @example
   * ```typescript
   * const process = Symbol('update');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Jane', process);
   * });
   * ```
   */
  mutate(_recipe: Recipe<M>): void {
    // TODO: Implement mutate method
    // const patches = augment<M>(this.#model, recipe);
    // this.#model = Config.immer.applyPatches(this.#model, patches);
  }

  /**
   * Removes all operation records associated with a specific process.
   *
   * @param process - The process identifier to remove
   * @returns The model state with the process records removed
   *
   * @example
   * ```typescript
   * const process1 = Symbol('process1');
   * store.mutate((draft) => {
   *   draft.name = Operation.Update('Alice', process1);
   * });
   *
   * store.prune(process1);
   * ```
   */
  prune(_process: Process): M {
    // TODO: Implement prune method
    // this.#model = prune(this.#model, process);
    return this.#model as never;
  }
} as never;

export { Revision } from './types';
