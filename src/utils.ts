import type { Recipe, WithAnnotations } from './types';
import { Node, Annotation, Operation, State } from './types';
import type { Patch } from 'immer';
import { Immer, enablePatches } from 'immer';
import { A, D, G } from '@mobily/ts-belt';

const immer = new Immer();
enablePatches();
immer.setAutoFreeze(false);

/**
 * Recursively wraps a model in Node instances to enable tracking of changes and annotations.
 *
 * This function transforms a plain JavaScript object/array/primitive into a nested structure
 * where each value is wrapped in a Node. This allows the Immertation system to track
 * modifications and attach operation annotations to any part of the data structure.
 *
 * @template M - The type of the model to encapsulate
 * @param model - The model to wrap in Node instances
 * @returns A Node containing the encapsulated model structure
 *
 * @example
 * ```typescript
 * const model = { name: "John", age: 30, tags: ["admin", "user"] };
 * const encapsulated = encapsulate(model);
 * // Returns: Node {
 * //   value: {
 * //     name: Node { value: "John" },
 * //     age: Node { value: 30 },
 * //     tags: Node { value: [Node { value: "admin" }, Node { value: "user" }] }
 * //   }
 * // }
 * ```
 */
export function encapsulate<M>(model: M): Node {
  if (G.isNullable(model)) return new Node(model);
  if (model instanceof Annotation) return new Node(model);
  if (G.isArray(model)) return new Node(A.map(model, (item) => encapsulate(item)));
  if (G.isObject(model)) return new Node(D.map(model, (value) => encapsulate(value)));
  return new Node(model);
}

/**
 * Transforms Immer patches to work with the Node-based structure by augmenting paths.
 *
 * This function applies a recipe to produce Immer patches, then modifies each patch path
 * to account for the nested Node structure. Since each value in the encapsulated model
 * is wrapped in a Node with a `value` property, the patch paths need to be augmented
 * to include 'value' at each level of nesting.
 *
 * @template M - The type of the model
 * @param model - The distilled model to apply the recipe to
 * @param recipe - The function that describes the changes to make
 * @returns An array of augmented patches that can be applied to the Node structure
 *
 * @example
 * ```typescript
 * const model = { name: "John", age: 30 };
 * const patches = augment(model, (draft) => {
 *   draft.name = "Jane";
 * });
 * // Returns patches with paths like ['value', 'name', 'value']
 * // instead of just ['name']
 * ```
 */
export function augment<M>(model: M, recipe: Recipe<M>): Patch[] {
  const [, patches] = immer.produceWithPatches(model, recipe);
  const augmented = A.map(patches, (patch) => {
    const path = A.reduce(patch.path, ['current'] as (string | number)[], (path, segment) => [
      ...path,
      segment,
      'current',
    ]);

    return { ...patch, path, value: encapsulate(patch.value) } as Patch;
  });

  return augmented as Patch[];
}

/**
 * Reconciles a Node structure by processing annotations and recursively traversing nested values.
 *
 * When a Node's value is an Annotation, this function merges it with any existing annotation
 * on the Node by combining their records arrays. This preserves the history of all operations
 * applied to a value across multiple produce() calls, enabling granular cleanup by process symbol.
 *
 * For nested structures (arrays and objects), the function recursively reconciles each element
 * while preserving the parent node's annotation.
 *
 * @param node - The Node to reconcile
 * @returns A new Node with merged annotations and reconciled nested structures
 *
 * @example
 * ```typescript
 * // After applying Operation.Update, the value becomes an Annotation
 * const node = new Node(new Annotation("Jane", [State.Update], process1));
 *
 * // If the node already has an annotation from a previous operation
 * node.annotation = new Annotation("John", [State.Update], process0);
 *
 * // reconcile() merges both annotation records
 * const reconciled = reconcile(node);
 * // reconciled.annotation.records contains both process0 and process1 records
 * ```
 */
