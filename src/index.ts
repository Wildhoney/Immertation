import { nanoid } from 'nanoid';
import type { Identity, Model, Op, Process, Recipe, Registry } from './types';
import { Annotation, Config, reconcile } from './utils';
import clone from 'lodash/cloneDeep';

export class State<M extends Model> {
  #model: M;
  #identity: Identity<M>;
  #registry: Registry<M> = new Map();

  constructor(model: M, identity: Identity<M>) {
    this.#model = model;
    this.#identity = identity;
  }

  static pk(): string {
    return nanoid();
  }

  static annotate<T>(value: T, operations: Op): T {
    return new Annotation<T>(value, operations) as T;
  }

  mutate(recipe: Recipe<M>): Process {
    const process = Symbol('process');
    const [, patches] = Config.immer.produceWithPatches(clone(this.#model), recipe);

    this.#model = Config.immer.applyPatches(
      this.#model,
      patches.map((patch, index) => {
        const snapshot = Config.immer.applyPatches(clone(this.#model), patches.slice(0, index));
        return { ...patch, value: reconcile(patch, snapshot, process, this.#registry) };
      }),
    );

    return process;
  }

  get model(): M {
    return this.#model;
  }

  get registry(): Registry<M> {
    return this.#registry;
  }
}

export { Op } from './types';
