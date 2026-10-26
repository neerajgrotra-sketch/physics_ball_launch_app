import { describe, expect, it } from 'vitest';
import { emptyProfile, hasProfile, parseAge, parseProfile } from './profile';

describe('profile', () => {
  it('takes whole-year ages from 5 to 120 and nothing else', () => {
    expect(parseAge('34')).toBe(34);
    expect(parseAge(' 9 ')).toBe(9);
    for (const bad of ['', 'abc', '3', '121', '12.5', '-4']) expect(parseAge(bad)).toBeNull();
  });

  it('reads back a saved profile, dropping anything malformed', () => {
    expect(parseProfile(JSON.stringify({ name: ' Sam ', age: 31, gender: 'Female', country: 'Canada' })))
      .toEqual({ name: 'Sam', age: 31, gender: 'Female', country: 'Canada' });
    expect(parseProfile(JSON.stringify({ name: 7, age: 400, gender: 'Robot' }))).toEqual(emptyProfile());
    expect(parseProfile('not json')).toEqual(emptyProfile());
    expect(parseProfile(null)).toEqual(emptyProfile());
  });

  it('knows when nothing has been filled in', () => {
    expect(hasProfile(emptyProfile())).toBe(false);
    expect(hasProfile({ ...emptyProfile(), country: 'India' })).toBe(true);
  });
});
