import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { State, Operation } from '.';

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
      const instance = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const [model, annotations] = instance.mutate((draft) => {
          draft.name = name;
        });

        expect(model.name).toEqual(name);
        expect(annotations.name.pending()).toBe(false);
        expect(annotations.name.draft()).toEqual(name);
        expect(annotations.age.draft()).toEqual(initial.age);
      }
    });

    it('using assignment with operations', () => {
      faker.seed(2);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const instance = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const [model, annotations] = instance.mutate((draft) => {
          draft.name = Operation.Update(name, process);
        });

        expect(model.name).toEqual(name);
        expect(annotations.name.pending()).toBe(true);
        expect(annotations.name.is(Operation.Update)).toBe(true);
        expect(annotations.name.is(Operation.Replace)).toBe(false);
        expect(annotations.name.draft()).toEqual(name);
      }

      {
        const name = faker.person.firstName() + '!';
        const [model, annotations] = instance.mutate((draft) => {
          draft.name = Operation.Replace(name, process);
        });

        expect(model.name).toEqual(name);
        expect(annotations.name.pending()).toBe(true);
        expect(annotations.name.is(Operation.Update)).toBe(true);
        expect(annotations.name.is(Operation.Replace)).toBe(true);
        expect(annotations.name.draft()).toEqual(name);
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
      const instance = new State<Model>(initial);

      {
        const names = [faker.person.firstName() + '!', faker.person.firstName() + '?'] as const;
        const [model, annotations] = instance.mutate((draft) => {
          draft.friends[0] = Operation.Update(names[0], process);
          draft.friends[2] = Operation.Update(names[1], process);
        });

        expect(model.friends).toEqual([names[0], friends[1], names[1]]);

        expect(annotations.friends[0].pending()).toBe(true);
        expect(annotations.friends[1].pending()).toBe(false);
        expect(annotations.friends[2].pending()).toBe(true);

        expect(annotations.friends[0].is(Operation.Update)).toBe(true);
        expect(annotations.friends[1].is(Operation.Update)).toBe(false);
        expect(annotations.friends[2].is(Operation.Update)).toBe(true);

        expect(annotations.friends[0].draft()).toEqual(names[0]);
        expect(annotations.friends[2].draft()).toEqual(names[1]);
      }
    });

    it('using push with primitives', () => {
      faker.seed(3);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new State<Model>(initial);

      {
        const name = faker.person.firstName();
        const [model, annotations] = instance.mutate((draft) => {
          draft.friends.push(name);
        });

        expect(model.friends).toEqual([...initial.friends, name]);
        expect(model.friends.length).toBe(initial.friends.length + 1);
        expect(annotations.friends.pending()).toBe(false);
      }
    });

    it('using push with operations', () => {
      faker.seed(4);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new State<Model>(initial);

      {
        const name = faker.person.firstName();
        const [model, annotations] = instance.mutate((draft) => {
          draft.friends.push(Operation.Add(name, process));
        });

        expect(model.friends).toEqual([...initial.friends, name]);

        expect(annotations.friends[0].pending()).toBe(false);
        expect(annotations.friends[1].pending()).toBe(false);
        expect(annotations.friends[2].pending()).toBe(false);
        expect(annotations.friends[3].pending()).toBe(true);

        expect(annotations.friends[0].is(Operation.Add)).toBe(false);
        expect(annotations.friends[1].is(Operation.Add)).toBe(false);
        expect(annotations.friends[2].is(Operation.Add)).toBe(false);
        expect(annotations.friends[3].is(Operation.Add)).toBe(true);

        expect(annotations.friends[3].draft()).toEqual(name);
      }
    });

    it('using sort with primitives', () => {
      faker.seed(5);

      const initial = {
        friends: [faker.person.firstName(), faker.person.firstName(), faker.person.firstName()],
      };
      const instance = new State<Model>(initial);

      {
        const [model] = instance.mutate((draft) => {
          draft.friends = [...draft.friends].sort();
        });

        expect(model.friends).toMatchSnapshot();
      }
    });

    it('using sort with operations', () => {
      faker.seed(6);

      const initial = {
        friends: [
          faker.person.firstName(),
          faker.person.firstName() + '!',
          faker.person.firstName(),
        ],
      };
      const instance = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const index = initial.friends.findIndex((friend) => friend.endsWith('!'));
        const [model, annotations] = instance.mutate((draft) => {
          draft.friends[index] = Operation.Update(name, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(model.friends).toMatchSnapshot();
        expect(annotations.friends.pending()).toBe(true);
        expect(annotations.friends.is(Operation.Sort)).toBe(true);
      }

      {
        const name = faker.person.firstName() + '?';
        const [model, annotations] = instance.mutate((draft) => {
          const index = draft.friends.findIndex((friend) => friend.endsWith('!'));
          draft.friends[index] = Operation.Replace(name, process);
        });

        expect(model.friends).toMatchSnapshot();

        const indexAfterReplace = model.friends.findIndex((friend) => friend.endsWith('?'));
        const annotationAtIndex = annotations.friends[indexAfterReplace];
        expect(annotationAtIndex.pending()).toBe(true);
        expect(annotationAtIndex.is(Operation.Update)).toBe(true);
        expect(annotationAtIndex.is(Operation.Replace)).toBe(true);
        expect(annotationAtIndex.draft()).toEqual(name);
      }
    });

    it('using sort with operations and duplicate items', () => {
      faker.seed(7);

      const name = faker.person.firstName();
      const initial = {
        friends: [name, name, faker.person.firstName()],
      };
      const instance = new State<Model>(initial);

      {
        const updatedName = faker.person.firstName() + '!';
        const [model, annotations] = instance.mutate((draft) => {
          draft.friends[1] = Operation.Update(updatedName, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(model.friends).toMatchSnapshot();
        expect(annotations.friends.pending()).toBe(true);
        expect(annotations.friends.is(Operation.Sort)).toBe(true);
      }
    });
  });
});

describe('prune()', () => {
  type Model = {
    name: string;
    age: number;
  };

  it('prunes tasks by process', () => {
    faker.seed(9);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new State<Model>(initial);
    const processes = [Symbol('process1'), Symbol('process2')] as const;

    const newName = faker.person.firstName();
    instance.mutate((draft) => {
      draft.name = Operation.Update(newName, processes[0]);
    });

    const newAge = faker.number.int(100);
    instance.mutate((draft) => {
      draft.age = Operation.Update(newAge, processes[1]);
    });

    const [model, annotations] = instance.prune(processes[0]);

    expect(model.name).toEqual(newName);
    expect(model.age).toEqual(newAge);

    expect(annotations.name.pending()).toBe(false);
    expect(annotations.name.is(Operation.Update)).toBe(false);

    expect(annotations.age.pending()).toBe(true);
    expect(annotations.age.is(Operation.Update)).toBe(true);
    expect(annotations.age.draft()).toEqual(newAge);
  });
});
