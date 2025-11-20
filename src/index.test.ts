import { Draft, Op, State } from '.';
import { describe, expect, it } from 'vitest';
import { faker } from '@faker-js/faker';

describe('mutate()', () => {
  describe('primitives', () => {
    type Model = {
      name: string;
      age: number;
    };

    /**
     * Tests primitive value updates with and without Draft annotations.
     * Verifies that direct mutations apply immediately while Draft-wrapped values remain pending.
     */
    it('updates', () => {
      {
        const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
        const state = new State<Model>(initial, (item) => String(item));
        const name = faker.person.firstName() + '!';
        const process = state.mutate((draft) => {
          draft.name = name;
        });

        expect(process).toBeTypeOf('symbol');

        expect(state.model.name).toEqual(name);
        expect(state.inspect.name.pending()).toBe(false);
      }

      {
        const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
        const state = new State<Model>(initial, (item) => String(item));
        const name = faker.person.firstName() + '?';
        const age = faker.number.int(100);
        const process = state.mutate((draft) => {
          draft.name = Draft(name, Op.Update);
          draft.age = age;
        });

        expect(process).toBeTypeOf('symbol');

        expect(state.model.name).toEqual(initial.name);
        expect(state.inspect.name.pending()).toBe(true);

        expect(state.model.age).toEqual(age);
        expect(state.inspect.age.pending()).toBe(false);
      }
    });
  });

  describe('objects', () => {
    type Model = {
      names: {
        first: string;
        last: string;
      };
    };

    /**
     * Tests nested object property updates with Draft annotations.
     * Verifies that individual properties and entire objects can be marked as pending independently.
     */
    it('updates', () => {
      const initial = {
        names: {
          first: faker.person.firstName(),
          last: faker.person.lastName(),
        },
      };

      {
        const state = new State<Model>(initial, (item) => String(item));
        const first = faker.person.firstName() + '!';
        const last = faker.person.lastName() + '?';
        const process = state.mutate((draft) => {
          draft.names.first = Draft(first, Op.Update);
          draft.names.last = last;
        });

        expect(process).toBeTypeOf('symbol');
        expect(state.inspect.names.pending()).toBe(false);

        expect(state.model.names.first).toEqual(initial.names.first);
        expect(state.inspect.names.first.pending()).toBe(true);

        expect(state.model.names.last).toEqual(last);
        expect(state.inspect.names.last.pending()).toBe(false);
      }

      {
        const state = new State<Model>(initial, (item) => String(item));
        const first = faker.person.firstName() + '!';
        const last = faker.person.lastName() + '?';
        const process = state.mutate((draft) => {
          draft.names = Draft({ first, last }, Op.Update);
        });

        expect(process).toBeTypeOf('symbol');
        expect(state.inspect.names.pending()).toBe(true);

        expect(state.model.names.first).toEqual(initial.names.first);
        expect(state.inspect.names.first.pending()).toBe(false);

        expect(state.model.names.last).toEqual(initial.names.last);
        expect(state.inspect.names.last.pending()).toBe(false);
      }
    });
  });

  describe('arrays', () => {
    type Model = {
      friends: { id: number; name: string }[];
    };

    /**
     * Tests array item property updates with Draft annotations.
     * Verifies that individual array item properties can be marked as pending.
     */
    it('updates', () => {
      const initial = {
        friends: [
          { id: 1, name: faker.person.firstName() },
          { id: 2, name: faker.person.firstName() },
          { id: 3, name: faker.person.firstName() },
        ],
      };

      {
        const state = new State<Model>(initial, (value) => {
          if (Array.isArray(value)) {
            return `friends/${value.map((item) => item.id).join(',')}`;
          }
          return `friend/${value.id}`;
        });
        const name = faker.person.firstName() + '!';
        const process = state.mutate((draft) => {
          draft.friends[1].name = Draft(name, Op.Update);
        });

        expect(process).toBeTypeOf('symbol');
        expect(state.inspect.friends.pending()).toBe(false);

        expect(state.model.friends[0].name).toEqual(initial.friends[0].name);
        expect(state.inspect.friends[0].name.pending()).toBe(false);

        expect(state.model.friends[1].name).toEqual(initial.friends[1].name);
        expect(state.inspect.friends[1].name.pending()).toBe(true);

        expect(state.model.friends[2].name).toEqual(initial.friends[2].name);
        expect(state.inspect.friends[2].name.pending()).toBe(false);
      }
    });

    /**
     * Tests that annotations are preserved when array is sorted.
     * Verifies that pending annotations follow the items to their new positions after sorting.
     */
    it('sorts', () => {
      const initial = {
        friends: [
          { id: 3, name: 'Charlie' },
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };

      const state = new State<Model>(initial, (value) => {
        if (Array.isArray(value)) {
          return `friends/${value.map((item) => item.id).join(',')}`;
        }
        return `friend/${value.id}`;
      });
      const updatedName = 'Alice Updated';

      const process = state.mutate((draft) => {
        draft.friends[1].name = Draft(updatedName, Op.Update);
        draft.friends.sort((a, b) => a.id - b.id);
      });

      expect(process).toBeTypeOf('symbol');

      expect(state.model.friends[0].id).toEqual(1);
      expect(state.model.friends[0].name).toEqual('Alice');
      expect(state.inspect.friends[0].name.pending()).toBe(true);

      expect(state.model.friends[1].id).toEqual(2);
      expect(state.model.friends[1].name).toEqual('Bob');
      expect(state.inspect.friends[1].name.pending()).toBe(false);

      expect(state.model.friends[2].id).toEqual(3);
      expect(state.model.friends[2].name).toEqual('Charlie');
      expect(state.inspect.friends[2].name.pending()).toBe(false);
    });

    /**
     * Tests Op.Add behavior for optimistic array item additions.
     * Verifies that added items appear in draft but not in model until confirmed.
     */
    it('adds', () => {
      const initial = {
        friends: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ],
      };

      const state = new State<Model>(initial, (value) => {
        if (Array.isArray(value)) {
          return `friends/${value.map((item) => item.id).join(',')}`;
        }
        return `friend/${value.id}`;
      });
      const newPerson = { id: 4, name: 'David' };

      const process = state.mutate((draft) => {
        draft.friends.push(Draft(newPerson, Op.Add));
      });

      expect(process).toBeTypeOf('symbol');

      expect(state.model.friends.length).toEqual(3);
      expect(state.model.friends[0].name).toEqual('Alice');
      expect(state.model.friends[1].name).toEqual('Bob');
      expect(state.model.friends[2].name).toEqual('Charlie');

      expect(state.inspect.friends.draft().length).toEqual(4);
      expect(state.inspect.friends.draft()[0].name).toEqual('Alice');
      expect(state.inspect.friends.draft()[1].name).toEqual('Bob');
      expect(state.inspect.friends.draft()[2].name).toEqual('Charlie');
      expect(state.inspect.friends.draft()[3].name).toEqual('David');

      expect(state.inspect.friends[0].pending()).toBe(false);
      expect(state.inspect.friends[1].pending()).toBe(false);
      expect(state.inspect.friends[2].pending()).toBe(false);
      expect(state.inspect.friends[3].pending()).toBe(true);
    });

    /**
     * Tests Op.Remove behavior for optimistic array item deletions.
     * Verifies that removed items disappear from draft but remain in model until confirmed.
     */
    it('removes', () => {
      const initial = {
        friends: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ],
      };

      const state = new State<Model>(initial, (value) => {
        if (Array.isArray(value)) {
          return `friends/${value.map((item) => item.id).join(',')}`;
        }
        return `friend/${value.id}`;
      });

      const process = state.mutate((draft) => {
        draft.friends[2] = Draft(draft.friends[2], Op.Remove);
      });

      expect(process).toBeTypeOf('symbol');

      expect(state.model.friends.length).toEqual(3);
      expect(state.model.friends[0].name).toEqual('Alice');
      expect(state.model.friends[1].name).toEqual('Bob');
      expect(state.model.friends[2].name).toEqual('Charlie');

      expect(state.inspect.friends.draft().length).toEqual(2);
      expect(state.inspect.friends.draft()[0].name).toEqual('Alice');
      expect(state.inspect.friends.draft()[1].name).toEqual('Bob');

      expect(state.inspect.friends[0].pending()).toBe(false);
      expect(state.inspect.friends[1].pending()).toBe(false);
      expect(state.inspect.friends[2].pending()).toBe(true);
    });
  });
});