export function reconcile(node: Node): Node {
  if (!(node instanceof Node)) {
    return node;
  }

  if (node.current instanceof Node) {
    const reconciled = reconcile(node.current);
    if (node.annotation && reconciled.annotation) {
      const merged = new Annotation(
        node.annotation.value,
        node.annotation.operations,
        node.annotation.records[0].process
      );
      merged.merge(reconciled.annotation);
      return new Node(reconciled.current, merged);
    }
    return new Node(reconciled.current, reconciled.annotation || node.annotation);
  }

  if (node.current instanceof Annotation) {
    const value = node.current.value;
    const encapsulatedValue = (G.isObject(value) && !(value instanceof Annotation)) || G.isArray(value)
      ? encapsulate(value).current
      : value;

    if (node.annotation instanceof Annotation) {
      const annotations = new Annotation(
        node.annotation.value,
        node.annotation.operations,
        node.annotation.records[0].process
      );
      annotations.merge(node.current);
      return new Node(encapsulatedValue, annotations);
    }

    return new Node(encapsulatedValue, node.current);
  }

  if (G.isArray(node.current)) {
    return new Node(
      A.map(node.current, (value) => reconcile(value as Node)),
      node.annotation
    );
  }

  if (G.isObject(node.current) && !(node.current instanceof Annotation)) {
    return new Node(
      D.map(node.current, (value) => reconcile(value as Node)),
      node.annotation
    );
  }

  return node;
}

/**
 * Extracts the raw data model from a Node structure by unwrapping all Node wrappers.
 *
 * This is the inverse operation of encapsulate(). It recursively traverses the Node structure
 * and extracts the underlying values, discarding all Node wrappers and annotations. The result
 * is a plain JavaScript object/array/primitive that matches the original model structure.
 *
 * @template M - The type of the model to extract
 * @param node - The Node structure to distill
 * @returns The raw data model without Node wrappers or annotations
 *
 * @example
 * ```typescript
 * const node = new Node({
 *   name: new Node("John"),
 *   age: new Node(30)
 * });
 *
 * const model = distill(node);
 * // Returns: { name: "John", age: 30 }
 * ```
 */
export function distill<M>(node: Node | Annotation<M>): M {
  if (node instanceof Annotation) {
    return node.value;
  }

  if (!(node instanceof Node)) {
    return node as M;
  }

  if (node.current instanceof Annotation) {
    return node.current.value as M;
  }

  if (G.isNullable(node.current)) return node.current as M;
  if (G.isArray(node.current)) return A.map(node.current, (item) => distill(item as Node)) as M;
  if (G.isObject(node.current) && !(node.current instanceof Annotation)) {
    return D.map(node.current, (val) => distill(val as Node)) as M;
  }
  return node.current as M;
}

export function annotations<M>(node: Node): WithAnnotations<M> {
  const make = <T>(
    annotation: Annotation<T> | null,
    children?: Record<string, unknown> | unknown[]
  ) => {
    const target = G.isArray(children) ? [] : {};

    return new Proxy(target, {
      get(_target, property) {
        if (property === 'is') {
          return (
            operation:
              | typeof Operation.Add
              | typeof Operation.Remove
              | typeof Operation.Update
              | typeof Operation.Move
              | typeof Operation.Replace
              | typeof Operation.Sort
          ) => {
            if (!annotation) return false;

            let operationState: State | null = null;
            if (operation === Operation.Add) {
              operationState = State.Add;
            } else if (operation === Operation.Remove) {
              operationState = State.Remove;
            } else if (operation === Operation.Update) {
              operationState = State.Update;
            } else if (operation === Operation.Move) {
              operationState = State.Move;
            } else if (operation === Operation.Replace) {
              operationState = State.Replace;
            } else if (operation === Operation.Sort) {
              operationState = State.Sort;
            }

            if (operationState === null) return false;

            return A.some(annotation.records, (record) =>
              A.some(record.operations, (state) => state === operationState)
            );
          };
        }

        if (property === 'draft') {
          return () => {
            if (!annotation) return undefined;
            // Return the most recent value from the records array
            const lastRecord = A.last(annotation.records);
            return lastRecord ? lastRecord.value : undefined;
          };
        }

        if (children) {
          if (G.isArray(children) && typeof property === 'string') {
            const index = parseInt(property, 10);
            if (!isNaN(index) && index >= 0 && index < children.length) {
              return children[index];
            }
          } else if (G.isObject(children) && typeof property === 'string') {
            return children[property];
          }
        }

        return undefined;
      },
    });
  };

  const traverse = (value: unknown): unknown => {
    if (!(value instanceof Node)) return make(null);
    if (value.annotation) return make(value.annotation);

    if (G.isArray(value.current)) {
      const children = A.map(value.current, (item) => traverse(item)) as unknown[];
      return make(null, children);
    }

    if (G.isObject(value.current)) {
      const children = D.map(value.current, (item) => traverse(item));
      return make(null, children);
    }

    return make(null);
  };

  return traverse(node) as WithAnnotations<M>;
}
