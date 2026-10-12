import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Edit, Plus, Trash2, XCircle } from 'lucide-react';
import {
  deleteBakeSpec,
  deleteDough,
  fetchProductionSettings,
  saveBakeSpec,
  saveDough,
  saveMixer,
  type ProductBakeSpecRow,
  type ProductionDough,
  type ProductionMixer,
  type ProductionSettings as Settings,
} from '../../../services/api';
import { BakeSpecForm, ConfirmDialog, DoughForm, MixerForm } from '../components/SettingsForms';
import { formatAmount } from '../lib/productionStage';

type UserRole = 'admin' | 'baker' | 'driver';
type Tab = 'products' | 'doughs' | 'mixers';

const CATEGORY_LABELS: Record<string, string> = {
  bread: 'Chleby',
  buns: 'Bułki/Drożdżówki',
  pastry: 'Wyroby cukiernicze',
  other: 'Inne',
};

const CARD = 'bg-bakery-inactive rounded border border-bakery-btnBorder shadow-sm';
const TH = 'py-2 px-3 h-8';
const ADD_BUTTON =
  'flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-bakery-dark hover:bg-[#2e2e2e] text-white rounded shadow-xs transition active:scale-[0.98]';
const ROW_BUTTON =
  'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold bg-bakery-rowBg border border-bakery-btnBorder text-bakery-dark rounded hover:bg-[#dcd8d8] transition';
const ROW_DANGER =
  'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold border border-red-200 text-red-700 rounded hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed';

const kg = (value: string) => `${Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 3 })} kg`;

type Dialog =
  | { kind: 'mixer'; mixer: ProductionMixer | null }
  | { kind: 'dough'; dough: ProductionDough | null }
  | { kind: 'spec'; row: ProductBakeSpecRow }
  | { kind: 'delete-dough'; dough: ProductionDough }
  | { kind: 'delete-spec'; row: ProductBakeSpecRow };

