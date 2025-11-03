import type { Recipe, Tree, Path, Process, Slice, Operations } from './types';
import { Node, Annotation, Operation, State, Revision, Config } from './types';
import type { Objectish, Patch } from 'immer';
import * as immer from 'immer';
import { A, D, G } from '@mobily/ts-belt';
import clone from 'lodash/cloneDeep';
import get from 'lodash/get';

/**
 * Creates a Proxy wrapper for an encapsulated model that provides `.get()` and `.is()` methods.
 *
 * This function takes an encapsulated model (wrapped in Nodes) and returns a Proxy that
 * allows users to access properties using standard dot notation. Each property provides:
 * - `.get()` method to retrieve values (supports Revision.Current and Revision.Draft)
 * - `.is()` method to check if a specific operation was applied to the value
 *
 * @template M - The type of the model to wrap
 * @param node - The encapsulated Node structure to wrap
 * @returns A proxied version where each property has `.get()` and `.is()` methods
 *
 * @example
 * ```typescript
 * const encapsulated = encapsulate({ name: "John", age: 30 });
 * const model = extend(encapsulated);
 *
 * // Access values using .get()
 * console.log(model.name.get());                   // "John" (current value)
 * console.log(model.name.get(Revision.Draft));     // Draft value if annotations exist
 *
 * // Check operations using .is()
 * console.log(model.name.is(Operation.Update));    // true if value was updated
 * console.log(model.name.is(Operation.Add));       // false
 * ```
 */
export function extend<M>(node: Tree<M>): M {
  return new Proxy(G.isArray(node[Config.separator]) ? [] : {}, {
    get(_, prop) {
      if (prop === 'get') {
        return (revision: Revision = Revision.Current) => {
          return distill(node, revision);
        };
      }
      if (prop === 'is') {
        return (operation: Operations) => validate(node.annotation, operation);
      }
      const value = Reflect.get(node[Config.separator] as object, prop);
      return value instanceof Node ? extend(value) : value;
    },
  }) as M;
}

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
  if (G.isNullable(model)) return new Node(model) as Tree<M>;
  if (model instanceof Annotation) return new Node(model) as Tree<M>;
  if (G.isArray(model)) return new Node(A.map(model, (value) => encapsulate(value))) as Tree<M>;
  if (G.isObject(model)) return new Node(D.map(model, (value) => encapsulate(value))) as Tree<M>;
  return new Node(model) as Tree<M>;
}

/**
 * Recursively unwraps a Tree structure back to a plain model.
 *
 * This function extracts values from the Node structure based on the specified revision,
 * removing all annotations and returning a plain JavaScript object/array/primitive.
 *
 * @template M - The type of the model
 * @param node - The encapsulated Node structure to unwrap
 * @param revision - The revision to extract (Current or Draft)
 * @returns A plain model with values from the specified revision
 *
 * @example
 * ```typescript
 * const encapsulated = encapsulate({ name: "John", age: 30 });
 * const plain = distill(encapsulated, Revision.Current);
 * // Returns: { name: "John", age: 30 }
 * ```
 */
export function distill<M>(node: Tree<M>, revision: Revision = Revision.Current): M {
  const current = node[Config.separator];
  const hasAnnotation = node.annotation.records.length > 0;

  if (G.isNullable(current)) {
    if (hasAnnotation && revision === Revision.Draft) return node.annotation.draft as M;
    return current as M;
  }

  if (current instanceof Annotation) {
    return revision === Revision.Draft ? (current.draft as M) : (undefined as M);
  }

  if (G.isArray(current)) {
    const items = A.map(current, (item) => {
      if (item instanceof Annotation) {
        const adding = A.some(item.operations, (operation) => operation === State.Add);
        const removing = A.some(item.operations, (operation) => operation === State.Remove);

        return revision === Revision.Draft
          ? removing
            ? Config.nil
            : item.draft
          : adding
            ? Config.nil
            : item.draft;
      }
      if (item instanceof Node) return distill(item as Tree<unknown>, revision);
      return item;
    });
    return A.filter(items, (item) => item !== Config.nil) as M;
  }

  if (G.isObject(current)) {
    const items = D.map(current, (item) => {
      if (item instanceof Annotation) {
        const adding = A.some(item.operations, (operation) => operation === State.Add);
        const removing = A.some(item.operations, (operation) => operation === State.Remove);

        return revision === Revision.Draft
          ? removing
            ? Config.nil
            : item.draft
          : adding
            ? Config.nil
            : item.draft;
      }
      if (item instanceof Node) return distill(item as Tree<unknown>, revision);
      return item;
    });
    return D.filter(items, (value) => value !== Config.nil) as M;
  }

  if (hasAnnotation && revision === Revision.Draft) return node.annotation.draft as M;
  return current as M;
}

/**
 * Removes records from all annotations in the model tree that match a specific process.
 *
 * This function recursively traverses a Node structure and filters out records from
 * annotations where the record's process matches the provided process symbol. This is
 * useful for cleaning up annotations from a specific operation or batch of changes.
 *
 * @template M - The type of the model
 * @param node - The encapsulated Node structure to prune
 * @param process - The process symbol to match and remove
 * @returns A new encapsulated structure with filtered annotations
 *
 * @example
 * ```typescript
 * const process1 = Symbol('process1');
 * const encapsulated = encapsulate({ name: "John", age: 30 });
 * // ... apply operations with process1 ...
 * const pruned = prune(encapsulated, process1);
 * // All records from process1 are removed
 * ```
 */
