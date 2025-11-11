import { faker } from '@faker-js/faker';
import { describe, expect, it, vi } from 'vitest';
import { State, Operation, Event } from '.';
import { A } from '@mobily/ts-belt';

function friends() {
  return A.makeWithIndex(3, () => faker.person.firstName()) as string[];
}

describe('mutate()', () => {
  const process = Symbol('process');

  describe('object', () => {
    type Model = {
      name: string;
      age: number;
    };

    /**
     * Tests that direct assignment of primitives to object properties updates the model
     * without creating pending operations in the inspection API.
     */
    it('using assignment with primitives', () => {
      faker.seed(1);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        state.mutate((draft) => void (draft.name = name));

        expect(state.model.name).toEqual(name);
        expect(state.inspect.name.pending()).toBe(false);
        expect(state.inspect.name.draft()).toEqual(name);
        expect(state.inspect.age.draft()).toEqual(initial.age);
      }
    });

    /**
     * Tests that wrapping values in Operation.Update or Operation.Replace marks them
     * as pending and allows inspection of their operation type and draft state.
     */
    it('using assignment with operations', () => {
      faker.seed(2);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        state.mutate((draft) => void (draft.name = Operation.Update(name, process)));

        expect(state.model.name).toEqual(name);
        expect(state.inspect.name.pending()).toBe(true);
        expect(state.inspect.name.is(Operation.Update)).toBe(true);
        expect(state.inspect.name.is(Operation.Replace)).toBe(false);
        expect(state.inspect.name.draft()).toEqual(name);
      }

      {
        const name = faker.person.firstName() + '!';
        state.mutate((draft) => void (draft.name = Operation.Replace(name, process)));

        expect(state.model.name).toEqual(name);
        expect(state.inspect.name.pending()).toBe(true);
        expect(state.inspect.name.is(Operation.Update)).toBe(true);
        expect(state.inspect.name.is(Operation.Replace)).toBe(true);
        expect(state.inspect.name.draft()).toEqual(name);
      }
    });

    /**
     * Tests that Operation.Custom allows defining arbitrary event combinations
     * and that the inspection API correctly identifies the custom events.
     */
    it('using assignment with custom operations', () => {
      faker.seed(3);

      const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
      const state = new State<Model>(initial);

      const name = faker.person.firstName() + '!';
      state.mutate(
        (draft) => void (draft.name = Operation.Custom(name, [Event.Add, Event.Update], process))
      );

      expect(state.model.name).toEqual(name);
      expect(state.inspect.name.pending()).toBe(true);
      expect(state.inspect.name.is(Operation.Add)).toBe(true);
      expect(state.inspect.name.is(Operation.Update)).toBe(true);
      expect(state.inspect.name.is(Operation.Replace)).toBe(false);
      expect(state.inspect.name.draft()).toEqual(name);
    });
  });

  describe('array', () => {
    type Model = {
      friends: string[];
    };

    /**
     * Tests that assigning Operation-wrapped values to specific array indices
     * marks only those indices as pending while leaving others untouched.
     */
    it('using assignment with operations', () => {
      faker.seed(8);

      const initial = { friends: friends() };
      const state = new State<Model>(initial);

      {
        const names = [faker.person.firstName() + '!', faker.person.firstName() + '?'] as const;
        state.mutate((draft) => {
          draft.friends[0] = Operation.Update(names[0], process);
          draft.friends[2] = Operation.Update(names[1], process);
        });

        expect(state.model.friends).toEqual([names[0], initial.friends[1], names[1]]);

        expect(state.inspect.friends[0].pending()).toBe(true);
        expect(state.inspect.friends[1].pending()).toBe(false);
        expect(state.inspect.friends[2].pending()).toBe(true);

        expect(state.inspect.friends[0].is(Operation.Update)).toBe(true);
        expect(state.inspect.friends[1].is(Operation.Update)).toBe(false);
        expect(state.inspect.friends[2].is(Operation.Update)).toBe(true);

        expect(state.inspect.friends[0].draft()).toEqual(names[0]);
        expect(state.inspect.friends[2].draft()).toEqual(names[1]);
      }
    });

    /**
     * Tests that pushing primitive values onto arrays adds them without creating
     * pending operations, treating them as regular array additions.
     */
    it('using push with primitives', () => {
      faker.seed(3);

      const initial = {
        friends: friends(),
      };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName();
        state.mutate((draft) => {
          draft.friends.push(name);
        });

        expect(state.model.friends).toEqual([...initial.friends, name]);
        expect(state.model.friends.length).toBe(initial.friends.length + 1);
        expect(state.inspect.friends.pending()).toBe(false);
      }
    });

    /**
     * Tests that pushing Operation.Add-wrapped values marks only the new element
     * as pending while existing elements remain non-pending.
     */
    it('using push with operations', () => {
      faker.seed(4);

      const initial = {
        friends: friends(),
      };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName();
        state.mutate((draft) => {
          draft.friends.push(Operation.Add(name, process));
        });

        expect(state.model.friends).toEqual([...initial.friends, name]);

        expect(state.inspect.friends[0].pending()).toBe(false);
        expect(state.inspect.friends[1].pending()).toBe(false);
        expect(state.inspect.friends[2].pending()).toBe(false);
        expect(state.inspect.friends[3].pending()).toBe(true);

        expect(state.inspect.friends[0].is(Operation.Add)).toBe(false);
        expect(state.inspect.friends[1].is(Operation.Add)).toBe(false);
        expect(state.inspect.friends[2].is(Operation.Add)).toBe(false);
        expect(state.inspect.friends[3].is(Operation.Add)).toBe(true);

        expect(state.inspect.friends[3].draft()).toEqual(name);
      }
    });

    /**
     * Tests that assigning a sorted array without Operation wrapping performs
     * a simple replacement without tracking the sort operation.
     */
    it('using sort with primitives', () => {
      faker.seed(5);

      const initial = {
        friends: friends(),
      };
      const state = new State<Model>(initial);

      {
        state.mutate((draft) => void (draft.friends = [...draft.friends].sort()));

        expect(state.model.friends).toMatchSnapshot();
      }
    });

    /**
     * Tests that Operation.Sort tracks array reordering while preserving annotations
     * on individual elements through position changes and subsequent updates.
     */
    it('using sort with operations', () => {
      faker.seed(6);

      const initial = {
        friends: [
          faker.person.firstName(),
          faker.person.firstName() + '!',
          faker.person.firstName(),
        ],
      };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        const index = initial.friends.findIndex((friend) => friend.endsWith('!'));
        state.mutate((draft) => {
          draft.friends[index] = Operation.Update(name, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(state.model.friends).toMatchSnapshot();
        expect(state.inspect.friends.pending()).toBe(true);
        expect(state.inspect.friends.is(Operation.Sort)).toBe(true);
      }

      {
        const name = faker.person.firstName() + '?';
        state.mutate((draft) => {
          const index = draft.friends.findIndex((friend) => friend.endsWith('!'));
          draft.friends[index] = Operation.Replace(name, process);
        });

        expect(state.model.friends).toMatchSnapshot();

        const friend = state.model.friends.findIndex((friend) => friend.endsWith('?'));
        const index = state.inspect.friends[friend];
        expect(index.pending()).toBe(true);
        expect(index.is(Operation.Update)).toBe(true);
        expect(index.is(Operation.Replace)).toBe(true);
        expect(index.draft()).toEqual(name);
      }
    });

    /**
     * Tests that Operation.Sort correctly handles arrays with duplicate values,
     * ensuring annotations are preserved even when identical values are reordered.
     */
    it('using sort with operations and duplicate items', () => {
      faker.seed(7);

      const name = faker.person.firstName();
      const initial = {
        friends: [name, name, faker.person.firstName()],
      };
      const state = new State<Model>(initial);

      {
        const name = faker.person.firstName() + '!';
        state.mutate((draft) => {
          draft.friends[1] = Operation.Update(name, process);
          draft.friends = Operation.Sort([...draft.friends].sort(), process);
        });

        expect(state.model.friends).toMatchSnapshot();
        expect(state.inspect.friends.pending()).toBe(true);
        expect(state.inspect.friends.is(Operation.Sort)).toBe(true);
      }
    });

    /**
     * Tests that annotations follow values (not indices) when arrays are replaced,
     * so an annotated value keeps its annotation even when moved to a different index.
     */
    it('array replacement with value-based tracking', () => {
      faker.seed(10);

      const initial = {
        friends: ['Alice', 'Bob', 'Charlie'],
      };
      const state = new State<Model>(initial);

      // Add operations to individual items
      state.mutate((draft) => {
        draft.friends[0] = Operation.Update('Alice-Updated', process);
        draft.friends[2] = Operation.Update('Charlie-Updated', process);
      });

      // Replace entire array - Alice-Updated moves from index 0 to index 2
      state.mutate((draft) => {
        draft.friends = ['David', 'Eve', 'Alice-Updated', 'Frank'];
      });

      expect(state.model.friends).toEqual(['David', 'Eve', 'Alice-Updated', 'Frank']);

      // Value-based tracking: annotations follow values, not indices
      expect(state.inspect.friends[0].pending()).toBe(false); // David is new, no annotation
      expect(state.inspect.friends[1].pending()).toBe(false); // Eve is new, no annotation
      expect(state.inspect.friends[2].pending()).toBe(true); // Alice-Updated keeps its annotation
      expect(state.inspect.friends[2].is(Operation.Update)).toBe(true);
      expect(state.inspect.friends[3].pending()).toBe(false); // Frank is new, no annotation
    });

    /**
     * Tests that value-based tracking works correctly even after sorting,
     * with annotations being lost when values are completely replaced.
     */
    it('array replacement after sort - annotations follow values through sort', () => {
      faker.seed(11);

      const initial = {
        friends: ['Zoe', 'Alice', 'Mike'],
      };
      const state = new State<Model>(initial);

      // Add operations to specific items BEFORE sorting
      // Zoe at index 0, Alice at index 1, Mike at index 2
      state.mutate((draft) => {
        draft.friends[0] = Operation.Update('Zoe-Updated', process); // Zoe gets annotation
        draft.friends[2] = Operation.Update('Mike-Updated', process); // Mike gets annotation
      });

      // Sort the array (using Operation.Sort to track it)
      state.mutate((draft) => {
        draft.friends = Operation.Sort([...draft.friends].sort(), process);
      });

      // After sort: ['Alice', 'Mike-Updated', 'Zoe-Updated']
      expect(state.model.friends).toEqual(['Alice', 'Mike-Updated', 'Zoe-Updated']);

      // Now replace the entire array with new values
      state.mutate((draft) => {
        draft.friends = ['Bob', 'Carol', 'Dave'];
      });

      // With value-based tracking, new values get no annotations
      expect(state.model.friends).toEqual(['Bob', 'Carol', 'Dave']);

      // Value-based tracking: Bob, Carol, and Dave are all new values that don't match
      // any values in the sorted array, so they get no annotations
      expect(state.inspect.friends[0].pending()).toBe(false); // Bob is new
      expect(state.inspect.friends[1].pending()).toBe(false); // Carol is new
      expect(state.inspect.friends[2].pending()).toBe(false); // Dave is new
    });

    /**
     * Tests that providing a custom identity function allows annotations to follow
     * objects by ID rather than reference equality when arrays are reordered.
     */
    it('array replacement with object identity function', () => {
      faker.seed(12);

      type Model = { people: { id: number; name: string }[] };

      const initial: Model = {
        people: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ],
      };

      const state = new State<Model>(initial, (value: any) => {
        if (typeof value === 'object' && value && 'id' in value) {
          return value.id;
        }
      });

      // Add operations to specific people
      state.mutate((draft) => {
        draft.people[0] = Operation.Update({ id: 1, name: 'Alice-Updated' }, process);
        draft.people[2] = Operation.Update({ id: 3, name: 'Charlie-Updated' }, process);
      });

      expect(state.inspect.people[0].pending()).toBe(true);
      expect(state.inspect.people[1].pending()).toBe(false);
      expect(state.inspect.people[2].pending()).toBe(true);

      // Replace array - reorder people
      state.mutate((draft) => {
        draft.people = [
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie-Updated' },
          { id: 1, name: 'Alice-Updated' },
        ];
      });

      expect(state.model.people).toEqual([
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie-Updated' },
        { id: 1, name: 'Alice-Updated' },
      ]);

      // Annotations follow objects by their ID, not by index
      expect(state.inspect.people[0].pending()).toBe(false); // Bob (id: 2) has no annotation
      expect(state.inspect.people[1].pending()).toBe(true); // Charlie-Updated (id: 3) keeps annotation
      expect(state.inspect.people[1].is(Operation.Update)).toBe(true);
      expect(state.inspect.people[2].pending()).toBe(true); // Alice-Updated (id: 1) keeps annotation
      expect(state.inspect.people[2].is(Operation.Update)).toBe(true);
    });

    /**
     * Tests that replacing an array with completely different values discards
     * all existing annotations since no values match between old and new arrays.
     */
    it('array replacement with completely new values - no annotations preserved', () => {
      faker.seed(13);

      const initial = {
        friends: ['Alice', 'Bob', 'Charlie'],
      };
      const state = new State<Model>(initial);
      const process = Symbol('process');

      state.mutate((draft) => {
        draft.friends[0] = Operation.Update('Alice-Updated', process);
        draft.friends[2] = Operation.Update('Charlie-Updated', process);
      });

      expect(state.inspect.friends[0].pending()).toBe(true);
      expect(state.inspect.friends[2].pending()).toBe(true);

      state.mutate((draft) => {
        draft.friends = ['David', 'Eve', 'Frank'];
      });

      expect(state.model.friends).toEqual(['David', 'Eve', 'Frank']);
      expect(state.inspect.friends[0].pending()).toBe(false);
      expect(state.inspect.friends[1].pending()).toBe(false);
      expect(state.inspect.friends[2].pending()).toBe(false);
    });

    /**
     * Tests that replacing an entire object discards all annotations because
     * the new object has different values for all annotated properties.
     */
    it('object replacement - annotations preserved only when values match', () => {
      type Model = {
        user: {
          name: string;
          age: number;
          email: string;
        };
      };

      const initial = {
        user: {
          name: 'Alice',
          age: 30,
          email: 'alice@example.com',
        },
      };
      const state = new State<Model>(initial);
      const process = Symbol('process');

      state.mutate((draft) => {
        draft.user.name = Operation.Update('Alice-Updated', process);
        draft.user.age = Operation.Update(31, process);
      });

      expect(state.model.user.name).toBe('Alice-Updated');
      expect(state.model.user.age).toBe(31);
      expect(state.inspect.user.name.pending()).toBe(true);
      expect(state.inspect.user.age.pending()).toBe(true);

      state.mutate((draft) => {
        draft.user = {
          name: 'Bob',
          age: 25,
          email: 'bob@example.com',
        };
      });

      expect(state.model.user.name).toBe('Bob');
      expect(state.model.user.age).toBe(25);
      expect(state.inspect.user.name.pending()).toBe(false);
      expect(state.inspect.user.age.pending()).toBe(false);
    });

    /**
     * Tests that replacing an object preserves annotations on properties whose
     * values remain the same while discarding annotations on changed properties.
     */
    it('object replacement - annotations preserved when value matches', () => {
      type Model = {
        user: {
          name: string;
          age: number;
        };
      };

      const initial = {
        user: {
          name: 'Alice',
          age: 30,
        },
      };
      const state = new State<Model>(initial);
      const process = Symbol('process');

      state.mutate((draft) => {
        draft.user.name = Operation.Update('Alice', process);
      });

      expect(state.inspect.user.name.pending()).toBe(true);

      state.mutate((draft) => {
        draft.user = {
          name: 'Alice',
          age: 31,
        };
      });

      expect(state.model.user.name).toBe('Alice');
      expect(state.model.user.age).toBe(31);
      expect(state.inspect.user.name.pending()).toBe(true);
      expect(state.inspect.user.age.pending()).toBe(false);
    });

    /**
     * Tests that updating an element and sorting the array in a single mutation
     * correctly tracks the annotation through the sort operation.
     */
    it('update and sort in same mutate - annotation preserved', () => {
      faker.seed(15);

      const initial = {
        friends: ['Zoe', 'Alice', 'Mike'],
      };
      const state = new State<Model>(initial);
      const process = Symbol('process');

      state.mutate((draft) => {
        draft.friends[0] = Operation.Update('Zoe-Updated', process);
        draft.friends.sort();
      });

      expect(state.model.friends).toEqual(['Alice', 'Mike', 'Zoe-Updated']);
      expect(state.inspect.friends[0].pending()).toBe(false);
      expect(state.inspect.friends[1].pending()).toBe(false);
      expect(state.inspect.friends[2].pending()).toBe(true);
    });

    /**
     * Tests that without a custom identity function, annotations on objects are
     * preserved through structural equality (F.equals) rather than reference equality.
     */
    it('array of objects without identity function - annotations preserved via F.equals', () => {
      faker.seed(16);

      type Model = { people: { id: number; name: string }[] };

      const initial: Model = {
        people: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };

      // No identity function provided - falls back to F.equals for structural comparison
      const state = new State<Model>(initial);
      const process = Symbol('process');

      state.mutate((draft) => {
        draft.people[0] = Operation.Update({ id: 1, name: 'Alice-Updated' }, process);
      });

      expect(state.inspect.people[0].pending()).toBe(true);

      // Replace array with structurally identical object (different reference)
      state.mutate((draft) => {
        draft.people = [
          { id: 1, name: 'Alice-Updated' },
          { id: 2, name: 'Bob' },
        ];
      });

      // Annotation IS preserved via F.equals structural comparison
      expect(state.inspect.people[0].pending()).toBe(true);
      expect(state.inspect.people[1].pending()).toBe(false);
    });
  });
});

