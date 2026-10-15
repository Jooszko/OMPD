import { describe, expect, it } from 'vitest';
import type { StaffUser } from '../../../services/api';
import {
  accountStatus,
  apiErrorMessage,
  filterCounts,
  formatDateTime,
  formatLastLogin,
  generatePassword,
  groupByRole,
  historyTone,
  initials,
  matchesFilter,
  matchesQuery,
  sortStaff,
  suggestLogin,
} from './staff';

function staff(fullName: string, fields: Partial<StaffUser> = {}): StaffUser {
  return {
    user_id: fullName.length,
    username: fullName.toLowerCase().replace(/\s/g, ''),
    full_name: fullName,
    role: 'baker',
    is_active: true,
    must_change_password: false,
    last_login: null,
    date_joined: '2026-10-13T08:00:00Z',
    routes: [],
    ...fields,
  };
}

describe('accountStatus', () => {
  it('puts a blocked account before a pending first login', () => {
    expect(accountStatus({ is_active: true, must_change_password: false })).toBe('active');
    expect(accountStatus({ is_active: true, must_change_password: true })).toBe('pending');
    expect(accountStatus({ is_active: false, must_change_password: true })).toBe('blocked');
  });
});

describe('matchesQuery', () => {
  const user = staff('Piotr Zieliński', { username: 'pzielinski' });

  it.each(['', 'zieli', 'ZIELIŃ', 'zielinski', 'pzie', '  piotr '])('finds "%s"', (query) => {
    expect(matchesQuery(user, query)).toBe(true);
  });

  it('treats ł as l', () => {
    expect(matchesQuery(staff('Paweł Kozłowski'), 'kozlowski')).toBe(true);
  });

  it('rejects other names', () => {
    expect(matchesQuery(user, 'nowak')).toBe(false);
  });
});

describe('filters', () => {
  const users = [
    staff('Anna Admin', { role: 'admin' }),
    staff('Bartek Baker'),
    staff('Celina Nowa', { must_change_password: true }),
    staff('Damian Driver', { role: 'driver' }),
    staff('Ewa Blokada', { is_active: false, must_change_password: true }),
  ];

  it('counts roles and account states', () => {
    expect(filterCounts(users)).toEqual({ all: 5, admin: 1, baker: 3, driver: 1, blocked: 1, pending: 1 });
  });

  it('filters by role or by state', () => {
    expect(users.filter((u) => matchesFilter(u, 'baker')).map((u) => u.full_name)).toEqual([
      'Bartek Baker',
      'Celina Nowa',
      'Ewa Blokada',
    ]);
    expect(users.filter((u) => matchesFilter(u, 'pending')).map((u) => u.full_name)).toEqual(['Celina Nowa']);
    expect(users.filter((u) => matchesFilter(u, 'all'))).toHaveLength(5);
  });
});

describe('sortStaff and groupByRole', () => {
  const users = [
    staff('Żaneta Zając', { last_login: '2026-10-15T05:00:00Z' }),
    staff('Adam Ąbacki', { role: 'driver' }),
    staff('Łukasz Łoś', { role: 'admin', last_login: '2026-10-15T07:00:00Z' }),
  ];

  it('sorts by Polish alphabet or by latest login', () => {
    expect(sortStaff(users, 'name').map((u) => u.full_name)).toEqual(['Adam Ąbacki', 'Łukasz Łoś', 'Żaneta Zając']);
    expect(sortStaff(users, 'last_login').map((u) => u.full_name)).toEqual([
      'Łukasz Łoś',
      'Żaneta Zając',
      'Adam Ąbacki',
    ]);
  });

  it('groups managers, bakers and drivers in that order', () => {
    expect(groupByRole(users).map((group) => [group.title, group.users.length])).toEqual([
      ['Kierownicy', 1],
      ['Piekarze', 1],
      ['Kierowcy', 1],
    ]);
    expect(groupByRole([staff('Jan')]).map((group) => group.role)).toEqual(['baker']);
  });
});

describe('initials', () => {
  it.each([
    ['Jan Krasiński', 'JK'],
    ['Katarzyna Maria Lewandowska', 'KM'],
    ['test_kierowca', 'TK'],
    ['  ', '?'],
  ])('%s → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('suggestLogin', () => {
  it('builds an ascii login from the name', () => {
    expect(suggestLogin('Jan Krasiński', [])).toBe('jkrasinski');
    expect(suggestLogin('Łucja Żółć', [])).toBe('lzolc');
    expect(suggestLogin('Madonna', [])).toBe('madonna');
    expect(suggestLogin('   ', [])).toBe('');
  });

  it('adds a number when the login is taken', () => {
    expect(suggestLogin('Jan Nowak', ['jnowak'])).toBe('jnowak2');
    expect(suggestLogin('Jan Nowak', ['JNOWAK', 'jnowak2'])).toBe('jnowak3');
  });
});

describe('generatePassword', () => {
  it('joins two bakery words with four digits', () => {
    const values = [0, 0.5, 0.99];
    const password = generatePassword(() => values.shift() ?? 0);

    expect(password).toBe('Rogal-5500-Bagietka');
  });

  it('always has the word-digits-word shape', () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).toMatch(/^[A-Z][a-z]+-\d{4}-[A-Z][a-z]+$/);
    }
  });
});

describe('formatLastLogin', () => {
  const now = new Date(2026, 9, 15, 12, 0);
  const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

  it.each([
    [null, 'jeszcze nie'],
    [at(15, 5, 21), 'dziś, 05:21'],
    [at(14, 23, 59), 'wczoraj, 23:59'],
    [at(12, 8), '3 dni temu'],
    [at(1, 8), '1 paź 2026'],
  ])('%s → %s', (value, expected) => {
    expect(formatLastLogin(value, now)).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it('shows the date with leading zeros and the time', () => {
    expect(formatDateTime(new Date(2026, 9, 4, 9, 5).toISOString())).toBe('04.10.2026, 09:05');
  });
});

describe('historyTone', () => {
  it.each([
    ['login.succeeded', 'success'],
    ['login.failed', 'danger'],
    ['login.inactive_account', 'danger'],
    ['user.updated', 'change'],
    ['user.password_reset', 'password'],
    ['password.initial_set', 'password'],
    ['user.created', 'neutral'],
  ])('%s → %s', (action, tone) => {
    expect(historyTone(action)).toBe(tone);
  });
});


describe('apiErrorMessage', () => {
  it('reads field errors and plain errors from the server', () => {
    expect(apiErrorMessage(new Error('{"username":["Ten login jest zajęty."]}'), 'x')).toBe('Ten login jest zajęty.');
    expect(apiErrorMessage(new Error('{"error":"Nie możesz usunąć własnego konta."}'), 'x')).toBe(
      'Nie możesz usunąć własnego konta.'
    );
  });

  it('falls back when the message is not JSON', () => {
    expect(apiErrorMessage(new Error('Failed to fetch'), 'Nie udało się zapisać.')).toBe('Nie udało się zapisać.');
    expect(apiErrorMessage('oops', 'Nie udało się zapisać.')).toBe('Nie udało się zapisać.');
  });
});