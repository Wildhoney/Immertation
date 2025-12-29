import { nanoid } from 'nanoid';
import {
  Annotation,
  type Identity,
  type Inspect,
  type Model,
  Mode,
  type Operation,
  type Process,
  type Recipe,
  type Registry,
  type Subscriber,
} from './types';
import * as utils from './utils';
import { A } from '@mobily/ts-belt';

/**
 * State management class that tracks model mutations with annotations.
 * @template M - The model type extending Model
 */
export class State<M extends Model> {
  /** The current model state */
  #model: M = <M>{};
  /** Function to generate unique IDs from snapshots */
  #identity: Identity<M>;
  /** Map of IDs to their annotations */
  #registry: Registry<M> = new Map();
  /** Subscribers waiting for registry changes */
  #subscribers: Set<Subscriber> = new Set();
  /** Whether hydrate() has been called */
  #hydrated = false;

  /**
   * Creates a new State instance.
   * @param {Identity<M>} [identity] - Optional function to generate unique IDs for snapshots
   */
  constructor(identity: Identity<M> = utils.identity) {
    this.#identity = identity;
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
  annotate<T>(operation: Operation, value: T): T {
    return <T>new Annotation<T>(value, operation);
  }

  /** Shorthand alias for {@link annotate} using the Greek delta symbol. */
  δ = this.annotate;

  /**
   * Returns the current model state.
   * @returns {M} The current model
   */
  get model(): M {
    return this.#model;
  }

  /**
   * Returns a proxy for inspecting pending operations at any path.
   * @returns {Inspect<M>} Proxy with pending(), is(), draft(), and settled() methods
   */
  get inspect(): Inspect<M> {
    return utils.inspect(
      () => this.#model,
      this.#registry,
      this.#identity,
      (subscriber) => this.#subscribers.add(subscriber),
      (subscriber) => this.#subscribers.delete(subscriber),
    );
  }

  /**
   * Hydrates the state with a model, extracting annotations and registering them.
   * Unlike produce(), annotation values become the actual model values.
   * @param {M} model - The model to hydrate with (may contain annotations)
   * @returns {Process} A unique process symbol for tracking this mutation batch
   */
  hydrate(model: M): Process {
    this.#hydrated = true;
    return this.#apply(Mode.Hydrate, (draft) => Object.assign(draft, model));
  }

  /**
   * Applies mutations to the model using an Immer recipe.
   * @param {Recipe<M>} recipe - Function that mutates the draft
   * @returns {Process} A unique process symbol for tracking this mutation batch
   */
  produce(recipe: Recipe<M>): Process {
    if (!this.#hydrated) {
      throw new Error('State must be hydrated using hydrate() before calling produce()');
    }
    return this.#apply(Mode.Produce, recipe);
  }

  /**
   * Internal method that applies a recipe and reconciles annotations.
   * @param {Mode} mode - Mode.Produce preserves originals, Mode.Hydrate uses annotation values
   * @param {Recipe<M>} recipe - Function that mutates the draft
   * @returns {Process} A unique process symbol for tracking this mutation batch
   */
  #apply(mode: Mode, recipe: Recipe<M>): Process {
    const process = Symbol('process');

    const [, patches] = utils.Config.immer.produceWithPatches(this.#model, recipe);

    this.#model = patches.reduce(
      (model, patch) =>
        utils.Config.immer.applyPatches(model, [
          { ...patch, value: utils.reconcile(mode, patch, model, process, this.#registry, this.#identity) },
        ]),
      this.#model,
    );
    this.#model = utils.tag(this.#model);
    this.#notify();

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
    this.#notify();
  }

  /** Notifies all subscribers of state changes. */
  #notify(): void {
    this.#subscribers.forEach((subscriber) => subscriber());
  }

  /**
   * Subscribes to model changes.
   * @param {(model: M) => void} callback - Function called with the model on every change
   * @returns {() => void} Unsubscribe function
   */
  observe(callback: (model: M) => void): () => void {
    const subscriber = () => callback(this.#model);
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }
}

export { Operation, Operation as Op } from './types';
export type { Box, Id, Identity, Inspect, Snapshot, Process } from './types';
