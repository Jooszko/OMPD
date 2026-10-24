import { describe, expect, it } from 'vitest';
import type { AppClient } from '../../../services/api';
import { pickableClients } from './clientPicker';

function client(id: number, name: string, routeName: string, address = 'Rynek 1, Skoczów', active = true): AppClient {
  return {
    client_id: id,
    name,
    address,
    nip: null,
    phone: '',
    route: 1,
    route_details: { route_id: 1, route_name: routeName, driver_name: null } as AppClient['route_details'],
    is_active: active,
    latitude: null,
    longitude: null,
    geocoded_at: null,
    standing_days: [],
  };
}

const clients = [
  client(1, 'Sklep "Złoty Kłos"', 'Trasa 10'),
  client(2, 'Hotel "Zielona"', 'Trasa 2', '3 Maja 40, Ustroń'),
  client(3, 'Bar "Akacjowa"', 'Trasa 2'),
  client(4, 'Kawiarnia "Stara"', 'Trasa 2', 'Rynek 2', false),
];

describe('pickableClients', () => {
  it('groups active clients by route in natural order, names alphabetically', () => {
    expect(pickableClients(clients, '').map((group) => [group.routeName, group.clients.map((c) => c.client_id)])).toEqual([
      ['Trasa 2', [3, 2]],
      ['Trasa 10', [1]],
    ]);
  });

  it('searches name and address without Polish letters', () => {
    expect(pickableClients(clients, 'zloty').flatMap((group) => group.clients.map((c) => c.client_id))).toEqual([1]);
    expect(pickableClients(clients, 'ustron').flatMap((group) => group.clients.map((c) => c.client_id))).toEqual([2]);
    expect(pickableClients(clients, 'nikt')).toEqual([]);
  });
});