import { faker } from '@faker-js/faker';
import { A } from '@mobily/ts-belt';
import { message } from 'antd';
import { useMemo, useReducer, useState } from 'react';
import { State, Op } from '../../../../src';
import type { Snapshot } from '../../../../src/types';

export type Person = {
  id: string;
  name: string;
  age: number;
};

export type Model = {
  people: Person[];
};

export const model: Model = {
  people: A.makeWithIndex(5, () => ({
    id: State.pk(),
    name: faker.person.firstName(),
    age: faker.number.int({ min: 18, max: 80 }),
  })) as Person[],
};

function wait(): Promise<void> {
  const delay = faker.number.int({ min: 2_000, max: 4_000 });
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function useController() {
  const state = useMemo(
    () =>
      new State<Model>(model, (value: Snapshot<Model>) => {
        if (Array.isArray(value)) return `people/${value.map((person) => person.id).join(',')}`;
        if ('id' in value) return `person/${value.id}`;
        return JSON.stringify(value);
      }),
    [],
  );
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleUpdate = async (id: string) => {
    const name = faker.person.firstName();

    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = State.annotate(Op.Update, name);
    });
    forceUpdate();

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = name;
    });
    state.prune(process);
    forceUpdate();
  };

  const handleDelete = async (id: string) => {
    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index] = State.annotate(Op.Remove, draft.people[index]);
    });
    forceUpdate();

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people.splice(index, 1);
    });
    state.prune(process);
    forceUpdate();
    message.success('Person deleted successfully');
  };

  const handleCreate = async () => {
    const name = faker.person.firstName();
    const id = State.pk();
    const age = faker.number.int({ min: 18, max: 80 });
    const newPerson: Person = { id, name, age };

    const process = state.mutate((draft) => {
      draft.people.push(State.annotate(Op.Add, newPerson));
    });
    forceUpdate();

    await wait();

    state.prune(process);
    forceUpdate();
    message.success(`${name} created successfully`);
  };

  const handleSort = (order: 'asc' | 'desc') => {
    state.mutate((draft) => {
      draft.people.sort((a, b) => {
        return order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });
    forceUpdate();
  };

  const toggleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    handleSort(newOrder);
  };

  return { state, sortOrder, handleUpdate, handleDelete, handleCreate, toggleSort };
}
