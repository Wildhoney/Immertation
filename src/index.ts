import * as immer from "immer"
import type { Recipe } from "./types";
import { encapsulate, Node, augment, reconcile, distill } from "./utils";

immer.setAutoFreeze(false);

export default class Immeration<M> {
    #model: Node;

    constructor(model: M) {
        this.#model = encapsulate(model);
    }

    produce(recipe: Recipe<M>): [M, M] {
        const patches = augment(recipe);
        const model = reconcile(immer.applyPatches(this.#model, patches));
        return [distill(model), {} as M]
    }
}