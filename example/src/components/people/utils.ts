import { faker } from '@faker-js/faker';
import { A } from '@mobily/ts-belt';
import { notification } from 'antd';
import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { State, Op } from '../../../../src';
import { type Model, Person, Direction } from './types';

/** Statistics for tracking pending operations */
export type Statistics = {
  sorting: boolean;
  creating: number;
  updating: number;
  deleting: number;
  total: number;
};

/** Initial model with 5 randomly generated people */
export const model: Model = {
  people: [...A.makeWithIndex(5, Person.create)],
};

/**
 * Simulates an async operation with a random delay.
 * @returns Promise that resolves after 2-4 seconds
 */
function wait(): Promise<void> {
  const delay = faker.number.int({ min: 2_000, max: 4_000 });
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Returns the notification placement based on screen width.
 * @returns 'bottom' for mobile, 'topRight' for desktop
 */
function placement(): 'topRight' | 'bottom' {
  return window.innerWidth <= 768 ? 'bottom' : 'topRight';
}

/**
 * React hook for managing the people list with optimistic updates.
 * @returns Controller object with state and handler functions
 */
export function useController() {
  const state = useMemo(() => new State<Model>(model), []);
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [direction, setDirection] = useState(Direction.Asc);

  useEffect(() => state.observe(() => rerender()), [state]);

  /**
   * Updates a person's name with optimistic UI.
   * @param id - The person's unique identifier
   */
  const handleUpdate = useCallback(
    async (id: string) => {
      const name = faker.person.firstName();

      const process = state.mutate((draft) => {
        const index = Person.index(draft, id);
        if (index !== -1) draft.people[index].name = state.annotate(Op.Update, name);
      });

      await wait();

      state.mutate((draft) => {
        const index = Person.index(draft, id);
        if (index !== -1) draft.people[index].name = name;
      });
      state.prune(process);
    },
    [state],
  );

  /**
   * Deletes a person with optimistic UI.
   * @param id - The person's unique identifier
   */
  const handleDelete = useCallback(
    async (id: string) => {
      const name = state.model.people.find((person) => person.id === id)?.name;
      const process = state.mutate((draft) => {
        const index = Person.index(draft, id);
        if (index !== -1) draft.people[index] = state.annotate(Op.Remove, draft.people[index]);
      });

      await wait();

      state.mutate((draft) => {
        const index = Person.index(draft, id);
        if (index !== -1) draft.people.splice(index, 1);
      });
      state.prune(process);
      notification.success({
        message: 'Deleted',
        description: `${name} deleted successfully`,
        placement: placement(),
      });
    },
    [state],
  );

  /**
   * Creates a new person with optimistic UI.
   */
  const handleCreate = useCallback(async () => {
    const newPerson = Person.create();

    const process = state.mutate((draft) => {
      draft.people.push(state.annotate(Op.Add, newPerson));
    });

    await wait();

    state.prune(process);
    notification.success({
      message: 'Created',
      description: `${newPerson.name} created successfully`,
      placement: placement(),
    });
  }, [state]);

  /**
   * Sorts the people list with optimistic UI.
   */
  const handleSort = useCallback(async () => {
    const updated = direction === Direction.Asc ? Direction.Desc : Direction.Asc;
    setDirection(updated);

    const process = state.mutate((draft) => {
      draft.people = state.annotate(Op.Sort, draft.people);
    });

    await wait();

    state.mutate((draft) => {
      draft.people.sort((a, b) => {
        return updated === Direction.Asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });
    state.prune(process);
  }, [state, direction]);

  const statistics: Statistics = useMemo(() => {
    const sorting = state.inspect.people.is(Op.Sort);
    const creating = state.model.people.filter((_, i) => state.inspect.people[i].is(Op.Add)).length;
    const updating = state.model.people.filter((_, i) => state.inspect.people[i].name.pending()).length;
    const deleting = state.model.people.filter((_, i) => state.inspect.people[i].is(Op.Remove)).length;
    const total = state.model.people.length - creating - deleting;
    return { sorting, creating, updating, deleting, total };
  }, [state.model.people, state.inspect.people]);

  return useMemo(
    () => ({ state, direction, statistics, handleUpdate, handleDelete, handleCreate, handleSort }),
    [state, direction, statistics, handleUpdate, handleDelete, handleCreate, handleSort],
  );
}
