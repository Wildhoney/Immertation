import type {
  Inspectable,
  Operations,
  Process,
  Recipe,
  Annotated,
  Analysis,
  Patches,
} from './types';
import { Annotation, Config, Event, type Property } from './types';
import type { Objectish } from 'immer';
import { A, G } from '@mobily/ts-belt';
import clone from 'lodash/clonedeep';

/**
 * Analyzes a recipe by generating patches for both model and annotations.
 *
 * This function runs the recipe against clones of both the model and annotations to generate
 * forward and inverse patches. These patches can then be used to update the actual model and
 * annotation tree while preserving immutability.
 *
 * @template M - The model type, must extend Objectish (plain objects or arrays)
 * @param model - The current model state
 * @param annotations - The current annotation tree mirroring the model structure
 * @param recipe - The Immer recipe function that mutates a draft of the state
 * @returns Analysis object containing patches and inverse patches for both model and annotations
 *
 * @example
 * ```typescript
 * const analysis = analyse(model, annotations, (draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 * // Use analysis.model.patches and analysis.annotations.patches to update state
 * ```
 */
export function analyse<M extends Objectish>(
  model: M,
  annotations: Annotated<M>,
  recipe: Recipe<M>
): Analysis {
  const [, modelPatches, modelInversePatches] = Config.immer.produceWithPatches(
    clone(model),
    recipe
  );

  const [, annotationPatches, annotationInversePatches] = Config.immer.produceWithPatches(
    clone(annotations),
    recipe
  );

  return {
    model: {
      patches: modelPatches,
      inversePatches: modelInversePatches,
    },
    annotations: {
      patches: annotationPatches,
      inversePatches: annotationInversePatches,
    },
  };
}

/**
 * Consolidates annotations from forward and inverse patches for updating the annotation tree.
 *
 * This function merges annotation information from both the forward patches (representing the
 * new state) and inverse patches (representing the old state). When both patches contain
 * Annotation objects, they are merged to preserve all task history. This ensures that operation
 * tracking is maintained correctly through state transitions.
 *
 * Processing logic:
 * - If only forward patch has Annotation: use forward patch annotation
 * - If both have Annotations: merge using Annotation.merge (inverse first, then forward)
 * - If only inverse patch has Annotation: use inverse patch annotation
 * - Otherwise: use forward patch as-is
 *
 * @param patches - The forward patches from annotation tree mutations
 * @param inversePatches - The inverse patches from annotation tree mutations
 * @returns Consolidated patches ready to apply to the annotation tree
 *
 * @example
 * ```typescript
 * const consolidated = consolidate(
 *   analysis.annotations.patches,
 *   analysis.annotations.inversePatches
 * );
 * const newAnnotations = applyPatches(annotations, consolidated);
 * ```
 */
export function consolidate(patches: Patches, inversePatches: Patches): Patches {
  return A.zipWith(patches, inversePatches, (patch, inversePatch) => {
    const patchValue = patch.value;
    const inversePatchValue = inversePatch.value;
    const patchIsAnnotation = patchValue instanceof Annotation;
    const inverseIsAnnotation = inversePatchValue instanceof Annotation;

    return patchIsAnnotation && inverseIsAnnotation
      ? { ...patch, value: Annotation.merge(inversePatchValue, patchValue) }
      : !patchIsAnnotation && inverseIsAnnotation
        ? { ...patch, value: inversePatchValue }
        : patch;
  });
}

/**
 * Restores model patches by extracting values from Annotation objects.
 *
 * When mutations use Operation helpers (Add, Update, Remove, etc.), the patches contain
 * Annotation objects instead of plain values. This function extracts the actual state values
 * from these Annotations so they can be applied to the model. It takes the state from the
 * last task in each Annotation, representing the most recent value.
 *
 * Processing logic:
 * - If patch value is an Annotation: extract state from last task, or use inverse value as fallback
 * - Otherwise: use patch value as-is
 *
 * @param patches - The forward patches from model mutations
 * @param inversePatches - The inverse patches from model mutations (used as fallback when no task exists)
 * @returns Restored patches with Annotation objects replaced by their state values
 *
 * @example
 * ```typescript
 * const restored = restore(
 *   analysis.model.patches,
 *   analysis.model.inversePatches
 * );
 * const newModel = applyPatches(model, restored);
 * ```
 */
export function restore(patches: Patches, inversePatches: Patches): Patches {
  return A.zipWith(patches, inversePatches, (patch, inversePatch) => {
    if (patch.value instanceof Annotation) {
      const task = A.last(patch.value.tasks);
      return { ...patch, value: task ? task.state : inversePatch.value };
    }
    return patch;
  });
}

