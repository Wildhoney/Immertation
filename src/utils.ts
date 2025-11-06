import type { Recipe, Annotated, Path } from './types';
import { Node, Annotation, Config } from './types';
import type { Objectish, Patch } from 'immer';
import * as immer from 'immer';
import { A, D, G } from '@mobily/ts-belt';
import clone from 'lodash/cloneDeep';
import get from 'lodash/get';

/**
 * Recursively wraps a model in Node instances to create an annotated structure.
 * Each value in the model (primitives, objects, arrays) is wrapped in a Node containing
 * the value and its associated annotations.
 *
 * @template M - The model type to annotate
 * @param model - The model to wrap in Node instances
 * @returns An annotated version of the model with Node wrappers at every level
 *
 * @example
 * ```typescript
 * const model = { name: 'John', friends: ['Alice', 'Bob'] };
 * const annotated = annotate(model);
 * // annotated.current.name.current === 'John'
 * // annotated.current.friends.current[0].current === 'Alice'
 * ```
 */
export function annotate<M>(model: M): Annotated<M> {
  if (G.isNullable(model)) return new Node(model) as Annotated<M>;
  if (G.isArray(model)) return new Node(A.map(model, (value) => annotate(value))) as Annotated<M>;
  if (G.isObject(model)) return new Node(D.map(model, (value) => annotate(value))) as Annotated<M>;
  return new Node(model) as Annotated<M>;
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
  const getCurrentValue = G.isNotNullable(slice) ? slice.current : inversePatch.value;

  function handle(value: unknown): unknown {
    if (value instanceof Annotation) {
      if (G.isArray(value.value) && G.isNotNullable(slice) && G.isArray(slice.current)) {
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
                A.range(0, (slice.current as Node[]).length - 1),
                (index) => !usedIndices.has(index)
              );

              if (
                G.isNotNullable(missingIndex) &&
                missingIndex < (slice.current as Node[]).length
              ) {
                const node = (slice.current as Node[])[missingIndex];
                return new Node(node.current, Annotation.merge(node.annotation, item));
              }

              return new Node(plain(item), item);
            }

            if (index >= 0 && index < (slice.current as Node[]).length) {
              const node = (slice.current as Node[])[index];
              return item instanceof Annotation
                ? new Node(node.current, Annotation.merge(node.annotation, item))
                : node;
            }

            return item instanceof Annotation ? new Node(plain(item), item) : new Node(plain(item));
          }),
          value
        );
      }

      return new Node(
        getCurrentValue,
        G.isNotNullable(slice) ? Annotation.merge(slice.annotation, value) : value
      );
    }

    if (G.isArray(value) && G.isNotNullable(slice) && G.isArray(slice.current)) {
      return new Node(
        A.mapWithIndex(value, (index, item) => {
          const existingNode = (slice.current as Node[])[index];
          if (item instanceof Annotation && G.isNotNullable(existingNode)) {
            return new Node(existingNode.current, Annotation.merge(existingNode.annotation, item));
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
      return new Node(slice.current, slice.annotation);
    }

    return new Node(inversePatch.value);
  }

  return {
    ...patch,
    path: path as (string | number)[],
    value: handle(patch.value),
  };
}
