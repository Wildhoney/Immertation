import type { Recipe, Annotated, Path, Operations, Target, Wrapper, Process, Task } from './types';
import { Node, Annotation, Config, State, Operation } from './types';
import type { Objectish, Patch } from 'immer';
import * as immer from 'immer';
import { A, D, G } from '@mobily/ts-belt';
import clone from 'lodash/cloneDeep';
import get from 'lodash/get';

/**
 * Recursively wraps a model in Node instances to create an annotated structure.
 * Each value in the model is wrapped in a Node containing the value and empty annotations.
 *
 * @template M - The model type to annotate
 * @param model - The model to wrap in Node instances
 * @returns An annotated version of the model with Node wrappers at every level
 *
 * @example
 * ```typescript
 * const model = { name: 'John', friends: ['Alice', 'Bob'] };
 * const annotated = annotate(model);
 * ```
 */
export function annotate<M>(model: M): Annotated<M> {
  if (G.isNullable(model)) return new Node(model) as Annotated<M>;
  if (G.isArray(model)) return new Node(A.map(model, (value) => annotate(value))) as Annotated<M>;
  if (G.isObject(model)) return new Node(D.map(model, (value) => annotate(value))) as Annotated<M>;
  return new Node(model) as Annotated<M>;
}

/**
 * Maps an Operation function to its corresponding State enum value.
 *
 * This function is used internally by the `is()` helper method to check if a specific
 * operation type exists in the annotation records. It converts operation factory functions
 * like `Operation.Add` into their corresponding `State.Add` enum values for comparison.
 *
 * @param operation - The operation factory function to map
 * @returns The corresponding State enum value, or undefined if the operation is not recognized
 *
 * @example
 * ```typescript
 * state(Operation.Add) // Returns State.Add
 * state(Operation.Update) // Returns State.Update
 * state(Operation.Sort) // Returns State.Sort
 * ```
 */
export function state(operation: Operations): State | undefined {
  return operation === Operation.Add
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
              : undefined;
}

/**
 * Creates a proxy over the model that provides annotation helper methods for any property.
 *
 * This function generates the annotation proxy returned by `mutate()` and `prune()`. The proxy
 * dynamically provides three methods on every property path in the model:
 * - `pending()`: Returns true if the property has annotation records
 * - `is(Operation)`: Checks if a specific operation type exists in the property's annotations
 * - `draft()`: Returns the value from the most recent annotation record
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
 * const [model, annotations] = instance.mutate((draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 * annotations.name.pending() // true - has annotation records
 * annotations.name.is(Operation.Update) // true - has Update operation
 * annotations.name.draft() // 'Jane' - value from latest record
 * ```
 */
