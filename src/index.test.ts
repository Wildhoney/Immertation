import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { Immeration, Operation, Revision } from '.';
import { A, D } from '@mobily/ts-belt';

type Model = {
  name: string;
  age: number;
};

describe('mutate()', () => {
  const process = Symbol('process');

  it('updates using persistent value', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = name;
      });

      expect(model.name.get()).toEqual(name);
      expect(model.name.get(Revision.Current)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
    }

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = name;
      });

      expect(model.name.get()).toEqual(name);
      expect(model.name.get(Revision.Current)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
    }
  });

  it('updates using operation', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = Operation.Update(name, process);
      });

      expect(model.name.get()).toEqual(initial.name);
      expect(model.name.get(Revision.Current)).toEqual(initial.name);
      expect(model.name.get(Revision.Draft)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(true);
      expect(model.name.is(Operation.Replace)).toBe(false);
      expect(model.name.is(Operation.Add)).toBe(false);
      expect(model.name.is(Operation.Remove)).toBe(false);
    }

    {
      const name = faker.person.firstName() + '!';
      const model = instance.mutate((draft) => {
        draft.name = Operation.Replace(name, process);
      });

      expect(model.name.get()).toEqual(initial.name);
      expect(model.name.get(Revision.Current)).toEqual(initial.name);
      expect(model.name.get(Revision.Draft)).toEqual(name);

      expect(model.name.is(Operation.Update)).toBe(true);
      expect(model.name.is(Operation.Replace)).toBe(true);
      expect(model.name.is(Operation.Add)).toBe(false);
      expect(model.name.is(Operation.Remove)).toBe(false);
    }
  });

  it('updates when adding items', () => {
    const initial = {
      name: faker.person.firstName(),
      friends: [{ name: faker.person.firstName() }, { name: faker.person.firstName() }],
    };
    const instance = new Immeration(initial);

    const friend = faker.person.firstName() + '!';
    const model = instance.mutate((draft) => {
      draft.friends = [...draft.friends, Operation.Add({ name: friend }, process)];
    });

    const current = model.friends.get(Revision.Current);
    expect(current.length).toEqual(2);
    expect(current[0]).toEqual(initial.friends[0]);
    expect(current[1]).toEqual(initial.friends[1]);

    const draft = model.friends.get(Revision.Draft);
    expect(draft.length).toEqual(3);
    expect(draft[0]).toEqual(initial.friends[0]);
    expect(draft[1]).toEqual(initial.friends[1]);
    expect(draft[2]).toEqual({ name: friend });
  });

  it('updates when removing items from arrays', () => {
    const initial = {
      name: faker.person.firstName(),
      friends: [
        { name: faker.person.firstName() },
        { name: faker.person.firstName() },
        { name: faker.person.firstName() },
      ],
    };
    const instance = new Immeration(initial);

    {
      const model = instance.mutate((draft) => {
        draft.friends = [
          draft.friends[0],
          Operation.Remove(draft.friends[1], process),
          draft.friends[2],
        ];
      });

      const current = model.friends.get(Revision.Current);
      expect(current.length).toEqual(3);
      expect(current[0]).toEqual(initial.friends[0]);
      expect(current[1]).toEqual(initial.friends[1]);
      expect(current[2]).toEqual(initial.friends[2]);

      const draft = model.friends.get(Revision.Draft);
      expect(draft.length).toEqual(2);
      expect(draft[0]).toEqual(initial.friends[0]);
      expect(draft[1]).toEqual(initial.friends[2]);
    }

    {
      const model = instance.mutate((draft) => {
        draft.friends = draft.friends.filter((_, index) => index !== 1);
      });

      const current = model.friends.get(Revision.Current);
      expect(current.length).toEqual(2);
      expect(current[0]).toEqual(initial.friends[0]);
      expect(current[1]).toEqual(initial.friends[2]);

      const draft = model.friends.get(Revision.Draft);
      expect(draft.length).toEqual(2);
      expect(draft[0]).toEqual(initial.friends[0]);
      expect(draft[1]).toEqual(initial.friends[2]);
    }
  });

  it('updates when removing items from objects', () => {
    type Model = {
      name: string;
      profile: {
        email: string;
        phone?: string;
        address: string;
      };
    };

    const initial: Model = {
      name: faker.person.firstName(),
      profile: {
        email: faker.internet.email(),
        phone: faker.phone.number(),
        address: faker.location.streetAddress(),
      },
    };
    const instance = new Immeration<Model>(initial);

    {
      const model = instance.mutate((draft) => {
        draft.profile = {
          email: draft.profile.email,
          phone: Operation.Remove(draft.profile.phone, process),
          address: draft.profile.address,
        };
      });

      const current = model.profile.get(Revision.Current);
      expect(current).toHaveProperty('email', initial.profile.email);
      expect(current).toHaveProperty('phone', initial.profile.phone);
      expect(current).toHaveProperty('address', initial.profile.address);

      const draft = model.profile.get(Revision.Draft);
      expect(draft).toHaveProperty('email', initial.profile.email);
      expect(draft).not.toHaveProperty('phone');
      expect(draft).toHaveProperty('address', initial.profile.address);
    }

    {
      const model = instance.mutate((draft) => {
        draft.profile = D.deleteKey(draft.profile, 'phone');
      });

      const current = model.profile.get(Revision.Current);
      expect(current).toHaveProperty('email', initial.profile.email);
      expect(current).not.toHaveProperty('phone');
      expect(current).toHaveProperty('address', initial.profile.address);

      const draft = model.profile.get(Revision.Draft);
      expect(draft).toHaveProperty('email', initial.profile.email);
      expect(draft).not.toHaveProperty('phone');
      expect(draft).toHaveProperty('address', initial.profile.address);
    }
  });

  it('preserves null and undefined values in arrays', () => {
    const initial = { values: [1, null, undefined, 4] };
    const instance = new Immeration(initial);

    const model = instance.mutate((draft) => {
      draft.values = [...draft.values, Operation.Add(5, process)];
    });

    const current = model.values.get(Revision.Current);
    expect(current.length).toEqual(4);
    expect(current[0]).toEqual(1);
    expect(current[1]).toBeNull();
    expect(current[2]).toBeUndefined();
    expect(current[3]).toEqual(4);

    const draft = model.values.get(Revision.Draft);
    expect(draft.length).toEqual(5);
    expect(draft[4]).toEqual(5);
  });
});

describe('prune()', () => {
  it('prunes records by process', () => {
    const initial = { name: faker.person.firstName(), age: faker.number.int(100) };
    const instance = new Immeration<Model>(initial);
    const processes = [Symbol('process1'), Symbol('process2')] as const;

    instance.mutate((draft) => {
      draft.name = Operation.Update(faker.person.firstName(), A.getUnsafe(processes, 0));
    });

    instance.mutate((draft) => {
      draft.age = Operation.Update(faker.number.int(100), A.getUnsafe(processes, 1));
    });

    const model = instance.prune(A.getUnsafe(processes, 0));

    expect(model.name.is(Operation.Update)).toBe(false);
    expect(model.age.is(Operation.Update)).toBe(true);
  });
});
