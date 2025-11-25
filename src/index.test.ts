import { faker } from '@faker-js/faker';
import { Op, State, type Id, type Snapshot } from '.';
import { describe, expect, it } from 'vitest';

/**
 * Tests for the State class which manages model mutations with annotations.
 * Annotations allow marking changes as "pending" operations while preserving
 * the original state until explicitly committed.
 */
describe('State', () => {
  type Model = {
    name: {
      id: string;
      first: string;
      last: string;
    };
    age: number;
    locations: { id: string; name: string }[];
  };

  const model = {
    name: {
      id: State.pk(),
      first: faker.person.firstName(),
      last: faker.person.lastName(),
    },
    age: faker.number.int({ min: 1, max: 100 }),
    locations: Array.from({ length: 3 }, () => ({
      id: State.pk(),
      name: faker.location.city(),
    })),
  } satisfies Model;

  function identity(snapshot: Snapshot<Model>): Id {
    if (Array.isArray(snapshot)) return snapshot.map((item) => item.id).join(',');
    if ('id' in snapshot) return snapshot.id;
    return JSON.stringify(snapshot);
  }

  /**
   * Tests for the mutate() method which applies changes to the model.
   * Regular mutations update the model directly, while annotated mutations
   * preserve the original value and mark the change as pending.
   */
  describe('mutate()', () => {
    /**
     * Verifies that regular mutations update values directly without pending state,
     * while annotated mutations preserve originals and support nested annotations.
     * Also confirms that annotations survive object spreading when identity is preserved.
     */
    it('updates name + age', () => {
      const state = new State<Model>(model, identity);

      state.mutate((draft) => {
        draft.name.first = model.name.first + '!';
        draft.age += 1;
      });
      expect(state.model.name.first).toBe(model.name.first + '!');
      expect(state.model.age).toBe(model.age + 1);
      expect(state.inspect.name.first.pending()).toBe(false);
      expect(state.inspect.age.pending()).toBe(false);

      {
        const name = faker.person.firstName();
        state.mutate((draft) => {
          draft.name = State.annotate(Op.Update, {
            id: draft.name.id,
            first: 'A',
            last: State.annotate(Op.Update, 'T'),
          });
          draft.name.first = State.annotate(Op.Update, name);
          draft.age += 1;
        });

        expect(state.model.name.first).toBe(model.name.first + '!');
        expect(state.model.age).toBe(model.age + 2);
        expect(state.inspect.name.pending()).toBe(true);
        expect(state.inspect.name.first.pending()).toBe(true);
        expect(state.inspect.name.first.draft()).toBe(name);
        expect(state.inspect.name.last.pending()).toBe(true);
        expect(state.inspect.name.last.draft()).toBe('T');
        expect(state.inspect.age.pending()).toBe(false);
        expect(state.inspect.age.draft()).toBe(model.age + 2);
      }

      {
        const last = faker.person.lastName();
        state.mutate((draft) => {
          draft.name = { ...draft.name, last };
        });

        expect(state.inspect.name.first.pending()).toBe(true);
        expect(state.model.name.last).toBe(last);
        expect(state.model.name.first).toBe(model.name.first + '!');
      }
    });

    /**
     * Verifies that annotated updates on array items preserve original values,
     * and that annotations track correctly even after array mutations like sort.
     * New items added with Op.Add are marked as pending.
     */
    it('updates locations', () => {
      const state = new State<Model>(model, identity);
      const id = model.locations[1].id;

      {
        const city = faker.location.city();
        state.mutate((draft) => {
          const index = draft.locations.findIndex((location) => location.id === id);
          draft.locations[index].name = State.annotate(Op.Update, city);
        });
        expect(state.model.locations[1].name).toBe(model.locations[1].name);
        expect(state.inspect.locations[1].name.pending()).toBe(true);
        expect(state.inspect.locations[1].name.draft()).toBe(city);
      }

      const city = faker.location.city();
      state.mutate((draft) => {
        draft.locations.sort();
        draft.locations.push(State.annotate(Op.Add, { id: State.pk(), name: city }));
      });

      const index = state.model.locations.findIndex((location) => location.id === id);
      expect(state.model.locations[index].name).toBe(model.locations[1].name);
      expect(state.inspect.locations[index].name.pending()).toBe(true);

      expect(state.model.locations[3].name).toBe(city);
      expect(state.inspect.locations[3].pending()).toBe(true);
    });

    /**
     * Verifies that annotations persist when the entire array is replaced,
     * as long as the annotated item maintains its identity (same id).
     */
    it('replaces locations', () => {
      const state = new State<Model>(model, identity);
      const id = model.locations[0].id;

      state.mutate((draft) => {
        draft.locations[0].name = State.annotate(Op.Update, 'Pending City');
      });
      expect(state.inspect.locations[0].name.pending()).toBe(true);

      state.mutate((draft) => {
        const kept = draft.locations[0];
        draft.locations = [
          kept,
          { id: State.pk(), name: faker.location.city() },
          { id: State.pk(), name: faker.location.city() },
        ];
      });

      const index = state.model.locations.findIndex((location) => location.id === id);
      expect(index).toBe(0);
      expect(state.inspect.locations[0].name.pending()).toBe(true);
    });

    /**
     * Verifies Op.Add marks new items as pending, Op.Remove marks existing items
     * for removal while keeping them in the model, and splice() physically removes
     * items from the array without annotation.
     */
    it('adds + removes locations', () => {
      const state = new State<Model>(model, identity);

      const city = faker.location.city();
      state.mutate((draft) => {
        draft.locations.push(State.annotate(Op.Add, { id: State.pk(), name: city }));
      });
      expect(state.model.locations.length).toBe(4);
      expect(state.model.locations[3].name).toBe(city);
      expect(state.inspect.locations[3].pending()).toBe(true);

      {
        const id = model.locations[1].id;
        state.mutate((draft) => {
          const index = draft.locations.findIndex((location) => location.id === id);
          draft.locations[index] = State.annotate(Op.Remove, draft.locations[index]);
        });
        expect(state.model.locations.length).toBe(4);
        expect(state.model.locations.find((location) => location.id === id)).toBeDefined();
        expect(state.inspect.locations[1].pending()).toBe(true);
      }

      {
        const id = model.locations[0].id;
        state.mutate((draft) => {
          const index = draft.locations.findIndex((location) => location.id === id);
          draft.locations.splice(index, 1);
        });
        expect(state.model.locations.length).toBe(3);
        expect(state.model.locations.find((location) => location.id === id)).toBeUndefined();
      }
    });

    /**
     * Verifies that combined operation bitmasks work correctly with is(),
     * allowing multiple operations to be checked simultaneously.
     */
    it('supports combined operations bitmask', () => {
      const state = new State<Model>(model, identity);

      state.mutate((draft) => {
        draft.name.first = State.annotate(Op.Update | Op.Replace, 'Combined');
      });

      expect(state.inspect.name.first.pending()).toBe(true);
      expect(state.inspect.name.first.is(Op.Update)).toBe(true);
      expect(state.inspect.name.first.is(Op.Replace)).toBe(true);
      expect(state.inspect.name.first.is(Op.Add)).toBe(false);
      expect(state.inspect.name.first.is(Op.Remove)).toBe(false);
    });
  });

  /**
   * Tests for the prune() method which removes annotations by process symbol.
   * Each mutate() call returns a unique process symbol that can be used to
   * clean up annotations after async operations complete.
   */
  describe('prune()', () => {
    /**
     * Verifies that prune() removes all annotations associated with a specific
     * process symbol, returning the inspect state to non-pending.
     */
    it('removes annotations by process', () => {
      const state = new State<Model>(model, identity);

      const process = state.mutate((draft) => {
        draft.name.first = State.annotate(Op.Update, 'Pending');
      });
      expect(state.inspect.name.first.pending()).toBe(true);
      expect(state.inspect.name.first.draft()).toBe('Pending');

      state.prune(process);
      expect(state.inspect.name.first.pending()).toBe(false);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });
  });

  /**
   * Tests for Greek letter shorthand aliases.
   */
  describe('aliases', () => {
    /** Verifies that κ is an alias for pk. */
    it('κ generates unique ids like pk', () => {
      const id = State.κ();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    /** Verifies that δ is an alias for annotate. */
    it('δ annotates values like annotate', () => {
      const state = new State<Model>(model, identity);

      state.mutate((draft) => {
        draft.name.first = State.δ(Op.Update, 'Pending');
      });

      expect(state.inspect.name.first.pending()).toBe(true);
    });
  });
});
