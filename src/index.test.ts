import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import Immeration from '.';
import { Operation } from './utils';

const proc = Symbol('process');

describe('produce()', () => {
  it('should be able to update a value', () => {
    
    const m = { name: `${faker.person.firstName()} Smith` };
    const immertation = new Immeration(m);
    
    const n1 = `${faker.person.firstName()} Jones`;
    const [m1, a1] = immertation.produce((draft) => {
      draft.name = Operation.Update(n1, proc);
    });
    expect(m1.name).toBe(n1);
    // expect(a1.name.is(Operation.Update)).toEqual(true);
    // expect(a1.name.is(Operation.Replace)).toEqual(false);

    const n2 = `${faker.person.firstName()} Brown`;
    const [m2, a2] = immertation.produce((draft) => {
      draft.name = Operation.Replace(n2, proc);
    });
    expect(m2.name).toBe(n2);
    // expect(a2.name.is(Operation.Update)).toEqual(true);
    // expect(a2.name.is(Operation.Replace)).toEqual(true);
  });
});
