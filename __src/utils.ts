import { G, A } from '@mobily/ts-belt';
import { cloneDeep, get } from 'lodash';
import {
  type Process,
  type Identity,
  type Recipe,
  type Registry,
  type Model,
  type Id,
  type Path,
  type Object,
  type Array,
  type Property,
  type SymbolObject,
  type PropertyObject,
  type Inspectable,
  Config,
  Annotation,
  Op,
} from './types';

/**
 * Inspector method names used to check for and define inspection methods.
 */
const Inspectors = {
  Pending: 'pending',
  Remaining: 'remaining',
  Is: 'is',
  Draft: 'draft',
  Box: 'box',
} as const;

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
export function reconcile<M extends Model, T = unknown>(
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
export function prune<M extends Model>(model: M, registry: Registry, process: Process): [M, Registry] {
  for (const [id, annotation] of registry.entries()) {
    const pruned = annotation.prune(process);
    if (G.isNull(pruned)) registry.delete(id);
    else if (pruned.tasks.length !== annotation.tasks.length) registry.set(id, pruned);
  }

  return [model, registry];
}

/**
 * Creates an extraction function that processes draft values and extracts Annotations into the registry.
 *
 * The returned extract function recursively traverses the draft, replacing Annotation instances with
 * their corresponding values from the original model. Extracted annotations are stored in the registry
 * with computed identifiers based on the value's path or identity.
 *
 * @template M - The model type
 * @template T - The union of all Model types from the model
 * @param registry - Map to store extracted annotations by their identifiers
 * @param process - Unique symbol identifying this mutation process
 * @param model - The original model state before mutations
 * @param identity - Function that returns unique identifiers for values
 * @returns An extract function that processes draft values and returns reconciled values
 */
function extraction<M, T = unknown>(registry: Registry, process: Process, model: M, identity: Identity<T>) {
  return function extract<V, C = M>(value: V, chunk: C, path: Path, context: null | V = null): V {
    if (!annotated(value)) {
      const annotation = <Annotation<unknown>>value;
      const property = path[path.length - 1];
      const parent = path.slice(0, -1);

      const draft = G.isNull(context) ? (A.isNotEmpty(parent) ? get(chunk, parent.join('.')) : chunk) : context;
      const original = A.isNotEmpty(parent) ? get(model, parent.join('.')) : model;

      const id: Id =
        G.isObject(draft) || G.isArray(draft)
          ? `${identify(<T>draft, identity)}.${property}`
          : identify(<T>draft, identity);

      const existing = registry.get(id);
      const current = Annotation.assign(annotation, process);
      registry.set(id, existing ? Annotation.merge(existing, current) : current);

      const adding = current.tasks.some((task) => task.state.includes(Op.Add));
      if (adding) return <V>current.tasks[0].value;

      if (G.isObject(draft) && G.isObject(original)) {
        const draftId = identify(draft, identity);
        const grandparent = A.isNotEmpty(parent.slice(0, -1)) ? get(model, parent.slice(0, -1).join('.')) : model;

        if (G.isArray(grandparent)) {
          const found = grandparent.find((item: T) => identity(item) === draftId);
          if (G.isNotNullable(found) && G.isObject(found)) return <V>(<Object>found)[property];
        } else return <V>(<Object>original)[property];
      }

      return <V>get(model, path.join('.'));
    }

    if (G.isArray(value)) return <V>value.map((element, index) => extract(element, chunk, [...path, index], value));

    if (G.isObject(value)) {
      const reducer = (object: Object, [id, element]: [string, unknown]) => ({
        ...object,
        [id]: extract(element, chunk, [...path, id], value),
      });
      return <V>Object.entries(value).reduce(reducer, <Object>{});
    }

    return value;
  };
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
    const reducer = (object: Object, [id, item]: [string, T]) => (annotated(item) ? { ...object, [id]: item } : object);
    return identity(<T>Object.entries(value).reduce(reducer, <Object>{}));
  }

  return identity(<T>value);
}

/**
 * Creates an inspectable proxy wrapper around the model that provides annotation query methods.
 *
 * Returns a proxy that wraps the entire model tree, adding inspector methods (pending, remaining, is, draft, box)
 * to every property at every level. The proxy maintains the same structure as the original model while
 * providing real-time access to annotation state and draft values for each property.
 *
 * @template M - The model type (must be an object or array)
 * @template T - The union of all Model types from the model
 * @param model - The model to inspect
 * @param registry - The annotation registry containing pending operations
 * @param identity - Function that returns unique identifiers for values
 * @returns A proxy that provides inspector methods for all model properties
 *
 * @example
 * ```typescript
 * const state = { count: 5 };
 * const registry = new Map();
 * const inspectable = inspect(state, registry, (v) => JSON.stringify(v));
 *
 * // Access inspector methods on any property
 * inspectable.count.pending(); // false
 * inspectable.count.draft(); // 5
 * ```
 */
