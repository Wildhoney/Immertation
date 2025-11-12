import type {
  Recipe,
  Tree,
  Path,
  Operations,
  Inspectable,
  Container,
  Process,
  Task,
  Identity,
  IdentityValueType,
  Box,
} from './types';
import { Node, Annotation, Config, Event, Operation } from './types';
import type { Objectish, Patch } from 'immer';
import * as immer from 'immer';
import { A, D, F, G } from '@mobily/ts-belt';
import clone from 'lodash/cloneDeep';
import get from 'lodash/get';

/**
 * Default identity function that returns undefined for all values.
 * This causes value comparison to fall back to structural equality using F.equals.
 */
const defaultIdentity: Identity = () => undefined;

/**
 * Recursively wraps a model in Node instances to create an annotation tree.
 * Each value in the model is wrapped in a Node containing the value and empty annotations.
 *
 * @template M - The model type to wrap
 * @param model - The model to wrap in Node instances
 * @returns An annotation tree with Node wrappers at every level
 *
 * @example
 * ```typescript
 * const model = { name: 'John', friends: ['Alice', 'Bob'] };
 * const annotationTree = tree(model);
 * ```
 */
export function tree<M>(model: M): Tree<M> {
  if (G.isNullable(model)) return new Node(model) as Tree<M>;
  if (G.isArray(model)) return new Node(A.map(model, (value) => tree(value))) as Tree<M>;
  if (G.isObject(model)) return new Node(D.map(model, (value) => tree(value))) as Tree<M>;
  return new Node(model) as Tree<M>;
}

/**
 * Maps an Operation function to its corresponding Event enum value.
 *
 * This function is used internally by the `is()` helper method to check if a specific
 * operation type exists in the annotation records. It converts operation factory functions
 * like `Operation.Add` into their corresponding `Event.Add` enum values for comparison.
 *
 * @param operation - The operation factory function to map
 * @returns The corresponding Event enum value, or undefined if the operation is not recognized
 *
 * @example
 * ```typescript
 * event(Operation.Add) // Returns Event.Add
 * event(Operation.Update) // Returns Event.Update
 * event(Operation.Sort) // Returns Event.Sort
 * ```
 */
export function event(operation: Operations): Event | undefined {
  return operation === Operation.Add
    ? Event.Add
    : operation === Operation.Remove
      ? Event.Remove
      : operation === Operation.Update
        ? Event.Update
        : operation === Operation.Move
          ? Event.Move
          : operation === Operation.Replace
            ? Event.Replace
            : operation === Operation.Sort
              ? Event.Sort
              : undefined;
}

/**
 * Creates a proxy over the model that provides annotation helper methods for any property.
 *
 * This function generates the inspection proxy returned by the `inspect` getter. The proxy
 * dynamically provides four methods on every property path in the model:
 * - `pending()`: Returns true if the property has annotation tasks
 * - `remaining()`: Returns the count of annotation tasks for the property
 * - `is(Operation)`: Checks if a specific operation type exists in the property's annotations
 * - `draft()`: Returns the value from the most recent annotation task
 *
 * The proxy handles primitives, objects, and arrays, recursively providing helper methods
 * at every level of nesting while maintaining the original model structure.
 *
 * @template M - The model type
 * @param node - The annotated node containing the annotation tree
 * @param model - Optional model value to use for proxy navigation (defaults to node[Config.separator])
 * @returns A proxy target with type-safe helper methods on all properties
 *
 * @example
 * ```typescript
 * state.mutate((draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 *
 * state.inspect.name.pending() // true - has annotation tasks
 * state.inspect.name.remaining() // 1 - number of annotation tasks
 * state.inspect.name.is(Operation.Update) // true - has Update operation
 * state.inspect.name.draft() // 'Jane' - value from latest task
 * ```
 */
