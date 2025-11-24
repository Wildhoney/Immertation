import type { Objectish } from 'immer';
import type { Annotation, Config } from './utils';

export type Model = Objectish;

export type Property = undefined | null | string | number;

type ExtractObjects<T> = T extends (infer U)[]
  ? T | ExtractObjects<U>
  : T extends object
    ? T | ExtractObjects<T[keyof T]>
    : never;

export type Identity<M extends Model> = (snapshot: ExtractObjects<M[keyof M]>) => M;

export type Recipe<M extends Model> = (draft: M) => void;

export type Nothing = typeof Config.nothing;

export type Process = symbol;

export enum Op {
  Add = 1,
  Remove = 2,
  Update = 4,
  Move = 8,
  Replace = 16,
  Sort = 32,
}

export type Id = string;

export type Registry<M extends Model> = Map<Id, Annotation<M>[]>;

export type Path = (string | number)[];
