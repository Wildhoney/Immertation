import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import { augment, encapsulate } from './utils';
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