export function inspect<M>(node: Tree<M>, model?: M): Inspectable<M> {
  const actual = G.isNotNullable(model) ? model : (node[Config.separator] as M);

  const handler: ProxyHandler<Container<M>> = {
    get(target: Container<M>, property: string | symbol): unknown {
      switch (property) {
        case 'pending':
          return (): boolean => A.isNotEmpty(node.annotation.tasks as readonly Task<unknown>[]);

        case 'remaining':
          return (): number => (node.annotation.tasks as readonly Task<unknown>[]).length;

        case 'is':
          return (operation: Operations): boolean => {
            if (A.isEmpty(node.annotation.tasks as readonly Task<unknown>[])) return false;
            const operations = node.annotation.tasks.flatMap((task) => task.operations);
            return G.isNotNullable(event(operation)) && operations.includes(event(operation)!);
          };

        case 'draft':
          return (): M => {
            const task = A.at(node.annotation.tasks as readonly Task<M>[], -1);
            return G.isNotNullable(task) ? task.state : actual;
          };

        case 'box':
          return (): Box<M> => {
            return { model: actual, inspect: inspect(node, actual) };
          };
      }

      if (G.isArray(target.value) && G.isString(property)) {
        const index = Number(property);

        if (!isNaN(index) && index >= 0 && index < target.value.length) {
          const value = target.value[index];
          const exists =
            G.isArray(node[Config.separator]) &&
            index < (node[Config.separator] as unknown[]).length &&
            (node[Config.separator] as unknown[])[index] instanceof Node;

          return exists
            ? inspect((node[Config.separator] as unknown[])[index] as Node, value)
            : inspect(new Node(value), value);
        }
      }

      if (G.isObject(target.value) && G.isString(property) && property in target.value) {
        const value = (target.value as Record<string, unknown>)[property];

        if (G.isObject(node[Config.separator]) && property in (node[Config.separator] as object)) {
          const actual = (node[Config.separator] as Record<string, unknown>)[property];
          if (actual instanceof Node) return inspect(actual as Tree<typeof value>, value);
        }

        return inspect(new Node(value), value);
      }

      return undefined;
    },
  };

  return new Proxy({ value: actual }, handler) as unknown as Inspectable<M>;
}

/**
 * Recursively removes all annotation tasks that match the given process.
 *
 * @template M - The model type
 * @param node - The annotated node to prune
 * @param process - The process identifier to remove
 * @returns A new annotated structure with matching tasks removed
 *
 * @example
 * ```typescript
 * const pruned = prune(annotations, process);
 * ```
 */
export function prune<M>(node: Tree<M>, process: Process): Tree<M> {
  const tasks = node.annotation.tasks.filter((task) => task.process !== process);
  const annotation = Annotation.restore(tasks as Task<M>[]);

  if (G.isArray(node[Config.separator])) {
    return new Node(
      A.map(node[Config.separator] as readonly Node<unknown>[], (child) =>
        child instanceof Node ? prune(child as Tree<unknown>, process) : child
      ) as M,
      annotation
    ) as Tree<M>;
  }

  if (G.isObject(node[Config.separator])) {
    return new Node(
      D.map(node[Config.separator] as Record<string, unknown>, (child) =>
        child instanceof Node ? prune(child as Tree<unknown>, process) : child
      ) as M,
      annotation
    ) as Tree<M>;
  }

  return new Node(node[Config.separator], annotation) as Tree<M>;
}

/**
 * Applies a recipe to both the model and its annotations, producing updated versions of both.
 *
 * This function generates patches from the recipe using Immer, unwraps them for the model,
 * and merges them with annotations for the annotation tree. The identity function is used
 * to track array values as they move through operations like sort and replacement.
 *
 * @template M - The model type
 * @param model - The current model state
 * @param annotations - The current annotation tree
 * @param recipe - A function that mutates a draft of the model
 * @param identity - Function to get unique identifiers for tracking values through array operations
 * @returns A tuple containing the updated model and updated annotations
 *
 * @example
 * ```typescript
 * const [newModel, newAnnotations] = apply(
 *   model,
 *   annotations,
 *   (draft) => { draft.name = Operation.Update('Jane', process); },
 *   (value) => value.id  // Optional: for tracking objects in arrays
 * );
 * ```
 */
export function apply<M extends Objectish>(
  model: M,
  annotations: Tree<M>,
  recipe: Recipe<M>,
  identity: Identity<M> = defaultIdentity as Identity<M>
): [M, Tree<M>] {
  const [, patches, inversePatches] = Config.immer.produceWithPatches(model, recipe);

  return [
    Config.immer.applyPatches(model, A.map(patches, unwrap)),
    A.reduce(
      A.zip(patches, inversePatches),
      clone(annotations),
      (patches, [patch, inversePatch]) => {
        const mergedPatch = merge(patches, patch, inversePatch, identity);
        return Config.immer.applyPatches(patches, [mergedPatch] as unknown as Patch[]);
      }
    ),
  ];
}

