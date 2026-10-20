import type { HomeOrders } from '../../../services/api';
import { buildLanes, type LaneKey } from '../lib/home';
import { FlowBoard, type FlowLane, type FlowTone } from './FlowBoard';

const LANES: Record<LaneKey, { label: string; short: string; tone: FlowTone }> = {
  planned: { label: 'Zaplanowane', short: 'Plan', tone: 'neutral' },
  in_production: { label: 'W produkcji', short: 'Piec', tone: 'amber' },
  in_delivery: { label: 'W dostawie', short: 'Droga', tone: 'blue' },
  delivered: { label: 'Dostarczone', short: 'U klienta', tone: 'green' },
};

const FOCUS_ORDER: LaneKey[] = ['in_production', 'in_delivery', 'planned', 'delivered'];

export function OrderFlow({ orders }: { orders: HomeOrders }) {
  const lanes: FlowLane[] = buildLanes(orders.items).map((lane) => ({
    key: lane.key,
    ...LANES[lane.key],
    summary: lane.pieces > 0 ? `${lane.pieces} szt.` : undefined,
    cards: lane.cards.map((card) => ({
      key: card.key,
      badge: card.initials,
      title: card.clientName,
      detail: card.failed ? `nieudana · ${card.detail}` : `${card.detail} · ${card.pieces} szt.`,
      failed: card.failed,
    })),
  }));
  const initialKey = FOCUS_ORDER.find((key) => lanes.some((lane) => lane.key === key && lane.cards.length > 0)) ?? 'planned';

  return (
    <FlowBoard
      title="Droga zamówień"
      link={{ to: '/orders', label: 'Zamówienia' }}
      lanes={lanes}
      initialKey={initialKey}
      empty={orders.total === 0 ? (
        <p className="m-0 px-5 py-6 rounded-[18px] bg-bakery-card border border-bakery-btnBorder text-sm font-semibold text-[#5f5a58]">
          Na dziś nie ma zamówień. Gdy się pojawią, zobaczysz tu, na jakim są etapie.
        </p>
      ) : undefined}
    />
  );
}