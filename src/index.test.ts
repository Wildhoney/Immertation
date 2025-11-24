import { faker } from '@faker-js/faker';
import { Op, State } from '.';
import { describe, expect, it } from 'vitest';

describe('Immertation', () => {
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

  it('updates', () => {
    const state = new State<Model>(model);

    state.mutate((draft) => {
      draft.name.first = model.name.first + '!';
      draft.age += 1;
    });
    expect(state.model.name.first).toBe(model.name.first + '!');
    expect(state.model.age).toBe(model.age + 1);
    // expect(state.inspect.name.first.pending()).toBe(false);
    // expect(state.inspect.age.pending()).toBe(false);

    {
      const name = faker.person.firstName();
      state.mutate((draft) => {
        draft.name = State.annotate({ first: 'A', last: State.annotate('T', Op.Update) }, Op.Update);
        draft.name.first = State.annotate(name, Op.Update);
        draft.age += 1;
      });

      expect(state.model.name.first).toBe(model.name.first + '!');
      expect(state.model.age).toBe(model.age + 2);
      // expect(state.inspect.name.pending()).toBe(true);
      // expect(state.inspect.name.first.pending()).toBe(true);
      // expect(state.inspect.age.pending()).toBe(false);
    }
  });
});