export function helpers<M>(node: Annotated<M>, model?: M): Target<M> {
  const actual = G.isNotNullable(model) ? model : (node[Config.separator] as M);

  const handler: ProxyHandler<Wrapper<M>> = {
    get(target: Wrapper<M>, property: string | symbol): unknown {
      switch (property) {
        case 'pending':
          return (): boolean => A.isNotEmpty(node.annotation.tasks as readonly Task<unknown>[]);

        case 'is':
          return (operation: Operations): boolean => {
            if (A.isEmpty(node.annotation.tasks as readonly Task<unknown>[])) return false;
            const operations = node.annotation.tasks.flatMap((task) => task.operations);
            return G.isNotNullable(state(operation)) && operations.includes(state(operation)!);
          };

        case 'draft':
          return () => {
            const task = A.at(node.annotation.tasks as readonly Task<unknown>[], -1);
            return G.isNotNullable(task) ? task.value : actual;
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
            ? helpers((node[Config.separator] as unknown[])[index] as Node, value)
            : helpers(new Node(value), value);
        }
      }

      if (G.isObject(target.value) && G.isString(property) && property in target.value) {
        const value = (target.value as Record<string, unknown>)[property];

        if (G.isObject(node[Config.separator]) && property in (node[Config.separator] as object)) {
          const nodeValue = (node[Config.separator] as Record<string, unknown>)[property];
          if (nodeValue instanceof Node)
            return helpers(nodeValue as Annotated<typeof value>, value);
        }

        return helpers(new Node(value), value);
      }

      return undefined;
    },
  };

  return new Proxy({ value: actual }, handler) as unknown as Target<M>;
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
export function prune<M>(node: Annotated<M>, process: Process): Annotated<M> {
  const tasks = node.annotation.tasks.filter((task) => task.process !== process);
  const annotation = Annotation.restore(tasks as Task<M>[]);

  if (G.isArray(node[Config.separator])) {
    return new Node(
      A.map(node[Config.separator] as readonly Node<unknown>[], (child) =>
        child instanceof Node ? prune(child as Annotated<unknown>, process) : child
      ) as M,
      annotation
    ) as Annotated<M>;
  }

  if (G.isObject(node[Config.separator])) {
    return new Node(
      D.map(node[Config.separator] as Record<string, unknown>, (child) =>
        child instanceof Node ? prune(child as Annotated<unknown>, process) : child
      ) as M,
      annotation
    ) as Annotated<M>;
  }

  return new Node(node[Config.separator], annotation) as Annotated<M>;
}

/**
 * Applies a recipe to both the model and its annotations, producing updated versions of both.
 * This function generates patches from the recipe, unwraps them for the model, and merges
 * them with annotations for the annotation tree.
 *
 * @template M - The model type
 * @param model - The current model state
 * @param annotations - The current annotation tree
 * @param recipe - A function that mutates a draft of the model
 * @returns A tuple containing the updated model and updated annotations
 *
 * @example
 * ```typescript
 * const [newModel, newAnnotations] = apply(
 *   model,
 *   annotations,
 *   (draft) => { draft.name = Operation.Update('Jane', process); }
 * );
 * ```
 */
export function apply<M extends Objectish>(
  model: M,
  annotations: Annotated<M>,
  recipe: Recipe<M>
): [M, Annotated<M>] {
  const [, patches, inversePatches] = Config.immer.produceWithPatches(model, recipe);

  return [
    Config.immer.applyPatches(model, A.map(patches, unwrap)),
    A.reduce(
      A.zip(patches, inversePatches),
      clone(annotations),
      (patches, [patch, inversePatch]) => {
        const mergedPatch = merge(patches, patch, inversePatch);
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
 * @param value - The value to convert
 * @returns The plain value with all Annotations unwrapped
 */
function plain(value: unknown): unknown {
  if (value instanceof Annotation) return plain(value.value);
  if (G.isArray(value)) return A.map(value, plain);
  if (G.isObject(value)) return D.map(value, plain);
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

  return { ...patch, value: plain(value) };
}

/**
 * Merges a patch with existing annotations, creating a new patch with pathified paths
 * and Node-wrapped values. Handles merging of Annotation instances with existing annotations.
 *
 * @template M - The model type
 * @param annotations - The current annotation tree
 * @param patch - The patch to merge with annotations
 * @param inversePatch - The inverse patch containing the previous value
 * @returns A new patch with pathified path and Node-wrapped value
 *
 * @example
 * ```typescript
 * const patch = { op: 'replace', path: ['name'], value: Annotation.create('Jane', [State.Update], process) };
 * merge(annotations, patch, inversePatch);
 * // Returns: { op: 'replace', path: ['current', 'name', 'current'], value: Node(...) }
 * ```
 */
function merge<M>(annotations: Annotated<M>, patch: Patch, inversePatch: Patch): Patch {
  const path = pathify(patch.path as Path[]);
  const slice = <Node<unknown> | undefined>get(annotations, path);
  const sliceCurrent = G.isNotNullable(slice) ? slice[Config.separator] : undefined;

  function handle(value: unknown): unknown {
    if (value instanceof Annotation) {
      if (G.isArray(value.value) && G.isNotNullable(slice) && G.isArray(sliceCurrent)) {
        const inverse = G.isArray(inversePatch.value) ? inversePatch.value : [];
        const originalIndex = A.map(
          A.map(value.value, plain),
          (item) => A.getIndexBy(inverse, (original) => original === item) ?? -1
        );

        return new Node(
          A.mapWithIndex(value.value, (sortedIndex, item) => {
            const index = originalIndex[sortedIndex];

            if (index === -1 && item instanceof Annotation) {
              const usedIndices = new Set(A.filter(originalIndex, (index) => index >= 0));
              const missingIndex = A.getIndexBy(
                A.range(0, (sliceCurrent as Node[]).length - 1),
                (index) => !usedIndices.has(index)
              );

              if (G.isNotNullable(missingIndex) && missingIndex < (sliceCurrent as Node[]).length) {
                const node = (sliceCurrent as Node[])[missingIndex];
                return new Node(node[Config.separator], Annotation.merge(node.annotation, item));
              }

              return new Node(plain(item), item);
            }

            if (index >= 0 && index < (sliceCurrent as Node[]).length) {
              const node = (sliceCurrent as Node[])[index];
              return item instanceof Annotation
                ? new Node(node[Config.separator], Annotation.merge(node.annotation, item))
                : node;
            }

            return item instanceof Annotation ? new Node(plain(item), item) : new Node(plain(item));
          }),
          value
        );
      }

      return new Node(
        G.isNotNullable(slice) ? sliceCurrent : inversePatch.value,
        G.isNotNullable(slice) ? Annotation.merge(slice.annotation, value) : value
      );
    }

    if (G.isArray(value) && G.isNotNullable(slice) && G.isArray(sliceCurrent)) {
      return new Node(
        A.mapWithIndex(value, (index, item) => {
          const existingNode = (sliceCurrent as Node[])[index];
          if (item instanceof Annotation && G.isNotNullable(existingNode)) {
            return new Node(
              existingNode[Config.separator],
              Annotation.merge(existingNode.annotation, item)
            );
          }
          if (G.isNotNullable(existingNode)) {
            return existingNode;
          }
          return new Node(item);
        }),
        slice.annotation
      );
    }

    if (G.isNotNullable(slice)) {
      return new Node(sliceCurrent, slice.annotation);
    }

    return new Node(inversePatch.value);
  }

  return {
    ...patch,
    path: path as (string | number)[],
    value: handle(patch.value),
  };
}
