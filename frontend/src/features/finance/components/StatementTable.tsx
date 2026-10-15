import type { Statement, StatementLine } from '../../../services/api';
import { changeVsPrevious, formatMoney } from '../lib/money';
import { isCostLine } from '../lib/reports';
import { ChangeBadge } from './ChangeBadge';

const ROW_STYLE: Record<StatementLine['level'], { row: string; label: string; size: string }> = {
  item: { row: 'border-t border-bakery-rowBg', label: 'pl-3 font-bold', size: 'text-sm font-bold' },
  sub: { row: 'border-t border-bakery-rowBg', label: 'pl-8 font-semibold text-[#4a4543]', size: 'text-sm font-semibold' },
  sum: { row: 'border-t border-bakery-btnBorder', label: 'pl-3 font-extrabold', size: 'text-sm font-extrabold' },
  total: { row: 'border-t-2 border-bakery-btnBorder bg-[#f3ede9]', label: 'pl-3 font-extrabold text-[17px]', size: 'text-[17px] font-extrabold' },
};

export function StatementTable({ statement, printable = false }: { statement: Statement; printable?: boolean }) {
  const { period } = statement;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left tabular-nums">
        <thead>
          <tr className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#5f5a58]">
            <th scope="col" className="py-2 pl-3 pr-3">Pozycja</th>
            <th scope="col" className="py-2 px-3 text-right">{period.label}</th>
            <th scope="col" className="py-2 px-3 text-right">{period.previous_label}</th>
            {!printable && <th scope="col" className="py-2 pl-3 pr-3 text-right w-[120px]">Zmiana</th>}
          </tr>
        </thead>
        <tbody>
          {statement.lines.map((line) => {
            const style = ROW_STYLE[line.level];
            const cost = isCostLine(line);
            return (
              <tr key={line.key} className={style.row}>
                <th scope="row" className={`py-2.5 pr-3 ${style.label}`}>
                  {line.label}
                </th>
                <td className={`py-2.5 px-3 text-right ${style.size}`}>{formatMoney(line.amount, { cents: true })}</td>
                <td className="py-2.5 px-3 text-right text-sm font-semibold text-[#4a4543]">
                  {formatMoney(line.previous, { cents: true })}
                </td>
                {!printable && (
                  <td className="py-2.5 px-3 text-right">
                    <ChangeBadge
                      change={
                        cost
                          ? changeVsPrevious(Math.abs(Number(line.amount)), Math.abs(Number(line.previous)), 'cost')
                          : changeVsPrevious(line.amount, line.previous, 'income')
                      }
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}