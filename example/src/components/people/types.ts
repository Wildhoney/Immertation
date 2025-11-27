import { faker } from '@faker-js/faker';
import { State, Op, type Inspect } from '../../../../src';

/** Data structure for a person entity */
export type Data = {
  id: string;
  name: string;
  age: number;
};

/** Root model containing the people list */
export type Model = {
  people: Data[];
};

/** Sort direction for the people list */
export enum Direction {
  Asc = 'asc',
  Desc = 'desc',
}

/** Utility class for person-related operations */
export class Person {
  /**
   * Creates a new person with random data.
   * @returns A new person data object
   */
  static create(): Data {
    return {
      id: State.pk(),
      name: faker.person.firstName(),
      age: faker.number.int({ min: 18, max: 80 }),
    };
  }

  /**
   * Finds the index of a person in the draft model.
   * @param draft - The model draft
   * @param id - The person's unique identifier
   * @returns The index of the person, or -1 if not found
   */
  static index(draft: Model, id: string): number {
    return draft.people.findIndex((person) => person.id === id);
  }

  /**
   * Gets the status flags for a person at a given index.
   * @param index - The person's index in the array
   * @param inspect - The inspect proxy from state
   * @returns Object with isCreating, isDeleting, isUpdating, isPending flags
   */
  static status(index: number, inspect: Inspect<Model>) {
    const isCreating = inspect.people[index].is(Op.Add);
    const isDeleting = inspect.people[index].is(Op.Remove);
    const isUpdating = inspect.people[index].name.pending();
    const isPending = isCreating || isDeleting || isUpdating;
    return { isCreating, isDeleting, isUpdating, isPending };
  }
}