export function prune<M>(node: Tree<M>, process: Process): Tree<M> {
  const current = node[Config.separator];
  const annotation = clone(node.annotation);

  annotation.records = annotation.records.filter(
    (record) => record.process !== process
  ) as typeof annotation.records;

  if (G.isNullable(current)) {
    return new Node(current, annotation as Annotation<M, Objectish>) as Tree<M>;
  }

  if (G.isArray(current)) {
    return new Node(
      A.map(current, (item) => prune(item as Tree<Objectish>, process)) as typeof current,
      annotation as Annotation<typeof current, Objectish>
    ) as Tree<M>;
  }

  if (G.isObject(current)) {
    return new Node(
      D.map(current, (item) => prune(item as Tree<Objectish>, process)) as typeof current,
      annotation as Annotation<typeof current, Objectish>
    ) as Tree<M>;
  }

  return new Node(current, annotation as Annotation<typeof current, Objectish>) as Tree<M>;
}

/**
 * Converts an Immer draft to a plain value, or returns the value as-is if not a draft.
 *
 * @param value - The value to convert
 * @returns The plain value
 */
function plain<T>(value: T): T {
  try {
    return immer.current(value) as T;
  } catch {
    return value;
  }
}

/**
 * Transforms Immer patches to work with the Node-based structure by augmenting paths.
 *
 * This function applies a recipe to a plain model (distilled from the Tree), produces Immer patches,
 * then modifies each patch path to account for the nested Node structure. Since each value in the
 * encapsulated model is wrapped in a Node with a 'current' property (defined by separator), the patch
 * paths need to be augmented to include the separator at each level of nesting.
 *
 * For each patch containing an Annotation, it creates a slice (snapshot) of the model
 * at that point in the patch sequence, allowing the annotation to reference the state
 * before that patch was applied.
 *
 * @template M - The type of the model
 * @param model - The encapsulated model to apply the recipe to
 * @param recipe - The function that describes the changes to make (receives a plain model)
 * @returns An array of augmented patches that can be applied to the Node structure
 *
 * @example
 * ```typescript
 * const encapsulated = encapsulate({ name: "John", age: 30 });
 * const patches = augment(encapsulated, (draft) => {
 *   draft.name = "Jane"; // draft is a plain object, not wrapped in Nodes
 * });
 * // Returns patches with paths like ['current', 'name', 'current']
 * // instead of just ['name']
 * ```
 */
export function augment<M extends Objectish>(model: Tree<M>, recipe: Recipe<M>): Patch[] {
  const [, patches] = Config.immer.produceWithPatches(distill(model), recipe);

  const augmented = A.mapWithIndex(patches, (index, patch) => {
    const path = pathify(patch.path as (string | number)[]);
    const cloned = clone(model);

    const slice = <Tree<M> | undefined>(
      get(Config.immer.applyPatches(cloned, A.take(patches, index)), path)
    );

    return {
      ...patch,
      path,
      value:
        patch.value instanceof Annotation
          ? G.isNullable(slice)
            ? new Node(Config.nil, patch.value)
            : new Node(slice.current, Annotation.merge(slice.annotation, patch.value))
          : new Node(plain(patch.value)),
    } as Patch;
  });

  return augmented as Patch[];
}

/**
 * Validates whether an annotation contains a specific operation in its records.
 *
 * This function checks if any record in the annotation's records array contains
 * the specified operation state. It's used by the `.is()` method on proxied values
 * to determine if a particular operation was applied to a value.
 *
 * @param annotation - The annotation to check for the operation
 * @param operation - The operation type to search for (Operation.Add, Operation.Update, etc.)
 * @returns True if the annotation contains the operation, false otherwise
 *
 * @example
 * ```typescript
 * const annotation = Annotation.create(value, [State.Update], null, process);
 * validate(annotation, Operation.Update); // Returns true
 * validate(annotation, Operation.Add);    // Returns false
 * ```
 */
function validate(annotation: Annotation<unknown, Slice>, operation: Operations): boolean {
  if (A.isEmpty(annotation.records)) return false;

  const state =
    operation === Operation.Add
      ? State.Add
      : operation === Operation.Remove
        ? State.Remove
        : operation === Operation.Update
          ? State.Update
          : operation === Operation.Move
            ? State.Move
            : operation === Operation.Replace
              ? State.Replace
              : operation === Operation.Sort
                ? State.Sort
                : null;

  return G.isNull(state)
    ? false
    : A.some(annotation.records, (record) => A.some(record.operations, (s) => s === state));
}

/**
 * Augments a patch path by inserting separators between each segment.
 *
 * @param path - The original patch path from Immer
 * @returns An augmented path array with separators inserted
 */
function pathify(path: (string | number)[]): Path[] {
  return A.reduce(path, [Config.separator] as Path[], (path, segment) => [
    ...path,
    segment as Path,
    Config.separator as Path,
  ]).slice(0, -1);
}
