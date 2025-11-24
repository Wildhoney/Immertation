import { enablePatches, Immer, immerable, type Patch } from 'immer';
import type { Id, Model, Nothing, Op, Path, Process, Property, Registry } from './types';
import { G, O } from '@mobily/ts-belt';
import { get } from 'lodash';

export class Config {
  static nothing = Symbol('nothing');

  static immer = (() => {
    enablePatches();
    return new Immer();
  })();
}

export class Annotation<T> {
  [immerable] = true;

  public property: Property = null;
  public process: null | Process = null;

  constructor(
    public value: T,
    public operations: Op,
  ) {}

  assign(property: Property, process: Process): Annotation<T> {
    const annotation = new Annotation(this.value, this.operations);
    annotation.property = property;
    annotation.process = process;
    return annotation;
  }
}

function primitive(value: unknown): value is string | number | boolean | bigint | symbol | null | undefined {
  const t = typeof value;
  return (
    value === null ||
    t === 'undefined' ||
    t === 'string' ||
    t === 'number' ||
    t === 'boolean' ||
    t === 'symbol' ||
    t === 'bigint'
  );
}

function store<M extends Model>(
  id: Id,
  annotation: Annotation<M>,
  property: Property,
  process: Process,
  registry: Registry<Model>,
): void {
  const annotations = registry.get(id) ?? [];
  registry.set(id, [annotation.assign(property, process), ...annotations]);
}

function nothing(value: unknown): value is Nothing {
  return typeof value === 'symbol' && value === Config.nothing;
}

export function reconcile<M extends Model>(patch: Patch, snapshot: M, process: Process, registry: Registry<M>): M {
  function discover(model: M, path: Path = patch.path): M {
    if (model instanceof Annotation) {
      const present = <Nothing | M>get(snapshot, path.join('.')) ?? Config.nothing;

      if (primitive(model.value)) {
        store(path.slice(0, -1).join('.'), model, path.at(-1), process, registry);
        return <M>present;
      }

      store(path.join('.'), model, null, process, registry);
      return nothing(present) ? discover(model.value, path) : (discover(model.value, path), <M>present);
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
