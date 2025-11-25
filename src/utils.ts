import { enablePatches, Immer, type Patch } from 'immer';
import {
  Annotation,
  type Identity,
  type Inspect,
  type Model,
  type Operation,
  type Path,
  type Process,
  type Property,
  type Registry,
  type Snapshot,
} from './types';
import { A, G } from '@mobily/ts-belt';
import { get } from 'lodash';

/** Shared Immer instance with patches enabled */
export class Config {
  static immer = (() => {
    enablePatches();
    return new Immer();
  })();
}

/**
 * Checks if a value is a primitive type.
 * @param {unknown} value - Value to check
 * @returns {boolean} True if primitive
 */
export function primitive(value: unknown): value is string | number | boolean | bigint | symbol | null | undefined {
  return (
    G.isNullable(value) ||
    G.isString(value) ||
    G.isNumber(value) ||
    G.isBoolean(value) ||
    typeof value === 'symbol' ||
    typeof value === 'bigint'
  );
}

/**
 * Creates a proxy for inspecting pending annotations at any path.
 * @param {M} model - The model to inspect
 * @param {Registry<M>} registry - The annotation registry
 * @param {Identity<M>} identity - Identity function for lookups
 * @returns {Inspect<M>} Proxy with pending() and is() methods
 */
export function inspect<M extends Model>(model: M, registry: Registry<M>, identity: Identity<M>): Inspect<M> {
  /**
   * Retrieves annotations for a given path from both object and property levels.
   * @param {string[]} path - The path segments to the target value
   */
  function annotations(path: string[]) {
    const key = path.at(-1);
    const target = get(model, path);
    const parent = get(model, path.slice(0, -1));

    const object = G.isObject(target)
      ? (registry.get(identity(target))?.filter((annotation) => G.isNullable(annotation.property)) ?? [])
      : [];
    const property = G.isObject(parent)
      ? (registry.get(identity(parent))?.filter((annotation) => annotation.property === key) ?? [])
      : [];

    return [...object, ...property];
  }

  function proxy(path: string[]): Inspect<M> {
    return <Inspect<M>>(<unknown>new Proxy(() => {}, {
      get(_, property) {
        if (property === 'pending') return () => !A.isEmpty(annotations(path));
        if (property === 'is')
          return (operation: Operation) =>
            annotations(path).some((annotation) => (annotation.operation & operation) !== 0);
        if (property === 'draft') return () => A.last(annotations(path))?.value ?? get(model, path);
        return proxy([...path, String(property)]);
      },
    }));
  }

  return proxy([]);
}

/**
 * Reconciles patch values by unwrapping annotations and registering them.
 * @param {Patch} patch - The Immer patch to reconcile
 * @param {M} snapshot - Current model snapshot
 * @param {Process} process - The process symbol
 * @param {Registry<M>} registry - The annotation registry
 * @param {Identity<M>} identity - Identity function
 * @returns {M} The reconciled value
 */
export function reconcile<M extends Model>(
  patch: Patch,
  snapshot: M,
  process: Process,
  registry: Registry<M>,
  identity: Identity<M>,
): M {
  function discover(model: M, path: Path = patch.path): M {
    if (model instanceof Annotation) {
      const value = <M | undefined>get(snapshot, path.join('.'));

      Object.entries(model)
        .filter(([key, value]) => !Annotation.keys.has(key) && value instanceof Annotation)
        .forEach(([key, value]) => discover(<M>value, path.concat(key)));

      if (primitive(model.value)) {
        const context = get(snapshot, path.slice(0, -1).join('.'));
        register(context, model, path.at(-1), process, registry, identity);
        return value ?? <M>(<unknown>model.value);
      }

      register(value ?? model.value, model, null, process, registry, identity);
      return G.isNullable(value) ? discover(model.value, path) : (discover(model.value, path), <M>value);
    }

    if (G.isArray(model)) {
      return <M>model.map((item, index) => discover(item, path.concat(index)));
    }

    if (G.isObject(model)) {
      return <M>(
        Object.fromEntries(Object.entries(model).map(([key, value]) => [key, discover(value, path.concat(key))]))
      );
    }

    return model;
  }

  return discover(patch.value);
}

/**
 * Registers an annotation in the registry.
 * @param {M} model - The model value to register against
 * @param {Annotation<M>} annotation - The annotation to register
 * @param {Property} property - The property key (null for object-level)
 * @param {Process} process - The process symbol
 * @param {Registry<Model>} registry - The registry map
 * @param {Identity<M>} identity - Identity function for ID generation
 */
function register<M extends Model>(
  model: M,
  annotation: Annotation<M>,
  property: Property,
  process: Process,
  registry: Registry<Model>,
  identity: Identity<M>,
): void {
  const id = identity(<Snapshot<M>>model);
  const annotations = registry.get(id) ?? [];
  registry.set(id, [annotation.assign(property, process), ...annotations]);
}
