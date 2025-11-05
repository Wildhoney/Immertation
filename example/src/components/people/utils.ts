import { faker } from '@faker-js/faker';
import { A } from '@mobily/ts-belt';

type Person = {
  id: symbol;
  name: string;
  age: number;
};

export const model: { people: Person[] } = {
  people: A.makeWithIndex(5, () => ({
    id: Symbol(faker.string.uuid()),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 18, max: 80 }),
  })) as Person[],
};
