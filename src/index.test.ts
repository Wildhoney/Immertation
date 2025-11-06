import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { Immeration, Operation } from '.';

describe('mutate()', () => {
  const process = Symbol('process');

  describe('object', () => {
    type Model = {
      name: string;
      age: number;
    };

    it('using assignment with primitives', () => {
      faker.seed(1);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const instance = new Immeration<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const model = instance.mutate((draft) => {
          // draft.name = name;
          draft.name = Operation.Update(name, process);
        });

        expect(model.name).toEqual(name);

        // expect(model.name.pending()).toBe(false);
        // expect(model.name.get(Revision.Current)).toEqual(name);
        // expect(model.name.is(Operation.Update)).toBe(false);
      }
    });

    it('using assignment with operations', () => {
      faker.seed(2);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const instance = new Immeration<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const model = instance.mutate((draft) => {
          draft.name = Operation.Update(name, process);
        });

        expect(model.name).toEqual(name);

        // expect(model.name.pending()).toBe(true);
        // expect(model.name.get(Revision.Current)).toEqual(initial.name);
        // expect(model.name.get(Revision.Draft)).toEqual(name);
        // expect(model.name.is(Operation.Update)).toBe(true);
      }
    });
  });

  describe('array', () => {
    type Model = {
      friends: string[];
    };

    it('using assignment with operations', () => {
      faker.seed(8);

      const friends = [
        faker.person.firstName(),
        faker.person.firstName(),
        faker.person.firstName(),
      ];
      const initial = { friends };
      const instance = new Immeration<Model>(initial);

      {
        const names = [faker.person.firstName() + '!', faker.person.firstName() + '?'] as const;
        const model = instance.mutate((draft) => {
          draft.friends[0] = Operation.Update(names[0], process);
          draft.friends[2] = Operation.Update(names[1], process);
        });

        expect(model.friends).toEqual([names[0], friends[1], names[1]]);
      }
    });

    it('using push with primitives', () => {
      faker.seed(3);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new Immeration<Model>(initial);

      {
        const name = faker.person.firstName();
        const model = instance.mutate((draft) => {
          draft.friends.push(name);
        });

        expect(model.friends).toEqual([...initial.friends, name]);
        expect(model.friends.length).toBe(initial.friends.length + 1);

        // expect(model.friends.length).toBe(initial.friends.length + 1);
        // expect(model.friends.at(-1)?.pending()).toBe(false);
        // expect(model.friends.at(-1)?.get(Revision.Current)).toEqual(friend);
        // expect(model.friends.at(-1)?.is(Operation.Add)).toBe(false);
      }
    });

    it('using push with operations', () => {
      faker.seed(4);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new Immeration<Model>(initial);

      {
        const name = faker.person.firstName();
        const model = instance.mutate((draft) => {
          draft.friends.push(Operation.Add(name, process));
        });

        expect(model.friends).toEqual([...initial.friends, name]);

        // expect(model.friends.length).toBe(initial.friends.length + 1);
        // expect(model.friends.at(-1)?.pending()).toBe(true);
        // expect(model.friends.at(-1)?.get(Revision.Current)).toBeUndefined();
        // expect(model.friends.at(-1)?.get(Revision.Draft)).toEqual(friend);
        // expect(model.friends.at(-1)?.is(Operation.Add)).toBe(true);
      }
    });

    it('using sort with primitives', () => {
      faker.seed(5);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new Immeration<Model>(initial);

      {
        const model = instance.mutate((draft) => {
          draft.friends = [...draft.friends].sort();
        });

        expect(model.friends).toMatchSnapshot();
      }
    });

    it('using sort with operations', () => {
      faker.seed(6);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new Immeration<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const model = instance.mutate((draft) => {
          draft.friends[1] = Operation.Update(name, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(model.friends).toMatchSnapshot();

        // TODO: Implement Extended type with is() and pending() methods
        // expect(model.friends.is(Operation.Sort)).toBe(true);
        // expect(model.friends.pending()).toBe(true);
        // expect(model.friends.at(-1).pending()).toBe(true);
        // expect(model.friends.at(-1).is(Operation.Update)).toBe(true);
      }
    });

    it('using sort with operations and duplicate items', () => {
      faker.seed(7);

      const name = faker.person.firstName();
      const initial = {
        friends: [name, name, faker.person.firstName()],
      };
      const instance = new Immeration<Model>(initial);

      {
        const updatedName = faker.person.firstName() + '!';
        const model = instance.mutate((draft) => {
          draft.friends[1] = Operation.Update(updatedName, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(model.friends).toMatchSnapshot();
      }
    });
  });
});

// describe.skip('prune()', () => {
//   type Model = {
//     name: string;
//     age: number;
//   };

//   it('prunes records by process', () => {
//     const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
//     const instance = new Immeration<Model>(initial);
//     const processes = [Symbol('process1'), Symbol('process2')] as const;

//     instance.mutate((draft) => {
//       draft.name = Operation.Update(faker.person.firstName(), A.getUnsafe(processes, 0));
//     });

//     instance.mutate((draft) => {
//       draft.age = Operation.Update(faker.number.int(100), A.getUnsafe(processes, 1));
//     });

//     const model = instance.prune(A.getUnsafe(processes, 0));

//     expect(model.name.is(Operation.Update)).toBe(false);
//     expect(model.age.is(Operation.Update)).toBe(true);
//   });
// });
