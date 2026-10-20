import { describe, expect, it } from 'vitest';
import type { HomeOrder, HomeOrders, HomeRoute, HomeRouteStop, HomeShift } from '../../../services/api';
import {
  alertView,
  buildLanes,
  daySummary,
  donutArcs,
  formatShortDate,
  greeting,
  initials,
  plural,
  progressStops,
  ringFontSize,
  routeLabel,
  shiftSummary,
  trendBars,
} from './home';

function order(clientId: number, clientName: string, productName: string, quantity: number, status: HomeOrder['status']): HomeOrder {
  return {
    order_id: clientId * 100 + quantity,
    client_id: clientId,
    client_name: clientName,
    product_name: productName,
    quantity,
    status,
    route_name: 'Trasa 1',
    delivered_at: null,
  };
}

function orders(fields: Partial<HomeOrders> = {}): HomeOrders {
  return {
    total: 7,
    clients: 7,
    routes: 6,
    pieces: 180,
    by_status: { planned: 1, in_production: 3, in_delivery: 2, delivered: 1, failed: 0 },
    items: [],
    ...fields,
  };
}

function route(fields: Partial<HomeRoute> = {}): HomeRoute {
  return {
    route_id: 1,
    route_name: 'Trasa 1',
    driver_name: 'Jan Nowak',
    state: 'waiting',
    delivered_stops: 0,
    total_stops: 3,
    last_delivery: null,
    stops: [],
    ...fields,
  };
}

describe('plural', () => {
  it('follows Polish number forms', () => {
    const form = (n: number) => plural(n, 'zamówienie', 'zamówienia', 'zamówień');
    expect([1, 2, 4, 5, 12, 22, 25].map(form)).toEqual([
      'zamówienie', 'zamówienia', 'zamówienia', 'zamówień', 'zamówień', 'zamówienia', 'zamówień',
    ]);
  });
});

describe('greeting', () => {
  it('uses the first name and time of day', () => {
    expect(greeting('Mikołaj Klukowski', 9)).toBe('Dzień dobry, Mikołaj');
    expect(greeting('Mikołaj Klukowski', 22)).toBe('Dobry wieczór, Mikołaj');
    expect(greeting('', 9)).toBe('Dzień dobry');
  });
});

describe('daySummary', () => {
  it('tells how the day is going', () => {
    const text = daySummary(orders()).map((segment) => segment.text).join('');

    expect(text).toBe('Dziś 7 zamówień i 180 szt. na 6 trasach. 1 dotarło, 2 w drodze, 3 w produkcji, 1 czeka na start.');
  });

  it('marks numbers as strong and handles an empty day', () => {
    expect(daySummary(orders()).filter((segment) => segment.strong).map((segment) => segment.text)).toEqual([
      '7 zamówień', '180 szt.',
    ]);
    expect(daySummary(orders({ total: 0 }))[0].text).toBe('Na dziś nie ma jeszcze żadnych zamówień.');
  });
});

describe('shiftSummary', () => {
  function shift(fields: Partial<HomeShift> = {}): HomeShift {
    return {
      production_date: '2026-10-20',
      delivery_date: '2026-10-21',
      has_plan: true,
      orders: 7,
      clients: 7,
      pieces: 180,
      standing_clients: 0,
      standing_pieces: 0,
      stages: { mixing: 1, dividing: 0, proofing: 2, baking: 1, done: 3 },
      batches: Array.from({ length: 7 }, (_, index) => ({
        batch_id: index, dough_name: 'Ciasto', mixer_name: '', sequence: index + 1, batch_count: 7, stage: 'done' as const,
      })),
      products: [],
      ingredients: [],
      ...fields,
    };
  }
  const text = (value: HomeShift) => shiftSummary(value).map((segment) => segment.text).join('');

  it('tells how far the batches are', () => {
    expect(text(shift())).toBe('Na dostawę 21.10: 7 dzieży i 180 szt. (3 gotowe, 1 w piecu, 2 garują, 1 w mieszaniu).');
  });

  it('warns when there is no plan yet', () => {
    expect(text(shift({ has_plan: false, pieces: 0, standing_pieces: 184 }))).toBe(
      'Plan produkcji na 21.10 jeszcze nie powstał, a do upieczenia jest 184 szt.',
    );
    expect(text(shift({ has_plan: false, pieces: 0 }))).toBe('Plan produkcji na 21.10 jeszcze nie powstał.');
  });
});

describe('ringFontSize', () => {
  it('shrinks the ring label as it gets longer', () => {
    expect(['1/7', '5/23', '13/23', '120/140'].map(ringFontSize)).toEqual([40, 37, 30, 21]);
  });
});

describe('donutArcs', () => {
  it('splits the circle by counts and skips empty parts', () => {
    const arcs = donutArcs({ a: 1, b: 0, c: 3 }, ['a', 'b', 'c'], 400, 4);

    expect(arcs).toEqual([
      { key: 'a', length: 96, offset: 0 },
      { key: 'c', length: 296, offset: 100 },
    ]);
  });

  it('draws a closed ring for a single part and nothing when empty', () => {
    expect(donutArcs({ a: 2 }, ['a'], 300)).toEqual([{ key: 'a', length: 300, offset: 0 }]);
    expect(donutArcs({ a: 0 }, ['a'], 300)).toEqual([]);
  });
});

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Hotel „Miejska”')).toBe('HM');
    expect(initials('Sklep Osiedlowy "Mała"')).toBe('SO');
    expect(initials('Stołówka')).toBe('S');
  });
});

