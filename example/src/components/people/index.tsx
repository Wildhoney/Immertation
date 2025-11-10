import { useMemo, useState } from 'react';
import { State, Operation } from 'immeration';
import { model } from './utils';
import { faker } from '@faker-js/faker';

type Person = {
  id: symbol;
  name: string;
  age: number;
};

type Model = {
  people: Person[];
};

export default function People() {
  const store = useMemo(() => new State<Model>(model), []);
  const [, forceUpdate] = useState({});
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const triggerRender = () => forceUpdate({});

  const handleDelete = async (id: symbol) => {
    const process = Symbol('delete');

    store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = Operation.Remove(draft.people[index], process);
      }
    });

    triggerRender();

    await new Promise((resolve) => setTimeout(resolve, 5000));

    store.mutate((draft) => void (draft.people = draft.people.filter((p) => p.id !== id)));

    // store.prune(process);
    // triggerRender();
  };

  const handleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';

    store.mutate((draft) => {
      draft.people.sort((a, b) => {
        return newOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });

    setSortOrder(newOrder);
    triggerRender();
  };

  const handleRefresh = async (id: symbol) => {
    const process = Symbol('refresh');

    const newName = faker.person.fullName();
    const newAge = faker.number.int({ min: 18, max: 80 });

    store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = Operation.Update(
          { ...draft.people[index], name: newName, age: newAge },
          process
        );
      }
    });

    triggerRender();

    await new Promise((resolve) => setTimeout(resolve, 3000));

    store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = { ...draft.people[index], name: newName, age: newAge };
      }
    });

    // store.prune(process);
    // triggerRender();
  };

  const handleAdd = async () => {
    const process = Symbol('add');

    const newName = faker.person.fullName();
    const newAge = faker.number.int({ min: 18, max: 80 });
    const newPerson = {
      id: Symbol(faker.string.uuid()),
      name: newName,
      age: newAge,
    };

    store.mutate((draft) => void (draft.people = [...draft.people, Operation.Add(newPerson, process)]));

    triggerRender();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    store.mutate((draft) => void (draft.people = [...draft.people, newPerson]));

    // store.prune(process);
    // triggerRender();
  };

  return (
    <div>
      <button onClick={handleSort}>
        Sort by Name ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})
      </button>{' '}
      <button onClick={handleAdd}>Add person</button>
      <ul>
        {store.model.people.map((person: Person, index: number) => {
          const personAnnotations = store.inspect.people[index];
          const isDeleting = personAnnotations.is(Operation.Remove);
          const isUpdating = personAnnotations.is(Operation.Update);
          const isAdding = personAnnotations.is(Operation.Add);

          const draftName = person.name;
          const draftAge = person.age;

          return (
            <li
              key={person.id.toString()}
              style={{ opacity: isDeleting ? 0.5 : isUpdating || isAdding ? 0.7 : 1 }}
            >
              {isAdding ? (
                <>
                  Adding: {draftName} - {draftAge}{' '}
                  <button disabled>Refresh</button> <button disabled>Delete</button>
                </>
              ) : isDeleting ? (
                <>
                  {draftName} - {draftAge}{' '}
                  <button disabled>Refresh</button>{' '}
                  <button disabled>Deleting...</button>
                </>
              ) : (
                <>
                  {draftName} - {draftAge}
                  {isUpdating && (
                    <span style={{ color: '#666', marginLeft: '8px' }}>
                      (updating...)
                    </span>
                  )}{' '}
                  <button
                    onClick={() => handleRefresh(person.id)}
                    disabled={isDeleting || isUpdating}
                  >
                    {isUpdating ? 'Refreshing...' : 'Refresh'}
                  </button>{' '}
                  <button onClick={() => handleDelete(person.id)} disabled={isDeleting}>
                    Delete
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
