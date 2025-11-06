import { useMemo, useState } from 'react';
import { Immeration, Revision, Operation } from 'immeration';
import { model } from './utils';
import { faker } from '@faker-js/faker';

export default function People() {
  const store = useMemo(() => new Immeration(model), []);
  const [state, setState] = useState(() => store.mutate(() => {}));
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDelete = async (id: symbol) => {
    const process = Symbol('delete');

    const updated = store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = Operation.Remove(draft.people[index], process);
      }
    });

    setState(updated);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    store.mutate((draft) => {
      draft.people = draft.people.filter((p) => p.id !== id);
    });

    // const prunedState = store.prune(process);
    // setState(prunedState);
  };

  const handleSort = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';

    const updated = store.mutate((draft) => {
      draft.people.sort((a, b) => {
        return newOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      });
    });

    setSortOrder(newOrder);
    setState(updated);
  };

  const handleRefresh = async (id: symbol) => {
    const process = Symbol('refresh');

    const newName = faker.person.fullName();
    const newAge = faker.number.int({ min: 18, max: 80 });

    const updated = store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = Operation.Update(
          { ...draft.people[index], name: newName, age: newAge },
          process
        );
      }
    });

    setState(updated);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    store.mutate((draft) => {
      const index = draft.people.findIndex((p) => p.id === id);
      if (index !== -1) {
        draft.people[index] = { ...draft.people[index], name: newName, age: newAge };
      }
    });

    // setState(store.prune(process));
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

    const updated = store.mutate((draft) => {
      draft.people = [...draft.people, Operation.Add(newPerson, process)];
    });

    setState(updated);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    store.mutate((draft) => {
      draft.people = [...draft.people, newPerson];
    });

    // setState(store.prune(process));
  };

  return (
    <div>
      <button onClick={handleSort}>
        Sort by Name ({sortOrder === 'asc' ? 'Ascending' : 'Descending'})
      </button>{' '}
      <button onClick={handleAdd}>Add person</button>
      <ul>
        {state.people.get(Revision.Draft).map((person: any) => {
          const isDeleting = person.is(Operation.Remove);
          const isUpdating = person.is(Operation.Update);
          const isAdding = person.is(Operation.Add);

          // When viewing Draft revision, get Current for comparison
          const currentPerson = person.get(Revision.Current);
          const currentName = currentPerson?.name.get() ?? person.name.get();
          const currentAge = currentPerson?.age.get() ?? person.age.get();

          // Draft values
          const draftName = person.name.get();
          const draftAge = person.age.get();

          return (
            <li
              key={person.id.get().toString()}
              style={{ opacity: isDeleting ? 0.5 : isUpdating || isAdding ? 0.7 : 1 }}
            >
              {isAdding ? (
                <>
                  Adding: {draftName} - {draftAge}{' '}
                  <button disabled>Refresh</button> <button disabled>Delete</button>
                </>
              ) : isDeleting ? (
                <>
                  {currentName} - {currentAge}{' '}
                  <button disabled>Refresh</button>{' '}
                  <button disabled>Deleting...</button>
                </>
              ) : (
                <>
                  {currentName} - {currentAge}
                  {isUpdating && (
                    <span style={{ color: '#666', marginLeft: '8px' }}>
                      ({draftName} - {draftAge})
                    </span>
                  )}{' '}
                  <button
                    onClick={() => handleRefresh(person.id.get())}
                    disabled={isDeleting || isUpdating}
                  >
                    {isUpdating ? 'Refreshing...' : 'Refresh'}
                  </button>{' '}
                  <button onClick={() => handleDelete(person.id.get())} disabled={isDeleting}>
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