/**
 * Converts a flat path array into a pathified array with Config.separator interspersed.
 * This allows navigation through the Node structure where values are stored in the 'current' property.
 *
 * @param path - The original path array from an Immer patch
 * @returns A new path array with Config.separator interspersed between segments
 *
 * @example
 * ```typescript
 * pathify(['friends', 0, 'name'])
 * // Returns: ['current', 'friends', 'current', 0, 'current', 'name', 'current']
 * ```
 */
function pathify(path: Path[]): Path[] {
  return A.isEmpty(path)
    ? [Config.separator]
    : A.reduce(path, [Config.separator] as Path[], (path, segment) => [
        ...path,
        segment,
        Config.separator,
      ]).slice(0, -1);
}

/**
 * Recursively converts a value to its plain form by unwrapping Annotations.
 *
 * @template T - The value type
 * @param value - The value to convert
 * @returns The plain value with all Annotations unwrapped
 */
function deannotate<T>(value: T): T {
  if (value instanceof Annotation) return deannotate(value.state());
  if (G.isArray(value)) return A.map(value, deannotate) as T;
  if (G.isObject(value)) return D.map(value, deannotate) as T;
  return value;
}

/**
 * Unwraps Annotation instances from a patch, extracting the actual value.
 * This is used to create patches that can be applied to the plain model.
 * Recursively unwraps nested Annotations in arrays and objects.
 *
 * @param patch - The patch that may contain an Annotation value
 * @returns A new patch with the Annotation unwrapped to its underlying value
 *
 * @example
 * ```typescript
 * const patch = { op: 'replace', path: ['name'], value: Annotation.create('John', [State.Update], process) };
 * unwrap(patch); // { op: 'replace', path: ['name'], value: 'John' }
 * ```
 */
function unwrap(patch: Patch): Patch {
  let value = patch.value;
  try {
    value = immer.current(patch.value);
  } catch {}

  return { ...patch, value: deannotate(value) };
}

/**
 * Merges a patch with existing annotations, creating a new patch with pathified paths
 * and Node-wrapped values.
 *
 * This function handles the complex logic of merging Annotation instances with existing annotations,
 * including value-based tracking for arrays. When array items are replaced or reordered, the identity
 * function is used to match values and preserve their annotations as they move through the array.
 *
 * @template M - The model type
 * @param annotations - The current annotation tree
 * @param patch - The patch to merge with annotations
 * @param inversePatch - The inverse patch containing the previous value
 * @param identity - Function to get unique identifiers for tracking values through array operations
 * @returns A new patch with pathified path and Node-wrapped value
 *
 * @example
 * ```typescript
 * const patch = { op: 'replace', path: ['name'], value: Annotation.create('Jane', [State.Update], process) };
 * merge(annotations, patch, inversePatch, (value) => value);
 * // Returns: { op: 'replace', path: ['current', 'name', 'current'], value: Node(...) }
 * ```
 */
