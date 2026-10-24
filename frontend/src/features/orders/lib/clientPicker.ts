import type { AppClient } from '../../../services/api';
import { normalizeText } from './orders';

export interface ClientGroup {
  routeName: string;
  clients: AppClient[];
}

export function pickableClients(clients: AppClient[], query: string): ClientGroup[] {
  const needle = normalizeText(query.trim());
  const groups = new Map<string, AppClient[]>();
  clients
    .filter((client) => client.is_active)
    .filter((client) => !needle || normalizeText(`${client.name} ${client.address}`).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    .forEach((client) => {
      const name = client.route_details.route_name;
      groups.set(name, [...(groups.get(name) ?? []), client]);
    });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'pl', { numeric: true }))
    .map(([routeName, routeClients]) => ({ routeName, clients: routeClients }));
}