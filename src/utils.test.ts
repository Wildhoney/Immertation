import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import { get, plain, primitive, tag } from './utils';
import { Op, State } from '.';

describe('get()', () => {
  const input = {
    a: 1,
    b: { c: 2, d: { e: 3 } },
    arr: [{ x: 10 }, { x: 20 }, { x: 30 }],
    'dot.key': 'dotted',
    0: 'zero',
  };

  describe('string path', () => {
    it('accesses top-level properties', () => {
      expect(get(input, 'a')).toBe(1);
    });

    it('accesses nested properties with dot notation', () => {
      expect(get(input, 'b.c')).toBe(2);
      expect(get(input, 'b.d.e')).toBe(3);
    });

    it('accesses array elements by index', () => {
      expect(get(input, 'arr.0')).toEqual({ x: 10 });
      expect(get(input, 'arr.1.x')).toBe(20);
      expect(get(input, 'arr.2.x')).toBe(30);
    });

    it('returns undefined for non-existent paths', () => {
      expect(get(input, 'nonexistent')).toBeUndefined();
      expect(get(input, 'b.nonexistent')).toBeUndefined();
      expect(get(input, 'b.d.e.f')).toBeUndefined();
    });

    it('returns undefined when traversing through null/undefined', () => {
      expect(get({ a: null }, 'a.b')).toBeUndefined();
      expect(get({ a: undefined }, 'a.b')).toBeUndefined();
    });

    it('handles empty string path', () => {
      expect(get(input, '')).toEqual(input);
    });
  });

  describe('array path', () => {
    it('accesses properties with array path', () => {
      expect(get(input, ['a'])).toBe(1);
      expect(get(input, ['b', 'c'])).toBe(2);
      expect(get(input, ['b', 'd', 'e'])).toBe(3);
    });

    it('accesses array elements with numeric keys', () => {
      expect(get(input, ['arr', 0])).toEqual({ x: 10 });
      expect(get(input, ['arr', 1, 'x'])).toBe(20);
    });

    it('handles mixed string and number keys', () => {
      expect(get(input, ['arr', 0, 'x'])).toBe(10);
    });

    it('returns undefined for non-existent array paths', () => {
      expect(get(input, ['nonexistent'])).toBeUndefined();
      expect(get(input, ['arr', 99])).toBeUndefined();
    });

    it('handles empty array path', () => {
      expect(get(input, [])).toEqual(input);
    });
  });

  describe('edge cases', () => {
    it('handles null input', () => {
      expect(get(null, 'a')).toBeUndefined();
      expect(get(null, ['a'])).toBeUndefined();
    });

    it('handles undefined input', () => {
      expect(get(undefined, 'a')).toBeUndefined();
      expect(get(undefined, ['a'])).toBeUndefined();
    });

    it('accesses numeric string keys', () => {
      expect(get(input, '0')).toBe('zero');
      expect(get(input, ['0'])).toBe('zero');
    });

    it('returns primitive values directly', () => {
      expect(get('hello', '0')).toBe('h');
      expect(get('hello', 'length')).toBe(5);
    });

    it('accesses array length', () => {
      expect(get(input, 'arr.length')).toBe(3);
    });
  });
});

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

describe('plain()', () => {
  it.each([
    ['plain object', {}, true],
    ['Object.create(null)', Object.create(null), true],
    ['File', new File([''], 'test.png', { type: 'image/png' }), false],
    ['Date', new Date(), false],
    ['RegExp', /test/, false],
    ['Map', new Map(), false],
    ['Set', new Set(), false],
  ])('plain(%s) returns %s', (_, value, expected) => {
    expect(plain(value)).toBe(expected);
  });
});