export function inspect<M extends Model, T = unknown>(
  model: M,
  registry: Registry,
  identity: Identity<T>,
): Inspectable<M> {
  /**
   * Filters an array to exclude elements with pending Add operations.
   *
   * Iterates through array elements and builds a "present" array by excluding
   * any items that have an Op.Add annotation, which indicates they are draft
   * additions not yet committed. This ensures identity computation is based
   * on the committed state rather than draft state.
   *
   * @param array - The array to filter
   * @returns An array containing only elements without pending Add operations
   */
  function read(array: Array): Array {
    return array.reduce<Array>((result, item) => {
      const id = `${identify(<T>result, identity)}.${result.length}`;
      const annotation = registry.get(id);
      const adding = annotation?.tasks.some((task) => task.state.includes(Op.Add));
      if (G.isNullable(annotation) || !adding) return [...result, item];
      return result;
    }, []);
  }

  /**
   * Creates inspector methods for a property to query its annotation state.
   *
   * Computes the identity-based ID for the property, retrieves any associated
   * annotation from the registry, and returns an object with methods to check
   * pending operations, remaining tasks, operation types, draft values, and
   * boxed values for component props.
   *
   * @template V - The type of the value
   * @param value - The current value of the property
   * @param path - The path to the parent value in the model
   * @param property - The property key (string) or array index (number)
   * @returns An object containing inspector methods (pending, remaining, is, draft, box)
   */
  function methods<V>(value: V, path: Path, property: Exclude<Property, null>): Object {
    const joined = A.isNotEmpty(path) ? path.join('.') : undefined;
    const parent = joined ? get(model, joined) : model;

    const id: Id = (() => {
      if (G.isArray(parent)) return `${identify(<T>read(<Array>parent), identity)}.${property}`;
      if (G.isObject(parent)) return `${identify(<T>parent, identity)}.${property}`;
      return `${joined}.${property}`;
    })();

    const annotation = registry.get(id);

    const methods = {
      /**
       * Checks if this property has any pending annotation tasks.
       *
       * @returns True if an annotation exists for this property, false otherwise
       */
      [Inspectors.Pending]() {
        return Boolean(annotation);
      },
      /**
       * Returns the number of annotation tasks remaining for this property.
       *
       * @returns The count of tasks in the annotation, or 0 if no annotation exists
       */
      [Inspectors.Remaining]() {
        return G.isNullable(annotation) ? 0 : annotation.tasks.length;
      },
      /**
       * Checks if this property has a specific operation type in its annotation tasks.
       *
       * @param op - The operation type to check for (Op.Add, Op.Remove, etc.)
       * @returns True if any task includes the specified operation, false otherwise
       */
      [Inspectors.Is](op: Op) {
        return G.isNullable(annotation) ? false : annotation.tasks.some((task) => task.state.includes(op));
      },
      /**
       * Returns the draft value from the most recent annotation task, or the current value if no tasks exist.
       * For arrays and objects, filters the draft to show the draft state.
       *
       * @returns The draft value with pending operations applied
       */
      [Inspectors.Draft]() {
        const draft = G.isNotNullable(annotation) && A.isNotEmpty(annotation.tasks) ? annotation.tasks[0].value : value;
        return G.isArray(draft) || G.isObject(draft)
          ? transform(draft, registry, [...path, property], identity)
          : draft;
      },
      /**
       * Returns a boxed value containing both the raw value and its inspection methods.
       * Useful for passing values with their annotations to components.
       *
       * @returns An object with 'model' (the raw value) and 'inspect' (inspector methods)
       */
      [Inspectors.Box]() {
        return {
          model: value,
          inspect: G.isObject(value) || G.isArray(value) ? inspect(model, registry, identity) : methods,
        };
      },
    };

    return methods;
  }

  /**
   * Creates a proxy that wraps the model value with inspector methods at every level.
   *
   * The proxy intercepts property access to attach inspector methods (pending, remaining, is, draft, box)
   * to each property in the model tree. For objects and arrays, creates nested proxies that expose
   * both the inspector methods and allow recursive traversal of nested properties.
   *
   * @template V - The type of the value being wrapped
   * @param value - The value to wrap with a proxy
   * @param path - The current path in the model tree
   * @returns A proxy that provides inspector methods for the value and its nested properties
   */
  function proxy<V>(value: V, path: Path): Inspectable<V> {
    return <Inspectable<V>>new Proxy(
      {},
      {
        /**
         * Intercepts property access to attach inspector methods and handle nested properties.
         *
         * Returns symbol properties directly. For string properties, checks if it's an inspector
         * method name and returns undefined (as these don't exist on the model). For objects/arrays,
         * creates nested proxies. For primitives, returns the inspector methods object.
         *
         * @param _ - Unused proxy target
         * @param property - The property being accessed (string or symbol)
         * @returns The property value, inspector methods, or nested proxy
         */
        get(_, property: string | symbol) {
          if (typeof property === 'symbol') return (<SymbolObject>value)[property];

          const key = G.isArray(value) && !Number.isNaN(Number(property)) ? Number(property) : property;
          const element = (<PropertyObject>value)[property];
          const inspectors = methods(element, path, key);

          if ((Object.values(Inspectors) as readonly string[]).includes(property)) return undefined;

          if (G.isObject(element) || G.isArray(element)) {
            return <Inspectable<typeof element>>new Proxy(
              {},
              {
                /**
                 * Intercepts nested property access for objects and arrays.
                 *
                 * Returns symbol properties directly. Checks if the property is an inspector
                 * method and returns it. Otherwise, recursively creates a proxy for deeper nesting.
                 *
                 * @param __ - Unused proxy target
                 * @param property - The nested property being accessed
                 * @returns The inspector method, nested proxy, or property value
                 */
                get(__, property) {
                  if (typeof property === 'symbol')
                    return (<SymbolObject>element)[property];

                  if (property in inspectors)
                    return inspectors[<keyof typeof inspectors>property];

                  return (<PropertyObject>proxy(element, [...path, key]))[property];
                },
              },
            );
          }

          return inspectors;
        },
      },
    );
  }

  return proxy(model, []);
}

