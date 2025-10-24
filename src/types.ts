import type { Draft } from "./utils";

export type Recipe<M> = (draft: M) => void;

export type Operation<T> = {
  operation:  number | Draft<T>;
  process: Process;
};

export type Process = symbol;