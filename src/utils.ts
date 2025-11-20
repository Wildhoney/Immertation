import { G, A } from '@mobily/ts-belt';
import { cloneDeep, get } from 'lodash';
import {
  type Process,
  type Identity,
  type Recipe,
  type Registry,
  type Objectish,
  type Id,
  type Object,
  Config,
  Annotation,
  Op,
} from './types';

/**
 * Reconciles a draft with the current model by extracting annotations and storing them in the registry.
 * Uses Immer's produceWithPatches to generate patches, then applies them while extracting any Annotation
 * instances and replacing them with values from the model at each patch step.
 *
 * @param model - The current model state
 * @param registry - Map that stores annotations by their identifiers
 * @param process - Unique symbol identifying this mutation process
 * @param recipe - A function that mutates the draft to define desired changes
 * @param identity - Function that returns a unique identifier for values
 * @returns The reconciled model with annotations extracted and stored in the registry
 */
export function reconcile<M extends Objectish, T = unknown>(
  model: M,
  registry: Registry,
  process: Process,
  recipe: Recipe<M>,
  identity: Identity<T>,
): M {
  const [, patches] = Config.immer.produceWithPatches(model, recipe);
  const extract = extraction(registry, process, model, identity);

  return <M>Config.immer.applyPatches(
    model,
    patches.map((patch, index) => {
      const state = Config.immer.applyPatches(cloneDeep(model), patches.slice(0, index));
      return { ...patch, value: extract(patch.value, state, patch.path) };
    }),
  );
}

/**
 * Removes annotations associated with a specific process from the registry.
 * Mutates the registry in place, removing annotations belonging to the specified process.
 * If an annotation has multiple tasks from different processes, only tasks from the specified
 * process are filtered out.
 *
 * @param model - The current model state (returned unchanged)
 * @param registry - Map containing annotations to be pruned in place
 * @param process - Unique symbol identifying the process whose annotations should be removed
 * @returns A tuple of [model, registry] where registry has been mutated
 */
export function prune<M extends Objectish>(model: M, registry: Registry, process: Process): [M, Registry] {
  for (const [id, annotation] of registry.entries()) {
    const pruned = annotation.prune(process);
    if (G.isNull(pruned)) registry.delete(id);
    else if (pruned.tasks.length !== annotation.tasks.length) registry.set(id, pruned);
  }

  return [model, registry];
}

/**
 * Predicate that returns true if a value is NOT an Annotation (i.e., it's committed data).
 *
 * @template T - The value type
 * @param value - The value to check
 * @returns True if the value is committed data (not an Annotation), false otherwise
 */
function annotated<T>(value: T): value is Exclude<T, Annotation<unknown>> {
  return !(value instanceof Annotation);
}

/**
 * Safely calls identity on a value by filtering out any Annotation instances.
 *
 * This ensures the developer-supplied identity function only receives committed data
 * from the original model, never partial/uncommitted values wrapped in Annotations
 * that may be missing required fields like 'id'.
 *
 * @param value - The value to compute identity for (may contain Annotations)
 * @param identity - The developer-supplied identity function
 * @returns The identity string computed on clean, committed data
 *
 * @example
 * ```typescript
 * // Array with mixed committed values and Annotations
 * const arr = [{ id: 1 }, Draft({ name: 'New' }, Op.Add), { id: 2 }];
 * // identify filters out the Draft, calls identity([{ id: 1 }, { id: 2 }])
 * const id = identify(arr, (val) => val.map(item => item.id).join(','));
 * ```
 */
function identify<T = unknown>(value: T, identity: Identity<T>): string {
  if (G.isArray(value)) return identity(<T>value.filter(annotated));

  if (G.isObject(value)) {
    const ƒ = (object: Object, [key, value]: [string, T]) => (annotated(value) ? { ...object, [key]: value } : object);
    return identity(<T>Object.entries(value).reduce(ƒ, <Object>{}));
  }

  return identity(<T>value);
}

// ---------------------------------------------------------------------------------

