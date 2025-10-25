import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import Immeration from '.';
import { Operation } from './types';

const process = Symbol('process');

describe('produce()', () => {
  it('should be able to update a value', () => {
    const model = {
      name: `${faker.person.firstName()} Smith`,
      people: [
        { name: `${faker.person.firstName()} Doe` },
        { name: `${faker.person.firstName()} Black` },
      ],
    };

    const immertation = new Immeration(model);

    {
      const name = `${faker.person.firstName()} Jones`;
      const [model, annotations] = immertation.produce((draft) => {
        draft.name = Operation.Update(name, process);
      });
      expect(model.name).toBe(name);
      expect(annotations.name.is(Operation.Update)).toEqual(true);
    }

    {
      const name = `${faker.person.firstName()} White`;
      const [model, annotations] = immertation.produce((draft) => {
        draft.people[1] = Operation.Update({ name }, process);
      });
      expect(model.people[1].name).toBe(name);
      expect(annotations.people[1].is(Operation.Update)).toEqual(true);
    }

    {
      const [model, annotations] = immertation.produce((draft) => {
        draft.people.reverse();
      });
      expect(model.people[0].name).toBe(model.people[0].name);
      expect(model.people[1].name).toBe(model.people[1].name);
      expect(annotations.people[0].is(Operation.Update)).toEqual(false);
    }
  });
});
