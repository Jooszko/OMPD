import { type FormEvent, useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import {
  createClient,
  GeocodeError,
  previewAddress,
  updateClient,
  type AppClient,
  type ClientPayload,
  type GeocodePreview,
  type RouteOption,
} from '../../../services/api';
import { Modal } from '../../dashboard/components/Modal';
import { ERROR_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../users/lib/formStyles';
import { apiErrorMessage } from '../../users/lib/staff';
import { isValidNip } from '../lib/clients';
import { LocationMap } from './LocationMap';

export type ClientFormMode = { kind: 'create' } | { kind: 'edit'; client: AppClient };

export function ClientFormDialog({
  mode,
  routes,
  routeSizes,
  onClose,
  onSaved,
}: {
  mode: ClientFormMode;
  routes: RouteOption[];
  routeSizes: Record<number, number>;
  onClose: () => void;
  onSaved: (client: AppClient) => void;
}) {
  const editing = mode.kind === 'edit' ? mode.client : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [nip, setNip] = useState(editing?.nip ?? '');
  const [routeId, setRouteId] = useState<number | null>(editing?.route ?? null);
  const [preview, setPreview] = useState<GeocodePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressChanged = editing !== null && address.trim() !== editing.address;
  const nipInvalid = nip.trim() !== '' && !isValidNip(nip);
  const losesLocation = addressChanged && preview === null && editing?.latitude !== null;

  const changeAddress = (value: string) => {
    setAddress(value);
    setPreview(null);
    setPreviewError(null);
  };

  const checkAddress = async () => {
    setChecking(true);
    setPreviewError(null);
    try {
      setPreview(await previewAddress(address.trim()));
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof GeocodeError ? err.message : 'Nie udało się sprawdzić adresu.');
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || routeId === null) {
      setError('Uzupełnij nazwę, adres i wybierz trasę.');
      return;
    }
    if (nipInvalid) {
      setError('NIP jest niepoprawny – sprawdź cyfry.');
      return;
    }
    const payload: ClientPayload = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      nip: nip.trim() || null,
      route: routeId,
    };
    if (preview) {
      payload.latitude = preview.latitude;
      payload.longitude = preview.longitude;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(editing ? await updateClient(editing.client_id, payload) : await createClient(payload));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Nie udało się zapisać klienta.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Edycja klienta' : 'Nowy klient'}
      subtitle={editing ? editing.name : 'Punkt dostaw trafi na wybraną trasę.'}
      closeDisabled={saving}
      customScrollbar
      initialFocusSelector="#client-name"
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4 font-auth">
        <label className={LABEL_CLASS}>
          Nazwa
          <input
            id="client-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Kawiarnia „Nad Wisłą”"
            className={FIELD_CLASS}
          />
        </label>

        <div className={LABEL_CLASS}>
          <label htmlFor="client-address">Adres dostawy</label>
          <div className="flex gap-2">
            <input
              id="client-address"
              type="text"
              value={address}
              onChange={(e) => changeAddress(e.target.value)}
              placeholder="ulica i numer, miejscowość"
              className={`${FIELD_CLASS} flex-1 min-w-0`}
            />
            <button
              type="button"
              onClick={checkAddress}
              disabled={checking || !address.trim()}
              className={`${SECONDARY_BUTTON} shrink-0 inline-flex items-center gap-2 px-3.5`}
            >
              <MapPin aria-hidden className="w-4 h-4" />
              <span className="hidden sm:inline">{checking ? 'Szukanie…' : 'Sprawdź na mapie'}</span>
              <span className="sm:hidden">{checking ? '…' : 'Mapa'}</span>
            </button>
          </div>
          {preview && (
            <div className="rounded-xl border border-[#e6e1df] overflow-hidden">
              <LocationMap latitude={preview.latitude} longitude={preview.longitude} label={preview.label} className="h-[130px]" />
              <p className="m-0 px-3 py-2 flex items-start gap-2 bg-[#eef8f0] text-[13px] font-bold text-[#1f5f33]">
                <CheckCircle2 aria-hidden className="w-4 h-4 shrink-0 mt-0.5" />
                Znaleziono: {preview.label}
              </p>
            </div>
          )}
          {previewError && <p className="m-0 text-xs font-bold text-[#991b1b]">{previewError}</p>}
          {losesLocation && (
            <p className="m-0 text-xs font-bold text-[#7a4300]">
              Po zmianie adresu stara lokalizacja zostanie usunięta. Sprawdź nowy adres na mapie, żeby ją zachować.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className={LABEL_CLASS}>
            Telefon
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+48 600 000 000"
              className={FIELD_CLASS}
            />
          </label>
          <label className={LABEL_CLASS}>
            <span>
              NIP <span className="font-semibold text-[#5f5a58]">(opcjonalnie)</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="10 cyfr – dla firm"
              aria-invalid={nipInvalid}
              className={`${FIELD_CLASS} font-mono ${nipInvalid ? 'border-[#b91c1c]' : ''}`}
            />
            {nipInvalid && <span className="font-semibold text-[#991b1b]">Niepoprawny NIP – sprawdź cyfry.</span>}
          </label>
        </div>

        <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
          <legend className="mb-2 text-xs font-extrabold text-[#3d3937]">Trasa</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {routes.map((route) => (
              <label
                key={route.route_id}
                className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl bg-white cursor-pointer ${
                  routeId === route.route_id ? 'border-2 border-bakery-dark' : 'border border-bakery-btnBorder'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-extrabold">
                  <input
                    type="radio"
                    name="client-route"
                    checked={routeId === route.route_id}
                    onChange={() => setRouteId(route.route_id)}
                    className="m-0 w-4 h-4 accent-bakery-dark"
                  />
                  {route.route_name}
                </span>
                <span className="text-[11px] font-semibold text-[#5f5a58]">
                  {route.driver_name ?? 'bez kierowcy'} · {routeSizes[route.route_id] ?? 0} pkt
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className={ERROR_CLASS}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
            Anuluj
          </button>
          <button type="submit" disabled={saving || nipInvalid} className={PRIMARY_BUTTON}>
            {saving ? 'Zapisywanie…' : editing ? 'Zapisz zmiany' : 'Dodaj klienta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}