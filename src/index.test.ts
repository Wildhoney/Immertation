import { faker } from '@faker-js/faker';
import { Op, State } from '.';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from './types';
import { primitive } from './utils';

describe('State', () => {
  type Model = {
    name: {
      first: string;
      last: string;
    };
    age: number;
    locations: { id: string; name: string }[];
  };

  const model = {
    name: {
      first: faker.person.firstName(),
      last: faker.person.lastName(),
    },
    age: faker.number.int({ min: 1, max: 100 }),
    locations: Array.from({ length: 3 }, () => ({
      id: State.pk(),
      name: faker.location.city(),
    })),
  } satisfies Model;

  function identity(snapshot: Snapshot<Model>): string {
    if ('id' in snapshot) return snapshot.id;
    if ('first' in snapshot) return snapshot.first + ' ' + snapshot.last;
    if (Array.isArray(snapshot)) return snapshot.map((item) => item.id).join(',');
    return JSON.stringify(snapshot);
  }

  it('updates name + age', () => {
    const state = new State<Model>(model, identity);

    state.mutate((draft) => {
      draft.name.first = model.name.first + '!';
      draft.age += 1;
    });
    expect(state.model.name.first).toBe(model.name.first + '!');
    expect(state.model.age).toBe(model.age + 1);
    expect(state.inspect.name.first.pending()).toBe(false);
    expect(state.inspect.age.pending()).toBe(false);

    {
      const name = faker.person.firstName();
      state.mutate((draft) => {
        draft.name = State.annotate({ first: 'A', last: State.annotate('T', Op.Update) }, Op.Update);
        draft.name.first = State.annotate(name, Op.Update);
        draft.age += 1;
      });

      expect(state.model.name.first).toBe(model.name.first + '!');
      expect(state.model.age).toBe(model.age + 2);
      expect(state.inspect.name.pending()).toBe(true);
      expect(state.inspect.name.first.pending()).toBe(true);
      expect(state.inspect.name.last.pending()).toBe(true);
      expect(state.inspect.age.pending()).toBe(false);
    }
  });

  it('updates locations', () => {
    const state = new State<Model>(model, identity);
    const id = model.locations[1].id;

    state.mutate((draft) => {
      const city = faker.location.city();
      const index = draft.locations.findIndex((location) => location.id === id);
      draft.locations[index].name = State.annotate(city, Op.Update);
    });
    expect(state.model.locations[1].name).toBe(model.locations[1].name);
    expect(state.inspect.locations[1].name.pending()).toBe(true);

    const city = faker.location.city();
    state.mutate((draft) => {
      draft.locations.sort();
      draft.locations.push(State.annotate({ id: State.pk(), name: city }, Op.Add));
    });

    const index = state.model.locations.findIndex((location) => location.id === id);
    expect(state.model.locations[index].name).toBe(model.locations[1].name);
    expect(state.inspect.locations[index].name.pending()).toBe(true);

    expect(state.model.locations[3].name).toBe(city);
    expect(state.inspect.locations[3].pending()).toBe(true);
  });

  it('adds + removes locations', () => {
    const state = new State<Model>(model, identity);

    const city = faker.location.city();
    state.mutate((draft) => {
      draft.locations.push(State.annotate({ id: State.pk(), name: city }, Op.Add));
    });
    expect(state.model.locations.length).toBe(4);
    expect(state.model.locations[3].name).toBe(city);
    expect(state.inspect.locations[3].pending()).toBe(true);

    {
      const id = model.locations[1].id;
      state.mutate((draft) => {
        const index = draft.locations.findIndex((location) => location.id === id);
        draft.locations[index] = State.annotate(draft.locations[index], Op.Remove);
      });
      expect(state.model.locations.length).toBe(4);
      expect(state.model.locations.find((location) => location.id === id)).toBeDefined();
      expect(state.inspect.locations[1].pending()).toBe(true);
    }

    {
      const id = model.locations[0].id;
      state.mutate((draft) => {
        const index = draft.locations.findIndex((location) => location.id === id);
        draft.locations.splice(index, 1);
      });
      expect(state.model.locations.length).toBe(3);
      expect(state.model.locations.find((location) => location.id === id)).toBeUndefined();
    }
  });

  it('prunes annotations by process', () => {
    const state = new State<Model>(model, identity);

    const process = state.mutate((draft) => {
      draft.name.first = State.annotate('Pending', Op.Update);
    });
    expect(state.inspect.name.first.pending()).toBe(true);

    state.prune(process);
    expect(state.inspect.name.first.pending()).toBe(false);
  });

  it.each([
    ['string', 'hello', true],
    ['number', 42, true],
    ['boolean', true, true],
    ['null', null, true],
    ['undefined', undefined, true],
    ['symbol', Symbol('test'), true],
    ['bigint', BigInt(123), true],
    ['object', {}, false],
    ['array', [], false],
    ['function', () => {}, false],
  ])('primitive(%s) returns %s', (_, value, expected) => {
    expect(primitive(value)).toBe(expected);
  });
});
