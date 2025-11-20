import { G, A } from '@mobily/ts-belt';
import { cloneDeep, get } from 'lodash';
import {
  type Process,
  type Identity,
  type Recipe,
  type Registry,
  type Objectish,
  type Identifier,
  Config,
  Annotation,
  Op,
} from './types';

/**
 * Safely calls identity on a value, handling Annotation objects in arrays.
 */
function safeIdentity(value: unknown, identity: Identity): string {
  if (G.isArray(value)) {
    // Filter out Annotations for identity computation by extracting their values
    const cleaned = value.map((item) => {
      if (item instanceof Annotation) {
        return item.tasks[0].value;
      }
      return item;
    });
    return identity(cleaned);
  }
  return identity(value);
}

/**
 * Recursively extracts Annotation instances and replaces them with values from the model.
 * Stores annotations in the registry using the identity function.
 */
function extraction(registry: Registry, identity: Identity, process: Process, originalModel: any) {
  return function extract<M>(
    value: unknown,
    model: M,
    path: (string | number)[],
    parentFromValue: unknown = undefined
  ): unknown {
    if (value instanceof Annotation) {
      const property = path[path.length - 1];
      const parent = path.slice(0, -1);

      // Use the parent object from the value being walked, or look it up from model using path
      const parentValue = G.isUndefined(parentFromValue)
        ? A.isNotEmpty(parent)
          ? get(model, parent.join('.'))
          : model
        : parentFromValue;

      // For arrays, use path-based identifiers since content-based identifiers change when items are added/removed
      // For objects, use identity-based identifiers
      const identifier: Identifier = G.isArray(parentValue)
        ? `${parent.join('.')}.${property}`
        : G.isObject(parentValue)
          ? `${safeIdentity(parentValue, identity)}.${property}`
          : identity(parentValue);

      registry.set(
        identifier,
        Annotation.new(value.tasks[0].value, value.tasks[0].state, process, value.tasks[0].property)
      );

      // For Op.Add, return the annotation's value directly (it doesn't exist in the model yet)
      const hasAdd = value.tasks[0].state.includes(Op.Add);
      if (hasAdd) {
        return value.tasks[0].value;
      }

      // Use identity to find the original value from the original model
      const parentId =
        G.isObject(parentValue) || G.isArray(parentValue)
          ? safeIdentity(parentValue, identity)
          : null;
      if (parentId && A.isNotEmpty(parent)) {
        // Get the array containing this item in the original model
        const arrayPath = parent.slice(0, -1);
        const originalArray = A.isNotEmpty(arrayPath)
          ? get(originalModel, arrayPath.join('.'))
          : originalModel;

        if (G.isArray(originalArray)) {
          // Find the item with the same identity in the original array
          const originalItem = originalArray.find((item: any) => identity(item) === parentId);
          if (originalItem && G.isObject(originalItem)) {
            return (originalItem as any)[property];
          }
        }
      }

      // Fallback to path-based lookup
      return get(model, path.join('.'));
    }

    if (G.isArray(value)) {
      return value.map((item, index) => extract(item, model, [...path, index], value));
    }

    if (G.isObject(value)) {
      return Object.entries(value).reduce(
        (result, [key, val]) => ({
          ...result,
          [key]: extract(val, model, [...path, key], value),
        }),
        {} as Record<string, unknown>
      );
    }

    return value;
  };
}

/**
 * Reconciles the draft with the current model using Immer's produceWithPatches.
 * Iterates over patches, clones the model, applies patches up to each point,
 * finds annotations in patch.value and replaces them with values from the model.
 * Stores annotations in the registry using the identity function.
 */
export function reconcile<M extends Objectish>(
  model: M,
  recipe: Recipe<M>,
  registry: Registry,
  identity: Identity,
  process: Process
): M {
  const [, patches] = Config.immer.produceWithPatches(model, recipe);
  const extract = extraction(registry, identity, process, model);

  return Config.immer.applyPatches(
    model,
    patches.map((patch, index) => {
      const cloned = cloneDeep(model);
      const state = Config.immer.applyPatches(cloned, patches.slice(0, index));
      return { ...patch, value: extract(patch.value, state, patch.path) };
    })
  ) as M;
}

/**
 * Creates an inspection proxy for querying annotation state from the registry.
 */