function StatusBadge({ ok, okLabel, offLabel }: { ok: boolean; okLabel: string; offLabel: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
      <CheckCircle className="w-3 h-3" /> {okLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
      <XCircle className="w-3 h-3" /> {offLabel}
    </span>
  );
}

function ProductsTab({ settings, canEdit, open }: { settings: Settings; canEdit: boolean; open: (d: Dialog) => void }) {
  const missing = settings.products.filter((p) => !p.spec).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-xs text-gray-600 font-medium">
        Wyrób trafia do planowania produkcji dopiero, gdy ma przypisane ciasto i wagę kęsa.
        {missing > 0 && <span className="font-bold text-amber-800"> Bez parametrów: {missing}.</span>}
      </p>
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-left border-collapse">
          <thead className="bg-bakery-inactive">
            <tr className="border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider">
              <th className={TH}>Wyrób</th>
              <th className={TH}>Kategoria</th>
              <th className={TH}>Ciasto</th>
              <th className={`${TH} text-right`}>Kęs</th>
              <th className={`${TH} text-right`}>Wypiek</th>
              {canEdit && <th className={`${TH} text-right`}>Akcje</th>}
            </tr>
          </thead>
          <tbody className="text-sm">
            {settings.products.map((row) => (
              <tr key={row.product_id} className={`border-b border-bakery-btnBorder ${row.spec ? 'bg-bakery-rowBg' : 'bg-amber-50'}`}>
                <td className="py-2 px-3 font-bold">{row.product_name}</td>
                <td className="py-2 px-3 text-xs font-semibold text-gray-600">{CATEGORY_LABELS[row.category] ?? row.category}</td>
                <td className="py-2 px-3 text-xs font-semibold">
                  {row.spec ? (
                    row.spec.dough_name
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" /> Nieprzypisany — pomijany w planowaniu
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs">
                  {row.spec ? formatAmount(Number(row.spec.piece_weight_kg), 'kg') : '—'}
                </td>
                <td className="py-2 px-3 text-right text-xs tabular-nums">
                  {row.spec ? `${row.spec.bake_temp_c} °C · ${row.spec.bake_time_min} min` : '—'}
                </td>
                {canEdit && (
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1">
                      <button type="button" className={ROW_BUTTON} onClick={() => open({ kind: 'spec', row })}>
                        <Edit className="w-3.5 h-3.5" /> {row.spec ? 'Edytuj' : 'Przypisz'}
                      </button>
                      {row.spec && (
                        <button type="button" className={ROW_DANGER} onClick={() => open({ kind: 'delete-spec', row })}>
                          <Trash2 className="w-3.5 h-3.5" /> Odłącz
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DoughsTab({ settings, canEdit, open }: { settings: Settings; canEdit: boolean; open: (d: Dialog) => void }) {
  const mixerName = (id: number | null) =>
    id === null ? 'dobierana automatycznie' : settings.mixers.find((m) => m.mixer_id === id)?.name ?? '—';
  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div>
          <button type="button" className={ADD_BUTTON} onClick={() => open({ kind: 'dough', dough: null })}>
            <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj ciasto
          </button>
        </div>
      )}
      {settings.doughs.length === 0 && (
        <p className={`${CARD} m-0 p-6 text-center text-sm font-semibold text-gray-500`}>Brak zdefiniowanych ciast.</p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {settings.doughs.map((dough) => (
          <section key={dough.dough_id} className={`${CARD} p-4 flex flex-col gap-2`}>
            <header className="flex items-start justify-between gap-2">
              <div>
                <h2 className="m-0 text-base font-bold">{dough.name}</h2>
                <p className="m-0 text-[11px] font-semibold text-gray-600">
                  Mieszałka: {mixerName(dough.mixer_id)} · bufor {Number(dough.loss_buffer_pct)}% · wyrobów:{' '}
                  {dough.products_count}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <button type="button" className={ROW_BUTTON} onClick={() => open({ kind: 'dough', dough })}>
                    <Edit className="w-3.5 h-3.5" /> Edytuj
                  </button>
                  <button
                    type="button"
                    className={ROW_DANGER}
                    onClick={() => open({ kind: 'delete-dough', dough })}
                    disabled={dough.products_count > 0}
                    title={dough.products_count > 0 ? 'Ciasto jest przypisane do wyrobów.' : undefined}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </header>
            <p className="m-0 text-xs text-gray-700">
              Mieszanie {dough.mixing_time_min} min · ciasto {Number(dough.target_dough_temp_c)} °C · garowanie{' '}
              {dough.proofing_time_min} min
            </p>
            <ul className="m-0 p-0 list-none text-xs grid grid-cols-2 gap-x-3">
              {dough.ingredients.map((i) => (
                <li key={i.ingredient_id} className="flex justify-between gap-2 border-t border-bakery-rowBg py-0.5">
                  <span className="truncate">{i.name}</span>
                  <span className="font-mono">{formatAmount(Number(i.amount_per_kg), i.unit)} / kg</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function MixersTab({ settings, canEdit, open }: { settings: Settings; canEdit: boolean; open: (d: Dialog) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {canEdit && (
        <div>
          <button type="button" className={ADD_BUTTON} onClick={() => open({ kind: 'mixer', mixer: null })}>
            <Plus className="w-4 h-4 text-bakery-accent" /> Dodaj mieszałkę
          </button>
        </div>
      )}
      <div className={`${CARD} overflow-x-auto`}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-bakery-btnBorder text-[10px] font-bold uppercase tracking-wider">
              <th className={TH}>Nazwa</th>
              <th className={`${TH} text-right`}>Min. wsad</th>
              <th className={`${TH} text-right`}>Maks. wsad</th>
              <th className={`${TH} text-center`}>Status</th>
              {canEdit && <th className={`${TH} text-right`}>Akcje</th>}
            </tr>
          </thead>
          <tbody className="text-sm">
            {settings.mixers.map((mixer) => (
              <tr key={mixer.mixer_id} className="bg-bakery-rowBg border-b border-bakery-btnBorder">
                <td className="py-2 px-3 font-bold">{mixer.name}</td>
                <td className="py-2 px-3 text-right font-mono text-xs">{kg(mixer.min_capacity_kg)}</td>
                <td className="py-2 px-3 text-right font-mono text-xs">{kg(mixer.max_capacity_kg)}</td>
                <td className="py-2 px-3 text-center">
                  <StatusBadge ok={mixer.is_active} okLabel="Sprawna" offLabel="Wyłączona" />
                </td>
                {canEdit && (
                  <td className="py-2 px-3 text-right">
                    <button type="button" className={ROW_BUTTON} onClick={() => open({ kind: 'mixer', mixer })}>
                      <Edit className="w-3.5 h-3.5" /> Edytuj
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[11px] text-gray-500 font-medium">
        Mieszałek nie usuwa się — odwołują się do nich zapisane dzieże. Niesprawną mieszałkę wyłącz, a planowanie przestanie
        jej używać.
      </p>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Parametry wyrobów' },
  { id: 'doughs', label: 'Ciasta i receptury' },
  { id: 'mixers', label: 'Mieszałki' },
];

export default function ProductionSettings() {
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();
  const canEdit = currentRole === 'admin';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('products');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(
    () =>
      fetchProductionSettings()
        .then((result) => {
          setSettings(result);
          setError(null);
        })
        .catch((err: Error) => setError(err.message || 'Nie udało się pobrać ustawień.')),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const close = () => setDialog(null);
  const saved = () => {
    setDialog(null);
    load();
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-8 py-6 flex flex-col gap-5 text-bakery-dark">
      <div>
        <h1 className="m-0 mb-1 text-2xl font-bold tracking-tight">Ustawienia produkcji</h1>
        <p className="m-0 text-xs text-gray-500 font-medium">
          Mieszałki, ciasta z recepturą na 1 kg oraz parametry wyrobów, na podstawie których powstaje plan produkcji. Zmiany
          dotyczą przyszłych planów — zapisane plany zachowują swoje gramatury.
        </p>
      </div>

      <hr className="border-0 border-t border-bakery-border my-0" />

      <nav className="flex flex-wrap gap-2" aria-label="Sekcje ustawień">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 h-9 rounded text-xs font-bold border transition ${
              tab === t.id
                ? 'bg-bakery-dark text-white border-bakery-dark'
                : 'bg-bakery-rowBg text-bakery-dark border-bakery-btnBorder hover:bg-[#dcd8d8]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!canEdit && (
        <p className="m-0 text-xs font-semibold text-gray-600">Podgląd — ustawienia może zmieniać tylko kierownik.</p>
      )}
      {error && <p className="m-0 text-sm font-semibold text-red-600">{error}</p>}
      {!settings && !error && <p className="m-0 text-sm">Ładowanie danych z bazy...</p>}

      {settings && tab === 'products' && <ProductsTab settings={settings} canEdit={canEdit} open={setDialog} />}
      {settings && tab === 'doughs' && <DoughsTab settings={settings} canEdit={canEdit} open={setDialog} />}
      {settings && tab === 'mixers' && <MixersTab settings={settings} canEdit={canEdit} open={setDialog} />}

      {settings && dialog?.kind === 'mixer' && (
        <MixerForm
          mixer={dialog.mixer}
          onSave={(payload) => saveMixer(payload, dialog.mixer?.mixer_id ?? null)}
          onSaved={saved}
          onClose={close}
        />
      )}
      {settings && dialog?.kind === 'dough' && (
        <DoughForm
          dough={dialog.dough}
          settings={settings}
          onSave={(payload) => saveDough(payload, dialog.dough?.dough_id ?? null)}
          onSaved={saved}
          onClose={close}
        />
      )}
      {settings && dialog?.kind === 'spec' && (
        <BakeSpecForm
          row={dialog.row}
          settings={settings}
          onSave={(payload) => saveBakeSpec(dialog.row.product_id, payload)}
          onSaved={saved}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete-dough' && (
        <ConfirmDialog
          title="Usunąć ciasto?"
          message={`Ciasto „${dialog.dough.name}” i jego receptura zostaną usunięte.`}
          confirmLabel="Usuń ciasto"
          onConfirm={() => deleteDough(dialog.dough.dough_id).then(load)}
          onClose={close}
        />
      )}
      {dialog?.kind === 'delete-spec' && (
        <ConfirmDialog
          title="Odłączyć wyrób od produkcji?"
          message={`„${dialog.row.product_name}” przestanie trafiać do planów produkcji, dopóki nie przypiszesz mu ciasta ponownie.`}
          confirmLabel="Odłącz"
          onConfirm={() => deleteBakeSpec(dialog.row.product_id).then(load)}
          onClose={close}
        />
      )}
    </div>
  );
}