describe('prune()', () => {
  type Model = {
    name: string;
    age: number;
  };

  /**
   * Tests that calling prune() with a specific process symbol removes only
   * the annotations associated with that process, leaving others intact.
   */
  it('prunes tasks by process', () => {
    faker.seed(9);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const processes = [Symbol('process1'), Symbol('process2')] as const;

    const newName = faker.person.firstName();
    state.mutate((draft) => void (draft.name = Operation.Update(newName, processes[0])));

    const newAge = faker.number.int(100);
    state.mutate((draft) => void (draft.age = Operation.Update(newAge, processes[1])));

    state.prune(processes[0]);

    expect(state.model.name).toEqual(newName);
    expect(state.model.age).toEqual(newAge);

    expect(state.inspect.name.pending()).toBe(false);
    expect(state.inspect.name.is(Operation.Update)).toBe(false);

    expect(state.inspect.age.pending()).toBe(true);
    expect(state.inspect.age.is(Operation.Update)).toBe(true);
    expect(state.inspect.age.draft()).toEqual(newAge);
  });
});

describe('listen()', () => {
  type Model = {
    name: string;
    age: number;
  };

  /**
   * Tests that a registered listener is called when mutate() updates the model
   * and receives the correct State instance with the updated model.
   */
  it('invokes listener on mutate', () => {
    faker.seed(20);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const name = faker.person.firstName();

    expect.assertions(1);

    state.listen((state) => {
      expect(state.model.name).toBe(name);
    });

    state.mutate((draft) => void (draft.name = name));
  });

  /**
   * Tests that a registered listener is called when prune() removes annotations
   * and receives the correct State instance.
   */
  it('invokes listener on prune', () => {
    faker.seed(21);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const process = Symbol('process');
    const name = faker.person.firstName();

    expect.assertions(2);

    state.mutate((draft) => void (draft.name = Operation.Update(name, process)));

    state.listen((state) => {
      expect(state.model.name).toBe(name);
      expect(state.inspect.name.pending()).toBe(false);
    });

    state.prune(process);
  });

  /**
   * Tests that multiple listeners can be registered and all are invoked
   * when the state changes.
   */
  it('supports multiple listeners', () => {
    faker.seed(22);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();

    state.listen(listener1);
    state.listen(listener2);
    state.listen(listener3);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));

    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);

    state.mutate((draft) => void (draft.age = faker.number.int(100)));

    expect(listener1).toHaveBeenCalledTimes(2);
    expect(listener2).toHaveBeenCalledTimes(2);
    expect(listener3).toHaveBeenCalledTimes(2);
  });

  /**
   * Tests that the unsubscribe function returned by listen() correctly
   * removes the listener so it no longer receives updates.
   */
  it('unsubscribe removes listener', () => {
    faker.seed(23);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener = vi.fn();

    const unsubscribe = state.listen(listener);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });

  /**
   * Tests that unsubscribing one listener doesn't affect other listeners.
   */
  it('unsubscribing one listener does not affect others', () => {
    faker.seed(24);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);

    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsubscribe1 = state.listen(listener1);
    state.listen(listener2);

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);

    unsubscribe1();

    state.mutate((draft) => void (draft.name = faker.person.firstName()));
    expect(listener1).toHaveBeenCalledTimes(1); // Not called again
    expect(listener2).toHaveBeenCalledTimes(2); // Still called
  });

  /**
   * Tests that listeners can access both model and inspect proxy
   * through the received State instance.
   */
  it('listener can access model and inspect', () => {
    faker.seed(25);

    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const state = new State<Model>(initial);
    const process = Symbol('process');
    const name = faker.person.firstName();

    expect.assertions(2);

    state.listen((state) => {
      expect(state.model.name).toBe(name);
      expect(state.inspect.name.pending()).toBe(true);
    });

    state.mutate((draft) => void (draft.name = Operation.Update(name, process)));
  });
});
