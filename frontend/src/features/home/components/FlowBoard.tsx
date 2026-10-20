import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type FlowTone = 'neutral' | 'amber' | 'blue' | 'violet' | 'green';

export interface FlowCard {
  key: string;
  badge: string;
  title: string;
  detail: string;
  failed?: boolean;
}

export interface FlowLane {
  key: string;
  label: string;
  short: string;
  tone: FlowTone;
  summary?: string;
  cards: FlowCard[];
}

const TONES: Record<FlowTone, { lane: string; dot: string; count: string; badge: string; tab: string }> = {
  neutral: {
    lane: 'bg-[#ebe7e5] border-[#d6d0cd]',
    dot: 'bg-[#8a8381]',
    count: 'text-[#3d3937]',
    badge: 'bg-[#e6e1df] text-[#3d3937]',
    tab: 'border-[#3d3937] bg-[#ebe7e5]',
  },
  amber: {
    lane: 'bg-[#fdf3e2] border-[#f1c983]',
    dot: 'bg-[#e08a00]',
    count: 'text-[#9a5b00]',
    badge: 'bg-[#fbe5bd] text-[#7a4300]',
    tab: 'border-[#9a5b00] bg-[#fdf3e2]',
  },
  blue: {
    lane: 'bg-[#eaf1fb] border-[#bcd0ec]',
    dot: 'bg-[#2f6fbf]',
    count: 'text-[#1d4f91]',
    badge: 'bg-[#dfe8f6] text-[#1d4f91]',
    tab: 'border-[#1d4f91] bg-[#eaf1fb]',
  },
  violet: {
    lane: 'bg-[#f3eefb] border-[#d5c6ee]',
    dot: 'bg-[#7c5cc4]',
    count: 'text-[#4f3593]',
    badge: 'bg-[#e6dcf6] text-[#4f3593]',
    tab: 'border-[#4f3593] bg-[#f3eefb]',
  },
  green: {
    lane: 'bg-[#eef8f0] border-[#b9dcc2]',
    dot: 'bg-[#1f7a3a]',
    count: 'text-[#17532b]',
    badge: 'bg-[#cdebd5] text-[#17532b]',
    tab: 'border-[#17532b] bg-[#eef8f0]',
  },
};

interface FlowBoardProps {
  title: string;
  link: { to: string; label: string };
  lanes: FlowLane[];
  initialKey: string;
  empty?: ReactNode;
}

export function FlowBoard({ title, link, lanes, initialKey, empty }: FlowBoardProps) {
  const [selected, setSelected] = useState(initialKey);
  const titleId = `flow-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 id={titleId} className="m-0 min-w-0 font-display text-[22px] sm:text-[26px] font-extrabold tracking-[-0.01em]">
          {title}
        </h2>
        <Link to={link.to} className="shrink-0 whitespace-nowrap text-[13px] sm:text-sm font-extrabold text-bakery-dark">
          {link.label}
        </Link>
      </div>

      {empty ?? (
        <>
          <div role="tablist" aria-label={title} className="sm:hidden grid gap-1.5" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
            {lanes.map((lane) => {
              const active = lane.key === selected;
              const tone = TONES[lane.tone];
              return (
                <button
                  key={lane.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${titleId}-${lane.key}`}
                  onClick={() => setSelected(lane.key)}
                  className={`min-h-16 px-1 py-2 rounded-[14px] border flex flex-col items-center gap-1 ${
                    active ? tone.tab : 'border-bakery-btnBorder bg-bakery-card'
                  }`}
                >
                  <span className={`font-display text-2xl leading-none font-extrabold ${tone.count}`}>{lane.cards.length}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#3d3937]">{lane.short}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            {lanes.map((lane) => {
              const tone = TONES[lane.tone];
              return (
                <div
                  key={lane.key}
                  id={`${titleId}-${lane.key}`}
                  role="tabpanel"
                  aria-label={lane.label}
                  className={`${lane.key === selected ? 'flex' : 'hidden'} sm:flex min-w-0 flex-col gap-3 p-4 rounded-[18px] border ${tone.lane}`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#3d3937]">
                      <span aria-hidden className={`size-2.5 rounded-full ${tone.dot}`} />
                      {lane.label}
                    </span>
                    {lane.summary && <span className="text-xs font-extrabold text-[#5f5a58]">{lane.summary}</span>}
                  </div>
                  <span className={`font-display text-[44px] sm:text-[48px] leading-[0.9] font-extrabold ${tone.count}`}>
                    {lane.cards.length}
                  </span>
                  {lane.cards.length === 0 ? (
                    <span className="text-[13px] font-semibold text-[#5f5a58]">Nic tu teraz nie ma.</span>
                  ) : (
                    <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                      {lane.cards.map((card) => (
                        <li key={card.key} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                          <span
                            aria-hidden
                            className={`shrink-0 size-8 rounded-[10px] flex items-center justify-center text-xs font-extrabold ${
                              card.failed ? 'bg-[#f8cccc] text-[#8f1616]' : tone.badge
                            }`}
                          >
                            {card.badge}
                          </span>
                          <span className="flex-1 min-w-0 flex flex-col gap-px">
                            <span className="text-[13px] font-extrabold truncate">{card.title}</span>
                            <span className={`text-xs font-semibold truncate ${card.failed ? 'text-[#8f1616]' : 'text-[#5f5a58]'}`}>
                              {card.detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}