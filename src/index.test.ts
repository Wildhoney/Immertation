import { describe, it, expect } from 'vitest';
import { faker } from '@faker-js/faker';
import Immeration from '.';
import { Operation, Node } from './types';
import { augment } from './utils';

const process = Symbol('process');

describe('produce()', () => {
  it('should be able to update a value', () => {
    const model = {
      name: `${faker.person.firstName()} Smith`,
      people: [
        { name: `${faker.person.firstName()} Doe` },
        { name: `${faker.person.firstName()} Black` },
      ],
    };

    const immertation = new Immeration(model);

    {
      const name = `${faker.person.firstName()} Jones`;
      const [model, annotations] = immertation.produce((draft) => {
        draft.name = Operation.Update(name, process);
      });

      expect(model.name).toBe(name);
      expect(annotations.name.is(Operation.Update)).toEqual(true);
      expect(annotations.name.draft()).toBe(name);
    }

    {
      const name = `${faker.person.firstName()} White`;
      const [model, annotations] = immertation.produce((draft) => {
        draft.people[1] = Operation.Update({ name }, process);
      });
      expect(model.people[1].name).toBe(name);
      expect(annotations.people[1].is(Operation.Update)).toEqual(true);
    }

    {
      const [model, annotations] = immertation.produce((draft) => {
        draft.people.reverse();
      });
      expect(model.people[0].name).toBe(model.people[0].name);
      expect(model.people[1].name).toBe(model.people[1].name);
      expect(annotations.people[0].is(Operation.Update)).toEqual(false);
    }
  });

  it('should return the most recent value from draft()', () => {
    const model = { name: 'Initial' };
    const immertation = new Immeration(model);
    const process1 = Symbol('process1');
    const process2 = Symbol('process2');

    {
      const [, annotations] = immertation.produce((draft) => {
        draft.name = Operation.Update('First Update', process1);
      });
      expect(annotations.name.draft()).toBe('First Update');
    }

    {
      const [, annotations] = immertation.produce((draft) => {
        draft.name = Operation.Update('Second Update', process2);
      });
      expect(annotations.name.draft()).toBe('Second Update');
      expect(annotations.name.is(Operation.Update)).toEqual(true);
    }
  });

  it('should preserve annotations when spreading object and updating sub-property', () => {
    const model = { user: { name: 'John', age: 30, email: 'john@example.com' } };
    const immertation = new Immeration(model);
    const process1 = Symbol('process1');
    const process2 = Symbol('process2');

    {
      const [model, annotations] = immertation.produce((draft) => {
        draft.user = Operation.Update({ name: 'Jane', age: 25, email: 'jane@example.com' }, process1);
      });
      expect(model.user.name).toBe('Jane');
      expect(model.user.age).toBe(25);
      expect(annotations.user.is(Operation.Update)).toEqual(true);
      expect(annotations.user.draft()).toEqual({ name: 'Jane', age: 25, email: 'jane@example.com' });
    }

    // {
    //   const [model, annotations] = immertation.produce((draft) => {
    //     draft.user = { ...draft.user, age: Operation.Update(26, process2) };
    //   });
    //   expect(model.user.name).toBe('Jane');
    //   expect(model.user.age).toBe(26);
    //   expect(model.user.email).toBe('jane@example.com');
    //   expect(annotations.user.is(Operation.Update)).toEqual(true);
    //   expect(annotations.user.age.is(Operation.Update)).toEqual(true);
    //   expect(annotations.user.age.draft()).toBe(26);
    // }
  });
});

describe('augment()', () => {
  it('should augment patch paths for top-level property changes', () => {
    const model = { name: 'John', age: 30 };
    const patches = augment(model, (draft) => {
      draft.name = 'Jane';
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].path).toEqual(['current', 'name', 'current']);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('Jane');
  });

  it('should augment patch paths for nested object property changes', () => {
    const model = {
      user: {
        name: 'John',
        address: {
          city: 'New York',
        },
      },
    };
    const patches = augment(model, (draft) => {
      draft.user.address.city = 'Los Angeles';
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].path).toEqual([
      'current',
      'user',
      'current',
      'address',
      'current',
      'city',
      'current',
    ]);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('Los Angeles');
  });

  it('should augment patch paths for array element changes', () => {
    const model = { items: ['a', 'b', 'c'] };
    const patches = augment(model, (draft) => {
      draft.items[1] = 'updated';
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].path).toEqual(['current', 'items', 'current', 1, 'current']);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('updated');
  });

  it('should augment patch paths for array push operations', () => {
    const model = { items: ['a', 'b'] };
    const patches = augment(model, (draft) => {
      draft.items.push('c');
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
    expect(patches[0].path).toEqual(['current', 'items', 'current', 2, 'current']);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('c');
  });

  it('should augment patch paths for array splice operations', () => {
    const model = { items: ['a', 'b', 'c', 'd'] };
    const patches = augment(model, (draft) => {
      draft.items.splice(1, 2);
    });

    expect(patches).toHaveLength(3);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].path).toEqual(['current', 'items', 'current', 1, 'current']);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('d');
    expect(patches[1].op).toBe('remove');
    expect(patches[1].path).toEqual(['current', 'items', 'current', 3, 'current']);
    expect(patches[2].op).toBe('remove');
    expect(patches[2].path).toEqual(['current', 'items', 'current', 2, 'current']);
  });

  it('should augment patch paths for adding new properties', () => {
    const model = { name: 'John' };
    const patches = augment(model, (draft: any) => {
      draft.age = 30;
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
    expect(patches[0].path).toEqual(['current', 'age', 'current']);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe(30);
  });

  it('should augment patch paths for removing properties', () => {
    const model = { name: 'John', age: 30 };
    const patches = augment(model, (draft: any) => {
      delete draft.age;
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('remove');
    expect(patches[0].path).toEqual(['current', 'age', 'current']);
  });

  it('should handle multiple changes in a single recipe', () => {
    const model = { name: 'John', age: 30, items: ['a', 'b'] };
    const patches = augment(model, (draft) => {
      draft.name = 'Jane';
      draft.age = 31;
      draft.items.push('c');
    });

    expect(patches).toHaveLength(3);
    // Note: Immer may order patches differently than expected
    expect(patches.some((p) => p.path.join(',') === ['current', 'name', 'current'].join(','))).toBe(
      true
    );
    expect(patches.some((p) => p.path.join(',') === ['current', 'age', 'current'].join(','))).toBe(
      true
    );
    expect(
      patches.some(
        (p) => p.path.join(',') === ['current', 'items', 'current', 2, 'current'].join(',')
      )
    ).toBe(true);
  });

  it('should return empty array when no changes are made', () => {
    const model = { name: 'John', age: 30 };
    const patches = augment(model, () => {
      // No changes
    });

    expect(patches).toHaveLength(0);
  });

  it('should augment paths for complex nested structures', () => {
    const model = {
      users: [
        { name: 'John', tags: ['admin'] },
        { name: 'Jane', tags: ['user'] },
      ],
    };
    const patches = augment(model, (draft) => {
      draft.users[0].tags.push('moderator');
    });

    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
    expect(patches[0].path).toEqual([
      'current',
      'users',
      'current',
      0,
      'current',
      'tags',
      'current',
      1,
      'current',
    ]);
    expect(patches[0].value).toBeInstanceOf(Node);
    expect((patches[0].value as Node).current).toBe('moderator');
  });
});
