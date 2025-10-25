import * as immer from 'immer';
import type { Recipe, WithAnnotations } from './types';
import { Node } from './types';
import { encapsulate, augment, reconcile, distill, annotations } from './utils';
import clone from 'lodash/cloneDeep';

immer.setAutoFreeze(false);

export default class Immeration<M> {
  #model: Node;

  constructor(model: M) {
    this.#model = encapsulate(model);
  }

  produce(recipe: Recipe<M>): [M, WithAnnotations<M>] {
    const patches = augment(distill<M>(clone(this.#model)), recipe);
    this.#model = reconcile(immer.applyPatches(this.#model, patches));
    return [clone(distill<M>(this.#model)), annotations<M>(this.#model)];
  }
}

export type { WithAnnotations } from './types';
export { Operation } from './types';
