import {
  type Recipe,
  type Process,
  type Observer,
  type Identity,
  type Inspectable,
  type Registry,
  type Objectish,
  type ExtractObjectish,
} from './types';
import * as utils from './utils';

export class State<M extends Objectish> {
  #model: M;
  #registry: Registry = new Map();
  #observers: Set<Observer<this>> = new Set();
  #identity: Identity<ExtractObjectish<M>>;

  constructor(model: M, identity: Identity<ExtractObjectish<M>>) {
    this.#model = model;
    this.#identity = identity;
  }

  get model(): M {
    return utils.present(this.#model, this.#registry, this.#identity);
  }

  get inspect(): Inspectable<M> {
    return utils.inspect(this.#model, this.#registry, this.#identity) as Inspectable<M>;
  }

  mutate(recipe: Recipe<M>): Process {
    const process = Symbol('process');
    const result = utils.reconcile(this.#model, this.#registry, process, recipe, this.#identity);
    this.#model = result;
    this.#notify();
    return process;
  }

  prune(process: Process): void {
    const [model, registry] = utils.prune(this.#model, this.#registry, process);
    this.#model = model;
    this.#registry = registry;
    this.#notify();
  }

  observe(observer: Observer<this>): () => void {
    this.#observers.add(observer);
    return () => this.#observers.delete(observer);
  }

  #notify(): void {
    this.#observers.forEach((observer) => observer(this));
  }
}

export { Draft, Op } from './types';
export type { Box, Config } from './types';
