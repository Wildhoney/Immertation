import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { Immeration, Operation, Revision } from '.';
import { A } from '@mobily/ts-belt';

type Model = {
  name: string;
  age: number;
};

describe('mutate()', () => {
  const process = Symbol('process');

  it('updates model using persistent value', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = name;
      });

      expect(model.name.get()).toEqual(name);
      expect(model.name.get(Revision.Current)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
    }

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = name;
      });

      expect(model.name.get()).toEqual(name);
      expect(model.name.get(Revision.Current)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
    }
  });

  it('updates model using operation', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = Operation.Update(name, process);
      });

      expect(model.name.get()).toEqual(initial.name);
      expect(model.name.get(Revision.Current)).toEqual(initial.name);
      expect(model.name.get(Revision.Draft)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(true);
      expect(model.name.is(Operation.Replace)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
      expect(model.name.is(Operation.Remove)).toBe(false);
    }

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = Operation.Replace(name, process);
      });

      expect(model.name.get()).toEqual(initial.name);
      expect(model.name.get(Revision.Current)).toEqual(initial.name);
      expect(model.name.get(Revision.Draft)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(true);
      expect(model.name.is(Operation.Replace)).toBe(true);
      expect(model.name.is(Operation.Add)).toBe(false);
      expect(model.name.is(Operation.Remove)).toBe(false);
    }
  });
});

describe('prune()', () => {
  it('prunes records by process', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);
    const processes = [Symbol('process1'), Symbol('process2')] as const;

    instance.mutate((draft) => {
      draft.name = Operation.Update(faker.person.firstName(), A.getUnsafe(processes, 0));
    });

    instance.mutate((draft) => {
      draft.age = Operation.Update(faker.number.int(100), A.getUnsafe(processes, 1));
    });

    const model = instance.prune(A.getUnsafe(processes, 0));

    expect(model.name.is(Operation.Update)).toBe(false);
    expect(model.age.is(Operation.Update)).toBe(true);
  });
});
