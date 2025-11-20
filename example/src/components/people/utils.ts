import { faker } from '@faker-js/faker';
import { A } from '@mobily/ts-belt';
import { message } from 'antd';
import { State, Draft, Op } from '../../../../src';

export type Person = {
  id: symbol;
  name: string;
  age: number;
};

export type Model = {
  people: Person[];
};

export const model: Model = {
  people: A.makeWithIndex(5, () => ({
    id: Symbol(faker.string.uuid()),
    name: faker.person.firstName(),
    age: faker.number.int({ min: 18, max: 80 }),
  })) as Person[],
};

function wait(): Promise<void> {
  const delay = faker.number.int({ min: 3_000, max: 5_000 });
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function useController(state: State<Model>) {
  const handleUpdate = async (id: symbol) => {
    const name = faker.person.firstName();

    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = Draft(name, Op.Update);
    });

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = name;
    });

    state.prune(process);
  };

  const handleDelete = async (id: symbol) => {
    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1)
        draft.people[index].age = Draft(draft.people[index].age, Op.Remove);

    });

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1)
        draft.people.splice(index, 1);

    });

    state.prune(process);
    message.success('Person deleted successfully');
  };

  const handleCreate = async () => {
    const name = faker.person.firstName();
    const id = Symbol(faker.string.uuid());
    const age = faker.number.int({ min: 18, max: 80 });
    const newPerson: Person = {  id,  name,  age,};

    const process = state.mutate((draft) => {
      draft.people.push(Draft(newPerson, Op.Add));
    });

    await wait();

    state.prune(process);
    message.success(`${name} created successfully`);
  };

  const handleSort = (order: 'asc' | 'desc') => {
    state.mutate((draft) => {
      draft.people.sort((a, b) => {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });
  };

  return { handleUpdate, handleDelete, handleCreate, handleSort };
}
