import { NodeP, NodeO, NodeA, type Tree, Node, Revision } from './types';
import { G, A, D } from '@mobily/ts-belt';

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
 * //   current: {
 * //     name: Node { current: "John" },
 * //     age: Node { current: 30 },
 * //     tags: Node { current: [Node { current: "admin" }, Node { current: "user" }] }
 * //   }
 * // }
 * ```
 */
export function encapsulate<M>(model: M): Tree<M> {
  if (G.isNullable(model)) return new NodeP(model) as Tree<M>;
  if (G.isArray(model)) return new NodeA(A.map(model, (value) => encapsulate(value))) as Tree<M>;
  if (G.isObject(model)) return new NodeO(D.map(model, (value) => encapsulate(value))) as Tree<M>;
  return new NodeP(model) as Tree<M>;
}

/**
 * Recursively unwraps Node instances to extract plain values.
 *
 * @template M - The type of the model to unwrap
 * @param node - The node to unwrap
 * @param revision - The revision to retrieve
 * @returns The plain unwrapped value
 */
export function unwrap<M>(node: Tree<M>, revision: Revision): M {
  if (!(node instanceof Node)) {
    return node as M;
  }

  const value = node.get(revision);

  if (G.isNullable(value)) return value as M;
  if (G.isArray(value)) return A.map(value, (v) => unwrap(v as any, revision)) as M;
  if (G.isObject(value)) return D.map(value, (v) => unwrap(v as any, revision)) as M;
  return value as M;
}
