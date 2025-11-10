import { describe, expect, it } from 'vitest';
import { event } from './utils';
import { Operation, Event, Annotation } from './types';

describe('event()', () => {
  it.each([
    ['Add', Operation.Add, Event.Add],
    ['Remove', Operation.Remove, Event.Remove],
    ['Update', Operation.Update, Event.Update],
    ['Move', Operation.Move, Event.Move],
    ['Replace', Operation.Replace, Event.Replace],
    ['Sort', Operation.Sort, Event.Sort],
  ])('maps Operation.%s to Event.%s', (_, operation, expected) => {
    expect(event(operation)).toBe(expected);
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
      const annotation = Annotation.create('test-value', [Event.Update], process);
      expect(annotation.tasks.length).toBe(1);
      expect(annotation.tasks[0].state).toBe('test-value');
      expect(annotation.tasks[0].operations).toEqual([Event.Update]);
      expect(annotation.tasks[0].process).toBe(process);
    });

    it('creates an annotation with multiple operations', () => {
      const annotation = Annotation.create('test', [Event.Update, Event.Replace], process);
      expect(annotation.tasks[0].operations).toEqual([Event.Update, Event.Replace]);
    });
  });

  describe('merge()', () => {
    it('merges two annotations by concatenating tasks', () => {
      const process1 = Symbol('process1');
      const process2 = Symbol('process2');

      const annotation1 = Annotation.create('value1', [Event.Add], process1);
      const annotation2 = Annotation.create('value2', [Event.Update], process2);

      const merged = Annotation.merge(annotation1, annotation2);

      expect(merged.tasks.length).toBe(2);
      expect(merged.tasks[0].state).toBe('value1');
      expect(merged.tasks[0].process).toBe(process1);
      expect(merged.tasks[1].state).toBe('value2');
      expect(merged.tasks[1].process).toBe(process2);
    });

    it('merges annotations with multiple tasks each', () => {
      const annotation1 = Annotation.create('v1', [Event.Add], process);
      annotation1.tasks.push({ state: 'v2', operations: [Event.Update], process });

      const annotation2 = Annotation.create('v3', [Event.Replace], process);

      const merged = Annotation.merge(annotation1, annotation2);

      expect(merged.tasks.length).toBe(3);
      expect(merged.tasks.map((t) => t.state)).toEqual(['v1', 'v2', 'v3']);
    });
  });

  describe('restore()', () => {
    it('restores an annotation from a set of tasks', () => {
      const tasks = [
        { state: 'value1', operations: [Event.Add], process },
        { state: 'value2', operations: [Event.Update], process },
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

  describe('state()', () => {
    it('returns the value from the last task', () => {
      const annotation = Annotation.create('value1', [Event.Add], process);
      annotation.tasks.push({ state: 'value2', operations: [Event.Update], process });

      expect(annotation.state()).toBe('value2');
    });

    it('returns undefined for empty annotation', () => {
      const annotation = Annotation.empty<string>();
      expect(annotation.state()).toBeUndefined();
    });

    it('returns the only value for single task annotation', () => {
      const annotation = Annotation.create('only-value', [Event.Add], process);
      expect(annotation.state()).toBe('only-value');
    });
  });
});
