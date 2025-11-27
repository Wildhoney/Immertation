import { faker } from '@faker-js/faker';
import { Op, State } from '.';
import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for the State class which manages model mutations with annotations.
 * Annotations allow marking changes as "pending" operations while preserving
 * the original state until explicitly committed.
 */
describe('State', () => {
  type Model = {
    name: {
      first: string;
      last: string;
    };
    age: number;
    locations: { name: string }[];
  };

  const model = {
    name: {
      first: faker.person.firstName(),
      last: faker.person.lastName(),
    },
    age: faker.number.int({ min: 1, max: 100 }),
    locations: Array.from({ length: 3 }, () => ({
      name: faker.location.city(),
    })),
  } satisfies Model;

  /**
   * Tests for the mutate() method which applies changes to the model.
   * Regular mutations update the model directly, while annotated mutations
   * preserve the original value and mark the change as pending.
   */
  describe('mutate()', () => {
    /**
     * Verifies that regular mutations update values directly without pending state,
     * while annotated mutations preserve originals and support nested annotations.
     * Spreading maintains identity, so annotations persist.
     */
    it('updates name + age', () => {
      const state = new State<Model>(model);

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
          draft.name = state.annotate(Op.Update, {
            ...draft.name,
            first: 'A',
            last: state.annotate(Op.Update, 'T'),
          });
          draft.name.first = state.annotate(Op.Update, name);
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

      {
        const last = faker.person.lastName();
        state.mutate((draft) => {
          draft.name = { first: draft.name.first, last };
        });

        expect(state.inspect.name.first.pending()).toBe(false);
        expect(state.model.name.last).toBe(last);
      }
    });

    /**
     * Verifies that annotated updates on array items preserve original values.
     * New items added with Op.Add are tracked via their assigned identity.
     */
    it('updates locations', () => {
      const state = new State<Model>(model);

      {
        const city = faker.location.city();
        state.mutate((draft) => {
          draft.locations[1].name = state.annotate(Op.Update, city);
        });
        expect(state.model.locations[1].name).toBe(model.locations[1].name);
        expect(state.inspect.locations[1].name.pending()).toBe(true);
        expect(state.inspect.locations[1].name.draft()).toBe(city);
      }

      const city = faker.location.city();
      state.mutate((draft) => {
        draft.locations.push(state.annotate(Op.Add, { name: city }));
      });

      expect(state.inspect.locations[1].name.pending()).toBe(true);
      expect(state.model.locations[3].name).toBe(city);
      expect(state.inspect.locations[3].pending()).toBe(true);
    });

    /**
     * Verifies that annotations are lost when objects are replaced without spreading,
     * since new objects receive new identities.
     */
    it('replaces locations (annotations lost)', () => {
      const state = new State<Model>(model);

      state.mutate((draft) => {
        draft.locations[0].name = state.annotate(Op.Update, 'Pending City');
      });
      expect(state.inspect.locations[0].name.pending()).toBe(true);

      state.mutate((draft) => {
        draft.locations = [{ name: faker.location.city() }, { name: faker.location.city() }];
      });

      expect(state.inspect.locations[0].name.pending()).toBe(false);
    });

    /**
     * Verifies that annotations persist when objects are spread, preserving identity.
     */
    it('replaces locations (annotations persist with spread)', () => {
      const state = new State<Model>(model);

      state.mutate((draft) => {
        draft.locations[0].name = state.annotate(Op.Update, 'Pending City');
      });
      expect(state.inspect.locations[0].name.pending()).toBe(true);

      state.mutate((draft) => {
        draft.locations = [{ ...draft.locations[0] }, { name: faker.location.city() }];
      });

      expect(state.inspect.locations[0].name.pending()).toBe(true);
    });

    /**
     * Verifies Op.Remove marks items for removal while keeping them in the model,
     * and splice() physically removes items from the array.
     */
    it('removes locations', () => {
      const state = new State<Model>(model);

      {
        state.mutate((draft) => {
          draft.locations[1] = state.annotate(Op.Remove, { ...draft.locations[1] });
        });
        expect(state.model.locations.length).toBe(3);
        expect(state.inspect.locations[1].pending()).toBe(true);
      }

      {
        state.mutate((draft) => {
          draft.locations.splice(0, 1);
        });
        expect(state.model.locations.length).toBe(2);
      }
    });

    /**
     * Verifies that combined operation bitmasks work correctly with is().
     */
    it('supports combined operations bitmask', () => {
      const state = new State<Model>(model);

      state.mutate((draft) => {
        draft.name.first = state.annotate(Op.Update | Op.Replace, 'Combined');
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
   */
  describe('prune()', () => {
    /**
     * Verifies that prune() removes all annotations associated with a process symbol.
     */
    it('removes annotations by process', () => {
      const state = new State<Model>(model);

      const process = state.mutate((draft) => {
        draft.name.first = state.annotate(Op.Update, 'Pending');
      });
      expect(state.inspect.name.first.pending()).toBe(true);
      expect(state.inspect.name.first.draft()).toBe('Pending');

      state.prune(process);
      expect(state.inspect.name.first.pending()).toBe(false);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });
  });

  /**
   * Tests for the settled() method which resolves when annotations are cleared.
   */
  describe('settled()', () => {
    /**
     * Verifies that settled() resolves with the model value once annotations are pruned.
     */
    it('resolves when there are no more annotations', async () => {
      const state = new State<Model>(model);
      const value = faker.person.firstName();

      const process = state.mutate((draft) => {
        draft.name.first = state.annotate(Op.Update, value);
      });

      const name = state.inspect.name.first.settled();
      expect(state.inspect.name.first.pending()).toBe(true);
      expect(state.model.name.first).toBe(model.name.first);

      state.mutate((draft) => void (draft.name.first = value));
      state.prune(process);

      expect(await name).toBe(value);
    });

    /**
     * Verifies that settled() resolves immediately if no annotations exist.
     */
    it('resolves immediately when no annotations', async () => {
      const state = new State<Model>(model);
      expect(await state.inspect.name.first.settled()).toBe(model.name.first);
    });

    /**
     * Verifies that settled() waits for all annotations to be pruned.
     */
    it('waits for all annotations to be pruned', async () => {
      const state = new State<Model>(model);
      const value = faker.person.firstName();

      const process1 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, value)));
      const process2 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, value)));

      const name = state.inspect.name.first.settled();
      expect(state.inspect.name.first.pending()).toBe(true);

      state.prune(process1);
      expect(state.inspect.name.first.pending()).toBe(true);

      state.mutate((draft) => void (draft.name.first = value));
      state.prune(process2);

      expect(await name).toBe(value);
    });
  });

  /**
   * Tests for the observe() method which subscribes to model changes.
   */
  describe('observe()', () => {
    /**
     * Verifies that observe() calls the callback on mutate().
     */
    it('calls callback on mutate', () => {
      const state = new State<Model>(model);
      const callback = vi.fn();

      state.observe(callback);
      expect(callback).not.toHaveBeenCalled();

      state.mutate((draft) => void (draft.age = 99));
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(state.model);
    });

    /**
     * Verifies that observe() calls the callback on prune().
     */
    it('calls callback on prune', () => {
      const state = new State<Model>(model);
      const callback = vi.fn();

      state.observe(callback);

      const process = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(callback).toHaveBeenCalledTimes(1);

      state.prune(process);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    /**
     * Verifies that the unsubscribe function stops callbacks.
     */
    it('unsubscribes when returned function is called', () => {
      const state = new State<Model>(model);
      const callback = vi.fn();

      const unsubscribe = state.observe(callback);
      state.mutate((draft) => void (draft.age = 50));
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      state.mutate((draft) => void (draft.age = 60));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Tests for Greek letter shorthand aliases.
   */
  describe('aliases', () => {
    /**
     * Verifies that κ is an alias for pk.
     */
    it('κ generates unique ids like pk', () => {
      const id = State.κ();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    /**
     * Verifies that δ is an alias for annotate.
     */
    it('δ annotates values like annotate', () => {
      const state = new State<Model>(model);

      state.mutate((draft) => {
        draft.name.first = state.δ(Op.Update, 'Pending');
      });

      expect(state.inspect.name.first.pending()).toBe(true);
    });
  });
});
