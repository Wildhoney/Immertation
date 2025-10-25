import { immerable } from 'immer';

export type Recipe<M> = (draft: M) => void;

export type Process = symbol;

export enum State {
  Add,
  Remove,
  Update,
  Move,
  Replace,
  Sort,
}

export type AnnotationRecord<T> = {
  value: T;
  operations: State[];
  process: Process;
};

export class Node<T = unknown> {
  [immerable] = true;

  constructor(
    public value: T,
    public annotation: Annotation<T> | null = null
  ) {}
}

export class Annotation<T> {
  public records: AnnotationRecord<T>[];

  constructor(
    public value: T,
    public operations: State[],
    process: Process
  ) {
    this.records = [{ value, operations, process }];
  }
}

export class Operation {
  static Add<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Add], process) as unknown as T;
  }

  static Remove<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Remove], process) as unknown as T;
  }

  static Update<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Update], process) as unknown as T;
  }

  static Move<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Move], process) as unknown as T;
  }

  static Replace<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Update, State.Replace], process) as unknown as T;
  }

  static Sort<T>(value: T, process: Process): T {
    return new Annotation(value, [State.Sort], process) as unknown as T;
  }
}

type IsPrimitive<T> = T extends string | number | boolean | null | undefined | symbol | bigint
  ? true
  : false;

export interface AnnotationProxy {
  is(operation: unknown): boolean;
}

export type WithAnnotations<T> =
  IsPrimitive<T> extends true
    ? AnnotationProxy
    : T extends (infer U)[]
      ? AnnotationProxy & {
          [K in keyof T]: WithAnnotations<U>;
        }
      : T extends object
        ? AnnotationProxy & {
            [K in keyof T]: WithAnnotations<T[K]>;
          }
        : AnnotationProxy;
