import { faker } from '@faker-js/faker';
import { Operation, State } from '.';
import { describe, expect, it, vi } from 'vitest';

describe('mutate()', () => {
  const process = Symbol('process');

  describe('primitives', () => {
    type Model = {
      name: string;
      age: number;
    };

    it('updates', () => {
      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };

      {
        const state = new State<Model>(initial);
        const name = faker.person.firstName() + '!';
        state.mutate((draft) => void (draft.name = name));
        expect(state.model.name).toEqual(name);
      }

      {
        const state = new State<Model>(initial);
        const name = faker.person.firstName() + '?';
        state.mutate((draft) => {
          draft.name = Operation.Update(name, process);
        });
        expect(state.model.name).toEqual(name);
        expect(state.inspect.name.pending()).toBe(true);
        expect(state.inspect.name.draft()).toEqual(name);
      }
    });
  });

  describe('arrays', () => {
    type Model = {
      friends: string[];
    };

    it('updates', () => {
      const initial = {
        friends: [
          'A' + faker.person.firstName(),
          'B' + faker.person.firstName(),
          'C' + faker.person.firstName(),
        ],
      };
      const sorted = [...initial.friends].sort();

      {
        const state = new State<Model>(initial);
        const name = faker.person.firstName() + '!';

        state.mutate((draft) => {
          draft.friends.sort();
          draft.friends[1] = Operation.Update(name, process);
        });

        const expected = [...sorted];
        expected[1] = name;
        expect(state.model.friends).toEqual(expected);
        expect(state.model.friends[1]).toEqual(name);

        expect(state.inspect.friends[1].pending()).toBe(true);
        expect(state.inspect.friends[1].is(Operation.Update)).toBe(true);
        expect(state.inspect.friends[1].draft()).toEqual(name);

        expect(state.inspect.friends[0].pending()).toBe(false);
        expect(state.inspect.friends[2].pending()).toBe(false);
      }
    });
  });
});

describe('prune()', () => {
  type Model = {
    name: string;
    age: number;
  };

  /**
   * Tests that calling prune() with a specific process symbol removes only
   * the annotations associated with that process, leaving others intact.
   */
  it('prunes tasks by process', () => {
    faker.seed(9);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const processes = [Symbol('process1'), Symbol('process2')] as const;

    const newName = faker.person.firstName();
    state.mutate((draft) => void (draft.name = Operation.Update(newName, processes[0])));

    const newAge = faker.number.int(100);
    state.mutate((draft) => void (draft.age = Operation.Update(newAge, processes[1])));

    // Before pruning: model has new values, both properties have annotations
    expect(state.model.name).toEqual(newName);
    expect(state.model.age).toEqual(newAge);
    expect(state.inspect.name.pending()).toBe(true);
    expect(state.inspect.age.pending()).toBe(true);

    // Prune process1: removes name annotation, model unchanged
    state.prune(processes[0]);

    expect(state.model.name).toEqual(newName); // Unchanged
    expect(state.model.age).toEqual(newAge); // Unchanged

    expect(state.inspect.name.pending()).toBe(false); // Annotation removed
    expect(state.inspect.name.is(Operation.Update)).toBe(false);

    expect(state.inspect.age.pending()).toBe(true); // Still has annotation
    expect(state.inspect.age.is(Operation.Update)).toBe(true);
    expect(state.inspect.age.draft()).toEqual(newAge);
  });
});

describe('listen()', () => {
  type Model = {
    name: string;
    age: number;
  };

  /**
   * Tests that a registered listener is called when mutate() updates the model
   * and receives the correct State instance with the updated model.
   */
  it('invokes listener on mutate', () => {
    faker.seed(20);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const name = faker.person.firstName();

    expect.assertions(1);

    state.listen((state) => {
      expect(state.model.name).toBe(name);
    });

    state.mutate((draft) => void (draft.name = name));
  });

  /**
   * Tests that a registered listener is called when prune() removes annotations
   * and receives the correct State instance.
   */
  it('invokes listener on prune', () => {
    faker.seed(21);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const process = Symbol('process');
    const name = faker.person.firstName();

    expect.assertions(2);

    state.mutate((draft) => void (draft.name = Operation.Update(name, process)));

    state.listen((state) => {
      expect(state.model.name).toBe(name);
      expect(state.inspect.name.pending()).toBe(false);
    });

    state.prune(process);
  });

  /**
   * Tests that multiple listeners can be registered and all are invoked
   * when the state changes.
   */
  it('supports multiple listeners', () => {
    faker.seed(22);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    state.listen(listener1);
    state.listen(listener2);
    state.listen(listener3);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    state.mutate((draft) => void (draft.age = faker.number.int(100)));

    expect(listener1).toHaveBeenCalledTimes(2);
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);
  });

  /**
   * Tests that the unsubscribe function returned by listen() correctly
   * removes the listener so it no longer receives updates.
   */
  it('unsubscribe removes listener', () => {
    faker.seed(23);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener = vi.fn();

    const unsubscribe = state.listen(listener);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  /**
   * Tests that unsubscribing one listener doesn't affect other listeners.
   */
  it('unsubscribing one listener does not affect others', () => {
    faker.seed(24);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsubscribe1 = state.listen(listener1);
    state.listen(listener2);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);

    unsubscribe1();

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener1).toHaveBeenCalledTimes(1); // Not called again
    expect(listener2).toHaveBeenCalledTimes(2); // Still called
  });

  /**
   * Tests that listeners can access both model and inspect proxy
   * through the received State instance.
   */
  it('listener can access model and inspect', () => {
    faker.seed(25);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const process = Symbol('process');
    const name = faker.person.firstName();

    expect.assertions(2);

    state.listen((state) => {
      expect(state.model.name).toBe(name);
      expect(state.inspect.name.pending()).toBe(true);
    });

    state.mutate((draft) => void (draft.name = Operation.Update(name, process)));
  });
});