function extraction<T = unknown>(registry: Registry, process: Process, originalModel: unknown, identity: Identity<T>) {
  return function extract<M>(
    value: unknown,
    model: M,
    path: (string | number)[],
    parentFromValue: unknown = undefined,
  ): unknown {
    if (!annotated(value)) {
      const annotation = <Annotation<unknown>>value;
      const property = path[path.length - 1];
      const parent = path.slice(0, -1);

      // Get the parent from the draft (passed via parentFromValue or looked up)
      const draftParent = G.isUndefined(parentFromValue)
        ? A.isNotEmpty(parent)
          ? get(model, parent.join('.'))
          : model
        : parentFromValue;

      // Get parent from ORIGINAL model
      const originalParent = A.isNotEmpty(parent) ? get(originalModel, parent.join('.')) : originalModel;

      // For arrays, use path-based identifiers
      // For objects, use identity-based identifiers (identify filters out Annotations)
      const id: Id = G.isArray(originalParent)
        ? `${parent.join('.')}.${property}`
        : G.isObject(draftParent)
          ? `${identify(draftParent, identity)}.${property}`
          : identify(draftParent, identity);

      registry.set(
        id,
        Annotation.new(annotation.tasks[0].value, annotation.tasks[0].state, process, annotation.tasks[0].property),
      );

      // For Op.Add, return the annotation's value directly (it doesn't exist in the model yet)
      const hasAdd = annotation.tasks[0].state.includes(Op.Add);
      if (hasAdd) {
        return annotation.tasks[0].value;
      }

      // For objects, find the matching item in original by identity
      if (G.isObject(draftParent) && G.isObject(originalParent)) {
        const draftId = identify(draftParent, identity);

        // Check if this object is inside an array by looking at the grandparent
        const grandparent = parent.slice(0, -1);
        const originalGrandparent = A.isNotEmpty(grandparent)
          ? get(originalModel, grandparent.join('.'))
          : originalModel;

        // If the parent's parent is an array, we need to find by identity
        if (G.isArray(originalGrandparent)) {
          const originalItem = originalGrandparent.find((item: unknown) => identity(<T>item) === draftId);
          if (originalItem && G.isObject(originalItem)) {
            return (<Record<string | number, unknown>>originalItem)[property];
          }
        } else {
          // For non-array objects, direct lookup
          return (<Record<string | number, unknown>>originalParent)[property];
        }
      }

      // Fallback to path-based lookup from original model
      return get(originalModel, path.join('.'));
    }

    if (G.isArray(value)) {
      return value.map((item, index) => extract(item, model, [...path, index], value));
    }

    if (G.isObject(value)) {
      return Object.entries(value).reduce(
        (object, [key, val]) => ({
          ...object,
          [key]: extract(val, model, [...path, key], value),
        }),
        <Object>{},
      );
    }

    return value;
  };
}

export function inspect<M extends Objectish, T = unknown>(
  currentModel: M,
  registry: Registry,
  identity: Identity<T>,
): unknown {
  function createInspectors(value: unknown, path: (string | number)[], property: string | number): Object {
    // Always use parent identity + property for consistency with how annotations are stored
    // For arrays, use path-based identifiers; for objects, use identity-based identifiers
    const joined = A.isNotEmpty(path) ? path.join('.') : undefined;
    const parentValue = joined ? get(currentModel, joined) : currentModel;
    const id: Id = G.isArray(parentValue) ? `${joined}.${property}` : `${identify(parentValue, identity)}.${property}`;

    const annotation = registry.get(id);

    const inspectors = {
      pending: () => !!annotation,
      remaining: () => (annotation ? annotation.tasks.length : 0),
      is: (op: number) => {
        if (!annotation) return false;
        return annotation.tasks.some((task) => task.state.includes(op));
      },
      draft: () => {
        const draftValue = annotation && annotation.tasks.length > 0 ? annotation.tasks[0].value : value;
        // For arrays and objects, filter to show draft state (Op.Remove hidden, Op.Add visible)
        if (G.isArray(draftValue) || G.isObject(draftValue)) {
          return filterDraft(draftValue, registry, identity, [...path, property]);
        }
        return draftValue;
      },
      box: () => ({
        model: value,
        inspect: G.isObject(value) || G.isArray(value) ? inspect(currentModel, registry, identity) : inspectors,
      }),
    };

    return inspectors;
  }

  function buildProxy(value: unknown, path: (string | number)[]): unknown {
    // Create a handler for the proxy
    const handler: ProxyHandler<object> = {
      get(_target, prop: string | symbol) {
        if (typeof prop === 'symbol') {
          return (<Record<symbol, unknown>>value)[prop];
        }

        const propValue = (<Record<string | symbol, unknown>>value)[prop];
        // Convert numeric string indices to numbers for arrays
        const propKey = G.isArray(value) && !isNaN(Number(prop)) ? Number(prop) : prop;
        const inspectors = createInspectors(propValue, path, propKey);

        // Inspector methods: pending, remaining, is, draft, box
        if (prop === 'pending' || prop === 'remaining' || prop === 'is' || prop === 'draft' || prop === 'box') {
          // Return undefined - this property doesn't exist on the model
          return undefined;
        }

        if (G.isObject(propValue) || G.isArray(propValue)) {
          // For objects/arrays, create a proxy that exposes both inspectors and nested properties
          const nestedHandler: ProxyHandler<object> = {
            get(_nestedTarget, innerProp) {
              if (typeof innerProp === 'symbol') {
                return (<Record<symbol, unknown>>propValue)[innerProp];
              }

              // Check if it's an inspector method
              if (innerProp in inspectors) {
                return inspectors[<keyof typeof inspectors>innerProp];
              }

              // Otherwise, recursively build proxy for nested property
              const innerProxy = buildProxy(propValue, [...path, propKey]);
              return (<Record<string | symbol, unknown>>innerProxy)[innerProp];
            },
          };
          return new Proxy({}, nestedHandler);
        }

        // For primitives, return an object with inspector methods
        return inspectors;
      },
    };

    return new Proxy({}, handler);
  }

  return buildProxy(currentModel, []);
}

