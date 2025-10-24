// import type { Operation, Process } from "./types";

import type { Process } from "./types";
import type { Recipe } from "./types";
import type { Patch } from "immer";
import { immerable, createDraft, finishDraft, Immer, enablePatches } from "immer";
import { A, D, G } from '@mobily/ts-belt';

enablePatches();

const immer = new Immer();
immer.setAutoFreeze(false);

// export class Draft<T> {
//   constructor(public value: T) {}
//

enum State {
  Add = 1,
  Remove = 2,
  Update = 4,
  Move = 8,
  Replace = 16,
  Sort = 32,
}

type Record<T> = {
  value: T;
  operations: Operation[];
  process: Process;
}

export class Node<T = any> {
  [immerable] = true;

  constructor(public value: T, public annotation: Annotation<T> | null = null) {}
}

export class Annotation<T> {
  public records: Record<T>[];


  constructor(public value: T, public operations: Operation[], process: Process) {
    this.records = [{ value, operations, process }];
  }
}

export class Operation {
  static Update<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Update], process) as unknown as T;
  }

  static Replace<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Update, State.Replace], process) as unknown as T;
  }
}

export function encapsulate<M>(model: M): Node {
  if (G.isNullable(model)) {
    return new Node(model);
  }

  if (G.isArray(model)) {
    return new Node(A.map(model, item => encapsulate(item)));
  }

  if (G.isObject(model)) {
    return new Node(D.map(model, (value) => encapsulate(value))) ;
  }

  return new Node(model);
}

export function augment<M>(recipe: Recipe<M>): Patch[] {
  const [, patches] = immer.produceWithPatches({}, recipe);

  const modifiedPatches = A.map(patches, (patch) => {
    const pathWithValue = A.reduce(
      patch.path,
      ['value'] as (string | number)[],
      (acc, segment) => [...acc, segment, 'value']
    );

    return {
      ...patch,
      path: pathWithValue
    };
  });

  return modifiedPatches;
}

export function reconcile(node: Node): Node {
  if (!(node instanceof Node)) {
    return node;
  }

  const value = node.value;

  // Check if value is an Annotation - if so, merge it into the node
  if (value instanceof Annotation) {
    const existingAnnotation = node.annotation;
    let mergedOps = value.operations;

    if (existingAnnotation instanceof Annotation) {
      // Merge operations using bitwise OR
      const mergedOpsValue = existingAnnotation.operations[0] | value.operations[0];
      mergedOps = [mergedOpsValue];
    }

    return new Node(
      value.value,
      new Annotation(value.value, mergedOps, Symbol())
    );
  }

  // Recursively reconcile nested structures
  if (G.isArray(value)) {
    const reconciledArray = A.map(value, item => reconcile(item));
    return new Node(reconciledArray, node.annotation);
  }

  if (G.isObject(value)) {
    const reconciledObj = D.map(value, (val) => reconcile(val));
    return new Node(reconciledObj, node.annotation);
  }

  // Primitive value - return as is
  return node;
}

export function distill<M>(node: Node): M {
  if (!(node instanceof Node)) {
    return node;
  }

  const value = node.value;

  if (G.isNullable(value)) {
    return value;
  }

  if (G.isArray(value)) {
    return A.map(value, item => distill(item)) as M;
  }

  if (G.isObject(value)) {
    return D.map(value, (val) => distill(val)) as M;
  }

  return value;
}
