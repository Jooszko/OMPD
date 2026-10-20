import { describe, expect, it } from 'vitest';
import { activePath, bottomTabs, moreGroups, visibleGroups } from './navigation';

const paths = (groups: ReturnType<typeof visibleGroups>) => groups.map((group) => [group.title, group.items.map((item) => item.path)]);

describe('visibleGroups', () => {
  it('shows the owner every section', () => {
    expect(visibleGroups('admin').map((group) => group.title)).toEqual([
      null, 'Sprzedaż', 'Produkcja', 'Magazyn i zakupy', 'Dostawy', 'Firma',
    ]);
  });

  it('gives the baker only production work and drops empty groups', () => {
    expect(paths(visibleGroups('baker'))).toEqual([
      [null, ['/']],
      ['Sprzedaż', ['/orders']],
      ['Produkcja', ['/production/board', '/production', '/products']],
      ['Magazyn i zakupy', ['/warehouse']],
    ]);
  });

  it('gives the driver only logistics', () => {
    expect(paths(visibleGroups('driver'))).toEqual([['Dostawy', ['/logistics']]]);
  });
});

describe('activePath', () => {
  it('picks the most specific matching item', () => {
    expect(activePath('/production/board', 'admin')).toBe('/production/board');
    expect(activePath('/production', 'admin')).toBe('/production');
    expect(activePath('/production/settings', 'admin')).toBe('/production/settings');
    expect(activePath('/finance/reports', 'admin')).toBe('/finance');
  });

  it('matches home only exactly and ignores pages outside the menu', () => {
    expect(activePath('/', 'admin')).toBe('/');
    expect(activePath('/notifications', 'admin')).toBeNull();
    expect(activePath('/productsx', 'admin')).toBeNull();
    expect(activePath('/finance', 'baker')).toBeNull();
  });
});

describe('bottomTabs and moreGroups', () => {
  it('splits the owner menu between the tab bar and the "more" sheet', () => {
    expect(bottomTabs('admin').map((item) => item.short)).toEqual(['Start', 'Zamówienia', 'Tablica', 'Logistyka']);
    expect(paths(moreGroups('admin'))).toEqual([
      ['Sprzedaż', ['/clients']],
      ['Produkcja', ['/production', '/products', '/production/settings']],
      ['Magazyn i zakupy', ['/warehouse', '/contractors']],
      ['Dostawy', ['/delivery-stats']],
      ['Firma', ['/finance', '/users', '/audit-log']],
    ]);
  });

  it('keeps the baker tab bar on production and gives the driver none', () => {
    expect(bottomTabs('baker').map((item) => item.short)).toEqual(['Start', 'Tablica', 'Plan', 'Magazyn']);
    expect(paths(moreGroups('baker'))).toEqual([
      ['Sprzedaż', ['/orders']],
      ['Produkcja', ['/products']],
    ]);
    expect(bottomTabs('driver')).toEqual([]);
  });
});