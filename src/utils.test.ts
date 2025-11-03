import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { augment, encapsulate, distill } from './utils';
import { Operation, Config } from './types';

type Model = {
  name: string;
  age: number;
};

const process = Symbol('process');

const name = faker.person.firstName();
const age = faker.number.int(100);
const model = encapsulate({ name, age });

describe('encapsulate()', () => {
  it('should encapsulate models', () => {
    expect(model[Config.separator].name[Config.separator]).toEqual(name);
    expect(model[Config.separator].name.annotation).toBeTruthy();

    expect(model[Config.separator].age[Config.separator]).toEqual(age);
    expect(model[Config.separator].age.annotation).toBeTruthy();
  });
});

describe('distill()', () => {
  it('should distill encapsulated models to plain objects', () => {
    const plain = distill<Model>(model);

    expect(plain).toEqual({ name, age });
    expect(plain.name).toEqual(name);
    expect(plain.age).toEqual(age);
  });

  it('should distill nested structures', () => {
    type Model = {
      user: { name: string; age: number };
      tags: string[];
    };
    const nested: Model = {
      user: { name: faker.person.firstName(), age: faker.number.int(100) },
      tags: ['admin', 'user'],
    };
    const encapsulated = encapsulate(nested);
    const plain = distill<Model>(encapsulated);

    expect(plain).toEqual(nested);
    expect(plain.user.name).toEqual(nested.user.name);
    expect(plain.tags).toEqual(nested.tags);
  });
});

describe('augment()', () => {
  it('augments patches', () => {
    {
      const name = faker.person.firstName() + '!';
      const [patch] = augment<Model>(model, (draft) => {
        draft.name = name;
      });

      expect(patch.path).toEqual([Config.separator, 'name']);
      expect(patch.value.current).toEqual(name);
    }

    {
      const name = faker.person.firstName() + '!';
      const [patch] = augment<Model>(model, (draft) => {
        draft.name = Operation.Update(name, process);
      });

      expect(patch.path).toEqual([Config.separator, 'name']);
      expect(patch.value.current).toEqual(model.current.name.current);
      expect(patch.value.annotation.records[0].value).toEqual(name);
    }
  });
});