describe('buildLanes', () => {
  it('groups orders by client inside each status lane', () => {
    const lanes = buildLanes([
      order(1, 'Hotel', 'Chleb', 10, 'delivered'),
      order(1, 'Hotel', 'Bułka', 20, 'delivered'),
      order(2, 'Sklep', 'Chleb', 5, 'in_production'),
      order(3, 'Kawiarnia', 'Sernik', 8, 'failed'),
    ]);

    expect(lanes.map((lane) => [lane.key, lane.cards.length, lane.pieces])).toEqual([
      ['planned', 0, 0],
      ['in_production', 1, 5],
      ['in_delivery', 0, 0],
      ['delivered', 2, 30],
    ]);
    expect(lanes[3].cards[0]).toMatchObject({ clientName: 'Hotel', detail: 'Chleb, Bułka', pieces: 30, failed: false });
    expect(lanes[3].cards[1]).toMatchObject({ clientName: 'Kawiarnia', failed: true });
  });
});

describe('alertView', () => {
  it('describes failed deliveries with client and day', () => {
    const view = alertView({
      kind: 'failed_deliveries',
      severity: 'critical',
      items: [
        { order_id: 1, client_name: 'Sklep „Pogodna”', date: '2026-10-17' },
        { order_id: 2, client_name: 'Piekarnia „Pod Jelenie”', date: '2026-10-16' },
      ],
    });

    expect(view).toEqual({
      key: 'failed_deliveries',
      tone: 'critical',
      title: '2 nieudane dostawy',
      detail: 'Sklep „Pogodna” (17.10) · Piekarnia „Pod Jelenie” (16.10)',
      href: '/logistics',
    });
  });

  it('names up to two missing ingredients', () => {
    const two = alertView({
      kind: 'low_stock',
      severity: 'critical',
      items: [
        { name: 'Czekolada', unit: 'kg', current: '2.000', minimum: '3.000' },
        { name: 'Olej rzepakowy', unit: 'l', current: '1.500', minimum: '5.000' },
      ],
    });

    expect(two.title).toBe('Czekolada i olej rzepakowy poniżej minimum');
    expect(two.detail).toBe('Czekolada 2 / 3 kg · Olej rzepakowy 1,5 / 5 l');
  });

  it('links plan and closing warnings to the right pages', () => {
    expect(alertView({ kind: 'missing_plan', severity: 'warning', items: [{ date: '2026-10-21' }] })).toMatchObject({
      title: 'Brak planu produkcji na 21.10',
      href: '/production',
    });
    expect(alertView({ kind: 'day_not_closed', severity: 'warning', items: [{ date: '2026-10-19' }] })).toMatchObject({
      title: 'Dzień 19.10 niezamknięty',
      href: '/finance/reports',
    });
  });
});

describe('formatShortDate', () => {
  it('shows day and month', () => {
    expect(formatShortDate('2026-10-05')).toBe('05.10');
  });
});

describe('trendBars', () => {
  it('scales bars to the best day and marks today', () => {
    const bars = trendBars([
      { date: '2026-10-18', revenue: '600.00' },
      { date: '2026-10-19', revenue: '0.00' },
      { date: '2026-10-20', revenue: '300.00' },
    ]);

    expect(bars.map((bar) => [bar.label, bar.height, bar.today])).toEqual([
      ['nd', 100, false],
      ['pn', 0, false],
      ['dziś', 50, true],
    ]);
  });
});

describe('progressStops', () => {
  function stop(clientName: string, status: HomeRouteStop['status'], deliveredAt: string | null = null): HomeRouteStop {
    return { client_id: clientName.length, client_name: clientName, latitude: null, longitude: null, status, delivered_at: deliveredAt };
  }

  it('puts finished stops first, in delivery order, and waiting ones last', () => {
    const ordered = progressStops([
      stop('Wesoła', 'waiting'),
      stop('Hotel', 'delivered', '2026-10-20T09:10:00+02:00'),
      stop('U Gosi', 'in_delivery'),
      stop('Nowa', 'failed'),
      stop('Bar', 'delivered', '2026-10-20T07:48:00+02:00'),
      stop('Apteka', 'waiting'),
    ]);

    expect(ordered.map((item) => item.client_name)).toEqual(['Bar', 'Hotel', 'Nowa', 'U Gosi', 'Apteka', 'Wesoła']);
  });
});

describe('routeLabel', () => {
  it('describes each route state', () => {
    const lastDelivery = { client_name: 'Hotel', delivered_at: '2026-10-20T08:57:00+02:00' };

    expect(routeLabel(route())).toBe('czeka na towar');
    expect(routeLabel(route({ state: 'on_road', delivered_stops: 1 }))).toBe('w drodze 1/3');
    expect(routeLabel(route({ state: 'on_road', delivered_stops: 1, last_delivery: lastDelivery }))).toMatch(/^1\/3 · ostatnio \d{1,2}:57$/);
    expect(routeLabel(route({ state: 'done', last_delivery: lastDelivery }))).toMatch(/^zakończona \d{1,2}:57$/);
  });
});