export function present<M extends Objectish, T = unknown>(model: M, registry: Registry, _identity: Identity<T>): M {
  function filter(value: unknown, path: (string | number)[]): unknown {
    if (G.isArray(value)) {
      return value
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => {
          // For array items, check annotation using path-based identifier
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const id = arrayPath ? `${arrayPath}.${index}` : `${index}`;
          const annotation = registry.get(id);

          if (!annotation) return true;

          // Filter out items with Op.Add (they exist in draft but not model)
          // Keep items with Op.Remove (they exist in model but not draft)
          const hasAdd = annotation.tasks.some((task) => task.state.includes(Op.Add));
          return !hasAdd;
        })
        .map(({ item, index }) => filter(item, [...path, index]));
    }

    if (G.isObject(value)) {
      return Object.entries(value).reduce(
        (object, [key, val]) => ({
          ...object,
          [key]: filter(val, [...path, key]),
        }),
        <Object>{},
      );
    }

    return value;
  }

  return <M>filter(model, []);
}

export function filterDraft<M extends Objectish, T = unknown>(
  model: M,
  registry: Registry,
  _identity: Identity<T>,
  initialPath: (string | number)[] = [],
): M {
  function filter(value: unknown, path: (string | number)[]): unknown {
    if (G.isArray(value)) {
      const filtered = value
        .map((item, index) => ({ item, index, originalIndex: index }))
        .filter(({ originalIndex }) => {
          // For array items, check annotation using path-based identifier
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const id = arrayPath ? `${arrayPath}.${originalIndex}` : `${originalIndex}`;
          const annotation = registry.get(id);

          if (!annotation) return true;

          // Keep items with Op.Add (they exist in draft but not model)
          // Filter out items with Op.Remove (they exist in model but not draft)
          const hasRemove = annotation.tasks.some((task) => task.state.includes(Op.Remove));
          return !hasRemove;
        })
        .map(({ item, originalIndex }, newIndex) => {
          // If there's an Op.Add annotation, use the annotation's value instead of the item
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const id = arrayPath ? `${arrayPath}.${originalIndex}` : `${originalIndex}`;
          const annotation = registry.get(id);
          if (annotation) {
            const hasAdd = annotation.tasks.some((task) => task.state.includes(Op.Add));
            if (hasAdd) {
              // Use the annotation's value (the item being added)
              return filter(annotation.tasks[0].value, [...path, newIndex]);
            }
          }
          return filter(item, [...path, newIndex]);
        });
      return filtered;
    }

    if (G.isObject(value)) {
      return Object.entries(value).reduce(
        (object, [key, val]) => ({
          ...object,
          [key]: filter(val, [...path, key]),
        }),
        <Object>{},
      );
    }

    return value;
  }

  return <M>filter(model, initialPath);
}