// ---------------------------------------------------------------------------------

/**
 * Filters the model to return a "present" state, excluding any draft additions.
 * Recursively traverses the model and removes any elements that have an `Op.Add`
 * annotation, effectively showing the state as if those additions were never made.
 * This is useful for displaying the committed state of the model without showing
 * pending changes.
 *
 * @template M - The model type.
 * @template T - The union of all Model types from the model.
 * @param {M} model - The model to filter.
 * @param {Registry} registry - The annotation registry.
 * @param {Identity<T>} identity - The function to get a unique identifier for a value.
 * @returns {M} The filtered model without draft additions.
 */
export function present<M extends Model, T = unknown>(model: M, registry: Registry, identity: Identity<T>): M {
  function filter(value: unknown, path: Path): unknown {
    if (G.isArray(value)) {
      const result: Array = [];
      const presentArray: Array = [];

      for (let index = 0; index < value.length; index++) {
        const item = value[index];
        const id = `${identify(<T>presentArray, identity)}.${presentArray.length}`;
        const annotation = registry.get(id);

        if (!annotation || !annotation.tasks.some((task) => task.state.includes(Op.Add))) {
          presentArray.push(item);
          result.push(filter(item, [...path, index]));
        }
      }

      return result;
    }

    if (G.isObject(value)) {
      const reducer = (object: Object, [id, item]: [string, unknown]) => ({
        ...object,
        [id]: filter(item, [...path, id]),
      });
      return Object.entries(value).reduce(reducer, <Object>{});
    }

    return value;
  }

  return <M>filter(model, []);
}

export function transform<M extends Model, T = unknown>(
  model: M,
  registry: Registry,
  initialPath: Path = [],
  identity: Identity<T>,
): M {
  function filter(value: unknown, path: Path): unknown {
    if (G.isArray(value)) {
      const filtered = value
        .map((item, index) => ({ item, index, originalIndex: index }))
        .filter(({ originalIndex }) => {
          const id = `${identify(<T>value, identity)}.${originalIndex}`;
          const annotation = registry.get(id);

          if (!annotation) return true;

          const hasRemove = annotation.tasks.some((task) => task.state.includes(Op.Remove));
          return !hasRemove;
        })
        .map(({ item, originalIndex }, newIndex) => {
          const id = `${identify(<T>value, identity)}.${originalIndex}`;
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
      const reducer = (object: Object, [id, item]: [string, unknown]) => ({
        ...object,
        [id]: filter(item, [...path, id]),
      });
      return Object.entries(value).reduce(reducer, <Object>{});
    }

    return value;
  }

  return <M>filter(model, initialPath);
}
