import { describe, it, expect } from 'vitest';
import { Store, Revision } from '.';
import { faker } from '@faker-js/faker';
import { State } from './types';

describe('Store', () => {
  it('should set a primitive', () => {
    const initial = { name: faker.person.fullName(), age: faker.number.int(100) };
    const store = new Store(initial);

    const name = faker.person.fullName() + '!';
    store.name.set(name);
    expect(store.name.get(Revision.Current)).toBe(name);
    expect(store.name.pending()).toBe(false);
  });

  it('should set a primitive using annotations', () => {
    const initial = { name: faker.person.fullName(), age: faker.number.int(100) };
    const store = new Store(initial);

    const name = faker.person.fullName() + '!';
    store.name.set(name, State.Replace | State.Update);
    expect(store.name.get(Revision.Current)).toBe(initial.name);
    expect(store.name.get(Revision.Draft)).toBe(name);
    expect(store.name.pending()).toBe(true);
  });

  it('should set an object', () => {
    const initial = { person: { name: faker.person.fullName(), age: faker.number.int(100) } };
    const store = new Store(initial);

    const name = faker.person.fullName() + '!';
    const age = faker.number.int(100) * 10;
    store.person.set({ name, age });

    expect(store.person.name.get(Revision.Current)).toBe(name);
    expect(store.person.name.pending()).toBe(false);

    expect(store.person.age.get(Revision.Current)).toBe(age);
    expect(store.person.age.pending()).toBe(false);
  });

  it('should set an object using annotations', () => {
    const initial = { person: { name: faker.person.fullName(), age: faker.number.int(100) } };
    const store = new Store(initial);

    const name = faker.person.fullName() + '!';
    const age = faker.number.int(100) * 10;
    store.person.set({ name, age }, State.Replace | State.Update);

    expect(store.person.name.get(Revision.Current)).toBe(initial.person.name);
    expect(store.person.name.get(Revision.Draft)).toBe(name);
    expect(store.person.pending()).toBe(true);

    expect(store.person.age.get(Revision.Current)).toBe(initial.person.age);
    expect(store.person.age.get(Revision.Draft)).toBe(age);
    expect(store.person.pending()).toBe(true);
  });
});
