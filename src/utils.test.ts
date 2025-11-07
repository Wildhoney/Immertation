import { describe, expect, it } from 'vitest';
import { state } from './utils';
import { Operation, State, Annotation } from './types';

describe('state()', () => {
  it.each([
    ['Add', Operation.Add, State.Add],
    ['Remove', Operation.Remove, State.Remove],
    ['Update', Operation.Update, State.Update],
    ['Move', Operation.Move, State.Move],
    ['Replace', Operation.Replace, State.Replace],
    ['Sort', Operation.Sort, State.Sort],
  ])('maps Operation.%s to State.%s', (_, operation, expected) => {
    expect(state(operation)).toBe(expected);
  });
});

describe('Annotation', () => {
  const process = Symbol('process');

  describe('empty()', () => {
    it('creates an annotation with no tasks', () => {
      const annotation = Annotation.empty<string>();
      expect(annotation.tasks).toEqual([]);
    });
  });

  describe('create()', () => {
    it('creates an annotation with a single task', () => {
      const annotation = Annotation.create('test-value', [State.Update], process);
      expect(annotation.tasks.length).toBe(1);
      expect(annotation.tasks[0].value).toBe('test-value');
      expect(annotation.tasks[0].operations).toEqual([State.Update]);
      expect(annotation.tasks[0].process).toBe(process);
    });

    it('creates an annotation with multiple operations', () => {
      const annotation = Annotation.create('test', [State.Update, State.Replace], process);
      expect(annotation.tasks[0].operations).toEqual([State.Update, State.Replace]);
    });
  });

  describe('merge()', () => {
    it('merges two annotations by concatenating tasks', () => {
      const process1 = Symbol('process1');
      const process2 = Symbol('process2');

      const annotation1 = Annotation.create('value1', [State.Add], process1);
      const annotation2 = Annotation.create('value2', [State.Update], process2);

      const merged = Annotation.merge(annotation1, annotation2);

      expect(merged.tasks.length).toBe(2);
      expect(merged.tasks[0].value).toBe('value1');
      expect(merged.tasks[0].process).toBe(process1);
      expect(merged.tasks[1].value).toBe('value2');
      expect(merged.tasks[1].process).toBe(process2);
    });

    it('merges annotations with multiple tasks each', () => {
      const annotation1 = Annotation.create('v1', [State.Add], process);
      annotation1.tasks.push({ value: 'v2', operations: [State.Update], process });

      const annotation2 = Annotation.create('v3', [State.Replace], process);

      const merged = Annotation.merge(annotation1, annotation2);

      expect(merged.tasks.length).toBe(3);
      expect(merged.tasks.map((t) => t.value)).toEqual(['v1', 'v2', 'v3']);
    });
  });

  describe('restore()', () => {
    it('restores an annotation from a set of tasks', () => {
      const tasks = [
        { value: 'value1', operations: [State.Add], process },
        { value: 'value2', operations: [State.Update], process },
      ];

      const annotation = Annotation.restore(tasks);

      expect(annotation.tasks).toEqual(tasks);
      expect(annotation.tasks.length).toBe(2);
    });

    it('restores an empty annotation from empty tasks', () => {
      const annotation = Annotation.restore<string>([]);
      expect(annotation.tasks).toEqual([]);
    });
  });

  describe('value getter', () => {
    it('returns the value from the last task', () => {
      const annotation = Annotation.create('value1', [State.Add], process);
      annotation.tasks.push({ value: 'value2', operations: [State.Update], process });

      expect(annotation.value).toBe('value2');
    });

    it('returns undefined for empty annotation', () => {
      const annotation = Annotation.empty<string>();
      expect(annotation.value).toBeUndefined();
    });

    it('returns the only value for single task annotation', () => {
      const annotation = Annotation.create('only-value', [State.Add], process);
      expect(annotation.value).toBe('only-value');
    });
  });
});
