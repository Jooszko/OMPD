import { describe, expect, it } from 'vitest';
import { passwordRules, passwordStrength } from './passwordRules';

const okFlags = (password: string, repeat: string, username = 'jkowalski') =>
  passwordRules(password, repeat, username).map((rule) => rule.ok);

describe('passwordRules', () => {
  it('passes a good password repeated correctly', () => {
    expect(okFlags('Chleb-Zytni-7', 'Chleb-Zytni-7')).toEqual([true, true, true, true]);
  });

  it('fails length, digits and repeat for a short numeric password', () => {
    expect(okFlags('1234', '123')).toEqual([false, false, true, false]);
  });

  it('rejects a password containing the login, case-insensitively', () => {
    expect(okFlags('JKowalski2026', 'JKowalski2026')[2]).toBe(false);
  });

  it('marks everything as not met for an empty password', () => {
    expect(okFlags('', '')).toEqual([false, false, false, false]);
  });
});

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['abc', 1],
    ['chlebowy', 1],
    ['ChlebowyRanek', 3],
    ['Chlebowy-Ranek7', 4],
    ['Żytni-Chlebek7', 4],
  ])('scores %s as %d', (password, expected) => {
    expect(passwordStrength(password)).toBe(expected);
  });
});