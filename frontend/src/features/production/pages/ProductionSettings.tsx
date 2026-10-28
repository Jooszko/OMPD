import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
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
import { DoughsTab } from '../components/settings/DoughsTab';
import { MixersTab } from '../components/settings/MixersTab';
import { ProductsTab } from '../components/settings/ProductsTab';

type UserRole = 'admin' | 'baker' | 'driver';
type Tab = 'products' | 'doughs' | 'mixers';

const TABS: { id: Tab; label: string; more?: string }[] = [
  { id: 'products', label: 'Wyroby' },
  { id: 'doughs', label: 'Ciasta', more: ' i receptury' },
  { id: 'mixers', label: 'Mieszałki' },
];

const isTab = (value: string | null): value is Tab => TABS.some((t) => t.id === value);

type Dialog =
  | { kind: 'mixer'; mixer: ProductionMixer | null }
  | { kind: 'dough'; dough: ProductionDough | null }
  | { kind: 'spec'; row: ProductBakeSpecRow }
  | { kind: 'delete-dough'; dough: ProductionDough }
  | { kind: 'delete-spec'; row: ProductBakeSpecRow };

function TabCount({ tab, settings, active }: { tab: Tab; settings: Settings; active: boolean }) {
  if (tab === 'products') {
    const missing = settings.products.filter((row) => !row.spec).length;
    if (missing > 0) {
      return (
        <span className="px-2 py-0.5 rounded-full bg-[#ffe2b0] text-[#6b4300] text-[11px] font-extrabold tabular-nums">
          {missing}
          <span className="hidden sm:inline"> do uzupełnienia</span>
        </span>
      );
    }
  }
  const count = tab === 'products' ? settings.products.length : tab === 'doughs' ? settings.doughs.length : settings.mixers.length;
  return <span className={`text-xs font-bold tabular-nums ${active ? 'text-[#d9d2cf]' : 'text-[#5f5a58]'}`}>{count}</span>;
}

export default function ProductionSettings() {
  const { currentRole } = useOutletContext<{ currentRole: UserRole }>();
  const canEdit = currentRole === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const tabParam = searchParams.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'products';
  const setTab = (next: Tab) => setSearchParams(next === 'products' ? {} : { tab: next }, { replace: true });

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
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-5 font-auth text-bakery-dark">
      <header className="flex flex-col gap-1.5">
        <h1 className="m-0 font-display text-[32px] sm:text-[40px] leading-[1] font-extrabold tracking-[-0.02em]">
          Ustawienia produkcji
        </h1>
        <p className="m-0 max-w-3xl text-sm font-semibold text-[#5f5a58]">
          Z tych danych powstaje plan produkcji. Zmiany obejmują przyszłe plany, a zapisane plany zachowują swoje gramatury.
        </p>
      </header>

      <nav aria-label="Sekcje ustawień" className="overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-2xl bg-bakery-card border border-bakery-btnBorder">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl border-0 text-sm font-extrabold whitespace-nowrap cursor-pointer transition ${
                  active ? 'bg-bakery-dark text-white' : 'bg-transparent text-bakery-dark hover:bg-white'
                }`}
              >
                <span>
                  {t.label}
                  {t.more && <span className="hidden sm:inline">{t.more}</span>}
                </span>
                {settings && <TabCount tab={t.id} settings={settings} active={active} />}
              </button>
            );
          })}
        </div>
      </nav>

      {!canEdit && (
        <p className="m-0 text-[13px] font-semibold text-[#5f5a58]">Podgląd: ustawienia może zmieniać tylko kierownik.</p>
      )}
      {error && (
        <p role="alert" className="m-0 px-4 py-3 rounded-xl bg-[#fdecec] text-[#8f1616] text-sm font-bold">
          {error}
        </p>
      )}
      {!settings && !error && (
        <div role="status" aria-label="Ładowanie ustawień" className="h-[320px] rounded-[18px] bg-bakery-card animate-pulse" />
      )}

      {settings && tab === 'products' && (
        <ProductsTab
          settings={settings}
          canEdit={canEdit}
          onAssign={(row) => setDialog({ kind: 'spec', row })}
          onUnlink={(row) => setDialog({ kind: 'delete-spec', row })}
        />
      )}
      {settings && tab === 'doughs' && (
        <DoughsTab
          settings={settings}
          canEdit={canEdit}
          onAdd={() => setDialog({ kind: 'dough', dough: null })}
          onEdit={(dough) => setDialog({ kind: 'dough', dough })}
          onDelete={(dough) => setDialog({ kind: 'delete-dough', dough })}
        />
      )}
      {settings && tab === 'mixers' && (
        <MixersTab
          settings={settings}
          canEdit={canEdit}
          onAdd={() => setDialog({ kind: 'mixer', mixer: null })}
          onEdit={(mixer) => setDialog({ kind: 'mixer', mixer })}
        />
      )}

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
