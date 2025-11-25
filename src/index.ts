import { nanoid } from 'nanoid';
import {
  Annotation,
  type Identity,
  type Inspect,
  type Model,
  type Operation,
  type Process,
  type Recipe,
  type Reconciliation,
  type Registry,
} from './types';
import { Config, inspect, reconcile } from './utils';
import clone from 'lodash/cloneDeep';
import { A } from '@mobily/ts-belt';

/**
 * State management class that tracks model mutations with annotations.
 * @template M - The model type extending Model
 */
export class State<M extends Model> {
  /** The current model state */
  #model: M;
  /** Function to generate unique IDs from snapshots */
  #identity: Identity<M>;
  /** Map of IDs to their annotations */
  #registry: Registry<M> = new Map();

  /**
   * Creates a new State instance.
   * @param {M} model - The initial model state
   * @param {Identity<M>} identity - Function to generate unique IDs for snapshots
   */
  constructor(model: M, identity: Identity<M>) {
    this.#model = model;
    this.#identity = identity;
  }

  /**
   * Returns the current model state.
   * @returns {M} The current model
   */
  get model(): M {
    return this.#model;
  }

  /**
   * Returns a proxy for inspecting pending operations at any path.
   * @returns {Inspect<M>} Proxy with pending() and is() methods
   */
  get inspect(): Inspect<M> {
    return inspect(this.#model, this.#registry, this.#identity);
  }

  /**
   * Generates a unique primary key using nanoid.
   * @returns {string} A unique identifier
   */
  static pk(): string {
    return nanoid();
  }

  /** Shorthand alias for {@link State.pk} using the Greek kappa symbol. */
  static κ = State.pk;

  /**
   * Wraps a value with an annotation for tracking operations.
   * @template T - The value type
   * @param {Operation} operation - The operation type (Add, Remove, Update, etc.)
   * @param {T} value - The value to annotate
   * @returns {T} The annotated value (typed as T for assignment compatibility)
   */
  static annotate<T>(operation: Operation, value: T): T {
    return new Annotation<T>(value, operation) as T;
  }

  /** Shorthand alias for {@link State.annotate} using the Greek delta symbol. */
  static δ = State.annotate;

  /**
   * Applies mutations to the model using an Immer recipe.
   * @param {Recipe<M>} recipe - Function that mutates the draft
   * @returns {Process} A unique process symbol for tracking this mutation batch
   */
  mutate(recipe: Recipe<M>): Process {
    const process = Symbol('process');
    const [, patches] = Config.immer.produceWithPatches(clone(this.#model), recipe);

    this.#model = Config.immer.applyPatches(
      this.#model,
      patches.reduce<Reconciliation<M>>(
        (context, patch) => {
          const value = reconcile(patch, context.snapshot, process, this.#registry, this.#identity);
          return {
            snapshot: Config.immer.applyPatches(context.snapshot, [{ ...patch, value }]),
            patches: [...context.patches, { ...patch, value }],
          };
        },
        { snapshot: clone(this.#model), patches: [] },
      ).patches,
    );

    return process;
  }

  /**
   * Removes all annotations associated with a specific process.
   * @param {Process} process - The process symbol to prune
   */
  prune(process: Process): void {
    this.#registry.forEach((annotations, id) => {
      const remaining = annotations.filter((a) => a.process !== process);
      if (A.isEmpty(remaining)) this.#registry.delete(id);
      else this.#registry.set(id, remaining);
    });
  }
}

export { Operation, Operation as Op, type Id, type Identity, type Snapshot } from './types';
