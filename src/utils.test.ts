import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { primitive } from './utils';
import { Op, State } from '.';

describe('primitive()', () => {
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

describe('box()', () => {
  type Model = {
    name: {
      first: string;
      last: string;
    };
    age: number;
    locations: { name: string }[];
  };

  const model = {
    name: {
      first: faker.person.firstName(),
      last: faker.person.lastName(),
    },
    age: faker.number.int({ min: 1, max: 100 }),
    locations: Array.from({ length: 3 }, () => ({
      name: faker.location.city(),
    })),
  } satisfies Model;

  describe('pending()', () => {
    it('returns false when no annotations exist', () => {
      const state = new State<Model>(model);
      expect(state.inspect.name.first.pending()).toBe(false);
    });

    it('returns true when annotations exist', () => {
      const state = new State<Model>(model);
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.pending()).toBe(true);
    });

    it('returns false after annotations are pruned', () => {
      const state = new State<Model>(model);
      const process = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.pending()).toBe(true);
      state.prune(process);
      expect(state.inspect.name.first.pending()).toBe(false);
    });
  });

  describe('remaining()', () => {
    it('returns 0 when no annotations exist', () => {
      const state = new State<Model>(model);
      expect(state.inspect.name.first.remaining()).toBe(0);
    });

    it('returns count of pending annotations', () => {
      const state = new State<Model>(model);
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      expect(state.inspect.name.first.remaining()).toBe(1);

      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.remaining()).toBe(2);
    });

    it('decreases when annotations are pruned', () => {
      const state = new State<Model>(model);
      const process1 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      const process2 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.remaining()).toBe(2);

      state.prune(process1);
      expect(state.inspect.name.first.remaining()).toBe(1);

      state.prune(process2);
      expect(state.inspect.name.first.remaining()).toBe(0);
    });
  });

  describe('is()', () => {
    it('returns false when no annotations exist', () => {
      const state = new State<Model>(model);
      expect(state.inspect.name.first.is(Op.Update)).toBe(false);
    });

    it('returns true for matching operation', () => {
      const state = new State<Model>(model);
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Updated')));
      expect(state.inspect.name.first.is(Op.Update)).toBe(true);
      expect(state.inspect.name.first.is(Op.Add)).toBe(false);
      expect(state.inspect.name.first.is(Op.Remove)).toBe(false);
    });

    it('works with combined operation bitmasks', () => {
      const state = new State<Model>(model);
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update | Op.Replace, 'Combined')));
      expect(state.inspect.name.first.is(Op.Update)).toBe(true);
      expect(state.inspect.name.first.is(Op.Replace)).toBe(true);
      expect(state.inspect.name.first.is(Op.Add)).toBe(false);
    });
  });

  describe('draft()', () => {
    it('returns model value when no annotations exist', () => {
      const state = new State<Model>(model);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });

    it('returns annotated value when pending', () => {
      const state = new State<Model>(model);
      const name = faker.person.firstName();
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, name)));
      expect(state.inspect.name.first.draft()).toBe(name);
    });

    it('returns most recent annotated value when multiple annotations exist', () => {
      const state = new State<Model>(model);
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.draft()).toBe('Second');
      expect(state.inspect.name.first.remaining()).toBe(2);
    });

    it('returns model value after annotations are pruned', () => {
      const state = new State<Model>(model);
      const process = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.draft()).toBe('Pending');
      state.prune(process);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });
  });

  describe('settled()', () => {
    it('resolves immediately when no annotations exist', async () => {
      const state = new State<Model>(model);
      const result = await state.inspect.name.first.settled();
      expect(result).toBe(model.name.first);
    });

    it('resolves when annotations are pruned', async () => {
      const state = new State<Model>(model);
      const name = faker.person.firstName();

      const process = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const settled = state.inspect.name.first.settled();
      state.mutate((draft) => void (draft.name.first = name));
      state.prune(process);

      expect(await settled).toBe(name);
    });

    it('waits for all annotations to be cleared', async () => {
      const state = new State<Model>(model);
      const name = faker.person.firstName();

      const process1 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      const process2 = state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const settled = state.inspect.name.first.settled();

      state.prune(process1);
      expect(state.inspect.name.first.pending()).toBe(true);

      state.mutate((draft) => void (draft.name.first = name));
      state.prune(process2);

      expect(await settled).toBe(name);
    });
  });

  describe('box()', () => {
    it('returns value and inspect proxy', () => {
      const state = new State<Model>(model);

      const box = state.inspect.name.first.box();
      expect(box.value).toBe(model.name.first);
      expect(box.inspect.pending()).toBe(false);
    });

    it('returns current model value even when pending', () => {
      const state = new State<Model>(model);
      const name = faker.person.firstName();

      state.mutate((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const box = state.inspect.name.first.box();
      expect(box.value).toBe(model.name.first);
      expect(box.inspect.pending()).toBe(true);
      expect(box.inspect.draft()).toBe(name);
    });

    it('works with nested objects', () => {
      const state = new State<Model>(model);

      const box = state.inspect.name.box();
      expect(box.value.first).toBe(model.name.first);
      expect(box.value.last).toBe(model.name.last);
      expect(box.inspect.first.pending()).toBe(false);
    });

    it('works with array items', () => {
      const state = new State<Model>(model);

      const box = state.inspect.locations[0].box();
      expect(box.value.name).toBe(model.locations[0].name);
      expect(box.inspect.name.pending()).toBe(false);
    });
  });
});