export function inspect<M extends Objectish>(
  currentModel: M,
  registry: Registry,
  identity: Identity
): unknown {
  function createInspectors(
    value: unknown,
    path: (string | number)[],
    property: string | number
  ): Record<string, unknown> {
    // Always use parent identity + property for consistency with how annotations are stored
    // For arrays, use path-based identifiers; for objects, use identity-based identifiers
    const joined = A.isNotEmpty(path) ? path.join('.') : undefined;
    const parentValue = joined ? get(currentModel, joined) : currentModel;
    const identifier: Identifier = G.isArray(parentValue)
      ? `${joined}.${property}`
      : `${safeIdentity(parentValue, identity)}.${property}`;

    const annotation = registry.get(identifier);

    const inspectors = {
      pending: () => !!annotation,
      remaining: () => (annotation ? annotation.tasks.length : 0),
      is: (op: number) => {
        if (!annotation) return false;
        return annotation.tasks.some((task) => task.state.includes(op));
      },
      draft: () => {
        const draftValue =
          annotation && annotation.tasks.length > 0 ? annotation.tasks[0].value : value;
        // For arrays and objects, filter to show draft state (Op.Remove hidden, Op.Add visible)
        if (G.isArray(draftValue) || G.isObject(draftValue)) {
          return filterDraft(draftValue, registry, identity, [...path, property]);
        }
        return draftValue;
      },
      box: () => ({
        model: value,
        inspect:
          G.isObject(value) || G.isArray(value)
            ? inspect(currentModel, registry, identity)
            : inspectors,
      }),
    };

    return inspectors;
  }

  function buildProxy(value: unknown, path: (string | number)[]): unknown {
    // Create a handler for the proxy
    const handler: ProxyHandler<object> = {
      get(_target, prop: string | symbol) {
        if (typeof prop === 'symbol') {
          return (value as Record<symbol, unknown>)[prop];
        }

        const propValue = (value as Record<string | symbol, unknown>)[prop];
        // Convert numeric string indices to numbers for arrays
        const propKey = G.isArray(value) && !isNaN(Number(prop)) ? Number(prop) : prop;
        const inspectors = createInspectors(propValue, path, propKey);

        // Inspector methods: pending, remaining, is, draft, box
        if (
          prop === 'pending' ||
          prop === 'remaining' ||
          prop === 'is' ||
          prop === 'draft' ||
          prop === 'box'
        ) {
          // Return undefined - this property doesn't exist on the model
          return undefined;
        }

        if (G.isObject(propValue) || G.isArray(propValue)) {
          // For objects/arrays, create a proxy that exposes both inspectors and nested properties
          const nestedHandler: ProxyHandler<object> = {
            get(_nestedTarget, innerProp) {
              if (typeof innerProp === 'symbol') {
                return (propValue as Record<symbol, unknown>)[innerProp];
              }

              // Check if it's an inspector method
              if (innerProp in inspectors) {
                return inspectors[innerProp as keyof typeof inspectors];
              }

              // Otherwise, recursively build proxy for nested property
              const innerProxy = buildProxy(propValue, [...path, propKey]);
              return (innerProxy as Record<string | symbol, unknown>)[innerProp];
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

/**
 * Presents the model by filtering to exclude items with Op.Add annotations.
 * Items with Op.Remove stay in the model (they're removed from draft, not model).
 */
export function present<M extends Objectish>(model: M, registry: Registry, _identity: Identity): M {
  function filter(value: unknown, path: (string | number)[]): unknown {
    if (G.isArray(value)) {
      return value
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => {
          // For array items, check annotation using path-based identifier
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const identifier = arrayPath ? `${arrayPath}.${index}` : `${index}`;
          const annotation = registry.get(identifier);

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
        (result, [key, val]) => ({
          ...result,
          [key]: filter(val, [...path, key]),
        }),
        {} as Record<string, unknown>
      );
    }

    return value;
  }

  return filter(model, []) as M;
}

/**
 * Filters the draft to exclude items with Op.Remove annotations.
 * Items with Op.Add stay in the draft (they're added to draft, not model).
 */
export function filterDraft<M extends Objectish>(
  model: M,
  registry: Registry,
  _identity: Identity,
  initialPath: (string | number)[] = []
): M {
  function filter(value: unknown, path: (string | number)[]): unknown {
    if (G.isArray(value)) {
      const filtered = value
        .map((item, index) => ({ item, index, originalIndex: index }))
        .filter(({ originalIndex }) => {
          // For array items, check annotation using path-based identifier
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const identifier = arrayPath ? `${arrayPath}.${originalIndex}` : `${originalIndex}`;
          const annotation = registry.get(identifier);

          if (!annotation) return true;

          // Keep items with Op.Add (they exist in draft but not model)
          // Filter out items with Op.Remove (they exist in model but not draft)
          const hasRemove = annotation.tasks.some((task) => task.state.includes(Op.Remove));
          return !hasRemove;
        })
        .map(({ item, originalIndex }, newIndex) => {
          // If there's an Op.Add annotation, use the annotation's value instead of the item
          const arrayPath = A.isNotEmpty(path) ? path.join('.') : '';
          const identifier = arrayPath ? `${arrayPath}.${originalIndex}` : `${originalIndex}`;
          const annotation = registry.get(identifier);
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
        (result, [key, val]) => ({
          ...result,
          [key]: filter(val, [...path, key]),
        }),
        {} as Record<string, unknown>
      );
    }

    return value;
  }

  return filter(model, initialPath) as M;
}

/**
 * Removes annotations associated with a specific process.
 */
export function prune<M extends Objectish>(
  model: M,
  registry: Registry,
  process: Process
): [M, Registry] {
  const newRegistry = new Map<string, Annotation<any>>();

  // Copy over annotations that don't belong to this process
  for (const [key, annotation] of registry.entries()) {
    const filteredTasks = annotation.tasks.filter((task) => task.process !== process);
    if (filteredTasks.length > 0) {
      newRegistry.set(key, Annotation.prune(filteredTasks));
    }
  }

  return [model, newRegistry];
}