describe('tag()', () => {
  it('preserves File objects in state', () => {
    const file = new File(['content'], 'receipt.png', { type: 'image/png' });
    const model = { files: [file], name: 'test' };
    const tagged = tag(model);

    expect(tagged.files[0]).toBe(file);
    expect(tagged.files[0].name).toBe('receipt.png');
    expect(tagged.files[0].type).toBe('image/png');
  });

  it('preserves Date objects in state', () => {
    const date = new Date('2025-01-01');
    const model = { createdAt: date };
    const tagged = tag(model);

    expect(tagged.createdAt).toBe(date);
    expect(tagged.createdAt.toISOString()).toBe(date.toISOString());
  });

  it('still tags plain objects', () => {
    const model = { name: 'test', nested: { value: 1 } };
    const tagged = tag(model);

    expect(tagged).toHaveProperty('κ');
    expect(tagged.nested).toHaveProperty('κ');
    expect(tagged.name).toBe('test');
    expect(tagged.nested.value).toBe(1);
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
      const state = new State<Model>();
      state.hydrate(model);
      expect(state.inspect.name.first.pending()).toBe(false);
    });

    it('returns true when annotations exist', () => {
      const state = new State<Model>();
      state.hydrate(model);
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.pending()).toBe(true);
    });

    it('returns false after annotations are pruned', () => {
      const state = new State<Model>();
      state.hydrate(model);
      const process = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.pending()).toBe(true);
      state.prune(process);
      expect(state.inspect.name.first.pending()).toBe(false);
    });
  });

  describe('remaining()', () => {
    it('returns 0 when no annotations exist', () => {
      const state = new State<Model>();
      state.hydrate(model);
      expect(state.inspect.name.first.remaining()).toBe(0);
    });

    it('returns count of pending annotations', () => {
      const state = new State<Model>();
      state.hydrate(model);
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      expect(state.inspect.name.first.remaining()).toBe(1);

      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.remaining()).toBe(2);
    });

    it('decreases when annotations are pruned', () => {
      const state = new State<Model>();
      state.hydrate(model);
      const process1 = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      const process2 = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.remaining()).toBe(2);

      state.prune(process1);
      expect(state.inspect.name.first.remaining()).toBe(1);

      state.prune(process2);
      expect(state.inspect.name.first.remaining()).toBe(0);
    });
  });

  describe('is()', () => {
    it('returns false when no annotations exist', () => {
      const state = new State<Model>();
      state.hydrate(model);
      expect(state.inspect.name.first.is(Op.Update)).toBe(false);
    });

    it('returns true for matching operation', () => {
      const state = new State<Model>();
      state.hydrate(model);
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Updated')));
      expect(state.inspect.name.first.is(Op.Update)).toBe(true);
      expect(state.inspect.name.first.is(Op.Add)).toBe(false);
      expect(state.inspect.name.first.is(Op.Remove)).toBe(false);
    });

    it('works with combined operation bitmasks', () => {
      const state = new State<Model>();
      state.hydrate(model);
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update | Op.Replace, 'Combined')));
      expect(state.inspect.name.first.is(Op.Update)).toBe(true);
      expect(state.inspect.name.first.is(Op.Replace)).toBe(true);
      expect(state.inspect.name.first.is(Op.Add)).toBe(false);
    });
  });

  describe('draft()', () => {
    it('returns model value when no annotations exist', () => {
      const state = new State<Model>();
      state.hydrate(model);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });

    it('returns annotated value when pending', () => {
      const state = new State<Model>();
      state.hydrate(model);
      const name = faker.person.firstName();
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, name)));
      expect(state.inspect.name.first.draft()).toBe(name);
    });

    it('returns most recent annotated value when multiple annotations exist', () => {
      const state = new State<Model>();
      state.hydrate(model);
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Second')));
      expect(state.inspect.name.first.draft()).toBe('Second');
      expect(state.inspect.name.first.remaining()).toBe(2);
    });

    it('returns model value after annotations are pruned', () => {
      const state = new State<Model>();
      state.hydrate(model);
      const process = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'Pending')));
      expect(state.inspect.name.first.draft()).toBe('Pending');
      state.prune(process);
      expect(state.inspect.name.first.draft()).toBe(model.name.first);
    });
  });

  describe('settled()', () => {
    it('resolves immediately when no annotations exist', async () => {
      const state = new State<Model>();
      state.hydrate(model);
      const result = await state.inspect.name.first.settled();
      expect(result).toBe(model.name.first);
    });

    it('resolves when annotations are pruned', async () => {
      const state = new State<Model>();
      state.hydrate(model);
      const name = faker.person.firstName();

      const process = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const settled = state.inspect.name.first.settled();
      state.produce((draft) => void (draft.name.first = name));
      state.prune(process);

      expect(await settled).toBe(name);
    });

    it('waits for all annotations to be cleared', async () => {
      const state = new State<Model>();
      state.hydrate(model);
      const name = faker.person.firstName();

      const process1 = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, 'First')));
      const process2 = state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const settled = state.inspect.name.first.settled();

      state.prune(process1);
      expect(state.inspect.name.first.pending()).toBe(true);

      state.produce((draft) => void (draft.name.first = name));
      state.prune(process2);

      expect(await settled).toBe(name);
    });
  });

  describe('box()', () => {
    it('returns value and inspect proxy', () => {
      const state = new State<Model>();
      state.hydrate(model);

      const box = state.inspect.name.first.box();
      expect(box.value).toBe(model.name.first);
      expect(box.inspect.pending()).toBe(false);
    });

    it('returns current model value even when pending', () => {
      const state = new State<Model>();
      state.hydrate(model);
      const name = faker.person.firstName();

      state.produce((draft) => void (draft.name.first = state.annotate(Op.Update, name)));

      const box = state.inspect.name.first.box();
      expect(box.value).toBe(model.name.first);
      expect(box.inspect.pending()).toBe(true);
      expect(box.inspect.draft()).toBe(name);
    });

    it('works with nested objects', () => {
      const state = new State<Model>();
      state.hydrate(model);

      const box = state.inspect.name.box();
      expect(box.value.first).toBe(model.name.first);
      expect(box.value.last).toBe(model.name.last);
      expect(box.inspect.first.pending()).toBe(false);
    });

    it('works with array items', () => {
      const state = new State<Model>();
      state.hydrate(model);

      const box = state.inspect.locations[0].box();
      expect(box.value.name).toBe(model.locations[0].name);
      expect(box.inspect.name.pending()).toBe(false);
    });
  });
});