function merge<M>(
  annotations: Tree<M>,
  patch: Patch,
  inversePatch: Patch,
  identity: Identity<M> = defaultIdentity as Identity<M>
): Patch {
  const path = pathify(patch.path as Path[]);
  const slice = <Node<unknown> | undefined>get(annotations, path);
  const current = G.isNotNullable(slice) ? slice[Config.separator] : undefined;

  /**
   * Reconciles a patch value with existing annotations, preserving annotations when values match.
   *
   * This function implements value-based tracking for arrays and objects, using the identity
   * function to match new values with existing annotated values. Annotations are preserved only
   * when the identity of values match, allowing annotations to follow values as they move through
   * arrays (during sorts, reorders) or survive object replacements.
   *
   * **Matching strategy:**
   * 1. For arrays: Builds a map of `identity(value) -> Node` from existing array items, then
   *    matches each new item by its identity. Falls back to building the map from inversePatch
   *    values for full array replacements.
   * 2. For objects: Builds a map of `identity(propertyValue) -> Node` from existing properties,
   *    then matches each new property value by identity.
   * 3. For Annotation instances: Merges the new annotation with existing annotations if found.
   * 4. For primitives: Returns a new Node with the value (no matching).
   *
   * **When annotations are preserved:**
   * - Array item 'Alice' with annotation → sort → 'Alice' keeps annotation at new position
   * - Object property `name: 'Alice'` with annotation → object replacement → if new object has
   *   `name: 'Alice'`, the annotation is preserved
   *
   * **When annotations are lost:**
   * - Array item 'Alice' → replaced with 'Bob' → no match, annotation lost
   * - Object property `name: 'Alice'` → replaced with `name: 'Bob'` → no match, annotation lost
   *
   * @template T - The value type being reconciled
   * @param value - The new value from the patch (may be an Annotation, array, object, or primitive)
   * @returns A Node containing the reconciled value with merged annotations, or the original value
   */
  function reconcile<T>(value: T): T | Node {
    if (value instanceof Annotation) {
      if (G.isArray(value.state()) && G.isNotNullable(slice) && G.isArray(current)) {
        const inverse = G.isArray(inversePatch.value) ? inversePatch.value : [];

        return new Node(
          A.map(value.state(), (item) => {
            const deannotated = deannotate(item);
            const previous = A.getIndexBy(inverse, (original) => {
              const id1 = identity(original as IdentityValueType<M>) ?? original;
              const id2 = identity(deannotated as IdentityValueType<M>) ?? deannotated;
              return F.equals(id1, id2);
            });

            const node =
              G.isNotNullable(previous) && previous < (current as Node[]).length
                ? (current as Node[])[previous]
                : undefined;

            if (G.isNotNullable(node)) {
              const annotation =
                item instanceof Annotation
                  ? Annotation.merge(Annotation.merge(node.annotation, value), item)
                  : Annotation.merge(node.annotation, value);

              return new Node(node[Config.separator], annotation);
            }

            return item instanceof Annotation
              ? new Node(deannotated, Annotation.merge(value, item))
              : new Node(deannotated, value);
          }),
          value
        );
      }

      return new Node(
        G.isNotNullable(slice) ? current : inversePatch.value,
        G.isNotNullable(slice) ? Annotation.merge(slice.annotation, value) : value
      );
    }

    if (G.isArray(value) && G.isNotNullable(slice) && G.isArray(current)) {
      const inverse = G.isArray(inversePatch.value) ? inversePatch.value : [];

      return new Node(
        A.map(value, (item) => {
          const deannotated = deannotate(item);
          const previous = A.getIndexBy(inverse, (original) => {
            const id1 = identity(original as IdentityValueType<M>) ?? original;
            const id2 = identity(deannotated as IdentityValueType<M>) ?? deannotated;
            return F.equals(id1, id2);
          });
          const node =
            G.isNotNullable(previous) && previous < (current as Node[]).length
              ? (current as Node[])[previous]
              : undefined;

          return G.isNotNullable(node)
            ? item instanceof Annotation
              ? new Node(node[Config.separator], Annotation.merge(node.annotation, item))
              : node
            : new Node(item);
        }),
        slice.annotation
      );
    }

    if (G.isObject(value) && !G.isArray(value) && G.isNotNullable(slice) && G.isObject(current)) {
      const inverse = G.isObject(inversePatch.value) ? inversePatch.value : {};
      const reconciled = D.mapWithKey(value, (key, item) => {
        const deannotated = deannotate(item);
        const previous = (inverse as Record<string, unknown>)[key as string];
        const node = (current as Record<string, Node>)[key as string];

        const match = G.isNotNullable(previous)
          ? (() => {
              const id1 = identity(previous as IdentityValueType<M>) ?? previous;
              const id2 = identity(deannotated as IdentityValueType<M>) ?? deannotated;
              return F.equals(id1, id2);
            })()
          : false;

        if (G.isNotNullable(node) && node instanceof Node && match) {
          return item instanceof Annotation
            ? new Node(node[Config.separator], Annotation.merge(node.annotation, item))
            : node;
        }

        return new Node(item);
      });

      return new Node(reconciled, slice.annotation);
    }

    return G.isNotNullable(slice)
      ? new Node(current, slice.annotation)
      : new Node(inversePatch.value);
  }

  return {
    ...patch,
    path: path as (string | number)[],
    value: reconcile(patch.value),
  };
}
