import { faker } from '@faker-js/faker';
import { A } from '@mobily/ts-belt';
import { notification } from 'antd';
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

function getPlacement(): 'topRight' | 'bottom' {
  return window.innerWidth <= 768 ? 'bottom' : 'topRight';
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
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sorting, setSorting] = useState(false);

  const handleUpdate = async (id: string) => {
    const name = faker.person.firstName();

    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = state.annotate(Op.Update, name);
    });
    rerender();

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index].name = name;
    });
    state.prune(process);
    rerender();
  };

  const handleDelete = async (id: string) => {
    const name = state.model.people.find((person) => person.id === id)?.name;
    const process = state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people[index] = state.annotate(Op.Remove, draft.people[index]);
    });
    rerender();

    await wait();

    state.mutate((draft) => {
      const index = draft.people.findIndex((person) => person.id === id);
      if (index !== -1) draft.people.splice(index, 1);
    });
    state.prune(process);
    rerender();
    notification.success({ title: 'Deleted', description: `${name} deleted successfully`, placement: getPlacement() });
  };

  const handleCreate = async () => {
    const name = faker.person.firstName();
    const id = State.pk();
    const age = faker.number.int({ min: 18, max: 80 });
    const newPerson: Person = { id, name, age };

    const process = state.mutate((draft) => {
      draft.people.push(state.annotate(Op.Add, newPerson));
    });
    rerender();

    await wait();

    state.prune(process);
    rerender();
    notification.success({ title: 'Created', description: `${name} created successfully`, placement: getPlacement() });
  };

  const toggleSort = async () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setSorting(true);

    const process = state.mutate((draft) => {
      draft.people = state.annotate(Op.Sort, draft.people);
    });
    rerender();

    await wait();

    state.mutate((draft) => {
      draft.people.sort((a, b) => {
        return newOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });
    state.prune(process);
    setSorting(false);
    rerender();
  };

  return { state, sortOrder, sorting, handleUpdate, handleDelete, handleCreate, toggleSort };
}