/**
 * Maps an Operation function to its corresponding Event enum value.
 *
 * Operations (Add, Update, Remove, etc.) are functions used in recipes to mark state changes.
 * Events are enum values stored in annotation tasks to represent the type of change. This
 * function converts from the function reference to the enum value for storage and querying.
 *
 * @param operation - The Operation function (Operation.Add, Operation.Update, etc.)
 * @returns The corresponding Event enum value, or undefined if operation is unrecognized
 *
 * @example
 * ```typescript
 * const eventType = event(Operation.Update); // Event.Update
 * const eventType = event(Operation.Add);    // Event.Add
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
 * Creates an inspection proxy over the model that provides annotation query methods.
 *
 * The inspect proxy wraps the model and provides methods to query the annotation state
 * at any level of the model structure. It supports nested property access, allowing you
 * to drill down into objects and arrays to inspect annotations at specific paths.
 *
 * Available methods on any property:
 * - `pending()` - Returns true if there are any annotation tasks
 * - `remaining()` - Returns the count of annotation tasks
 * - `is(Operation)` - Returns true if the annotation includes a specific operation type
 * - `draft()` - Returns the value from the latest annotation task, or the model value
 * - `box()` - Returns an object with `{ model, inspect }` for easy component passing
 *
 * @template M - The model type
 * @param annotations - The annotation tree to query
 * @param model - The model values to inspect
 * @returns An inspection proxy with query methods available on all properties
 *
 * @example
 * ```typescript
 * const inspectable = inspect(annotations, model);
 *
 * inspectable.name.pending();           // Check if name has pending operations
 * inspectable.name.remaining();         // Count of pending tasks
 * inspectable.name.is(Operation.Update); // Check for specific operation
 * inspectable.name.draft();             // Get latest draft value
 *
 * const box = inspectable.name.box();   // Get { model, inspect } for passing to components
 * ```
 */
export function inspect<M>(annotations: Annotated<M>, model: M): Inspectable<M> {
  const handler: ProxyHandler<{ value: M }> = {
    get(_, property: Property): unknown {
      switch (property) {
        case 'pending':
          return (): boolean => {
            return annotations instanceof Annotation && !A.isEmpty(annotations.tasks);
          };

        case 'remaining':
          return (): number => {
            return annotations instanceof Annotation ? A.length(annotations.tasks) : 0;
          };

        case 'is':
          return (operation: Operations): boolean => {
            if (!(annotations instanceof Annotation) || A.isEmpty(annotations.tasks)) return false;
            const operations = annotations.tasks.flatMap((task) => task.operations);
            return operations.includes(event(operation)!);
          };

        case 'draft':
          return (): M => {
            if (annotations instanceof Annotation) {
              const task = A.last(annotations.tasks);
              return task ? task.state : model;
            }
            return model;
          };

        case 'box':
          return () => ({
            model,
            inspect: inspect(annotations, model),
          });
      }

      if (G.isString(property) || G.isNumber(property)) {
        if (G.isArray(model)) {
          const index = G.isNumber(property) ? property : Number(property);
          if (!isNaN(index) && index >= 0 && index < A.length(model)) {
            const annotation =
              G.isArray(annotations) && index < A.length(annotations)
                ? annotations[index]
                : model[index];

            return inspect(<Annotated<unknown>>annotation, model[index]);
          }
        } else if (G.isObject(model) && !G.isArray(model) && property in model) {
          const modelRecord = <Record<string | number, unknown>>model;
          const value = modelRecord[property];
          const annotation =
            G.isObject(annotations) &&
            !G.isArray(annotations) &&
            !(annotations instanceof Annotation) &&
            property in annotations
              ? (<Record<string | number, unknown>>annotations)[property]
              : value;

          return inspect(<Annotated<unknown>>annotation, value);
        }
      }

      return undefined;
    },
  };

  return <Inspectable<M>>(<unknown>new Proxy({ value: model }, handler));
}

/**
 * Removes all annotation tasks for a specific process without modifying the model.
 *
 * This function recursively traverses the annotation tree and filters out all tasks
 * that match the given process identifier. The model is returned unchanged. This is
 * useful for cleaning up annotations after async operations complete (e.g., after an
 * API request finishes successfully).
 *
 * The function handles three cases:
 * - Annotation nodes: Filter tasks and restore to plain value if empty
 * - Arrays: Recursively prune each element
 * - Objects: Recursively prune each property
 * - Primitives: Return as-is
 *
 * @template M - The model type
 * @param model - The current model state (returned unchanged)
 * @param annotations - The annotation tree to prune
 * @param process - The process identifier to remove from all annotations
 * @returns Tuple of [unchanged model, pruned annotations]
 *
 * @example
 * ```typescript
 * const process = Symbol('api-request');
 * state.mutate((draft) => {
 *   draft.name = Operation.Update('Jane', process);
 * });
 *
 * const [model, annotations] = prune(state.model, state.annotations, process);
 * ```
 */
export function prune<M>(model: M, annotations: Annotated<M>, process: Process): [M, Annotated<M>] {
  if (annotations instanceof Annotation) {
    const tasks = annotations.tasks.filter((task) => task.process !== process);
    return [model, <Annotated<M>>Annotation.restore(tasks)];
  }

  if (G.isArray(annotations) && G.isArray(model)) {
    const pruned = A.mapWithIndex(annotations, (index, item) => prune(model[index], item, process));
    return [
      <M>A.map(pruned, ([model]) => model),
      <Annotated<M>>A.map(pruned, ([, annotations]) => annotations),
    ];
  }

  if (
    G.isObject(annotations) &&
    G.isObject(model) &&
    !G.isArray(annotations) &&
    !(annotations instanceof Annotation)
  ) {
    const initial = { model: <Partial<M>>{}, annotations: <Partial<Annotated<M>>>{} };
    const result = A.reduce(Object.keys(annotations), initial, (prunes, key) => {
      const value = (<Record<string, unknown>>model)[key];
      const annotation = (<Record<string, unknown>>annotations)[key];
      const [child, children] = prune(value, <Annotated<typeof value>>annotation, process);
      return {
        model: { ...prunes.model, [key]: child },
        annotations: { ...prunes.annotations, [key]: children },
      };
    });

    return [<M>result.model, <Annotated<M>>result.annotations];
  }

  return [model, annotations];
}

import { Operation } from './types';
