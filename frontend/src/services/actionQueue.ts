import { delMany, get, update } from 'idb-keyval';
import {
  ApiError,
  deliverStop,
  reportOrderProblem,
  reportStopProblem,
  saveStopReturns,
  saveStopDeliveryNote,
  updateOrderStatus,
  withdrawProblemReport,
  deleteDeliveryProof,
  uploadDeliveryProof,
  type DeliveryProof,
  type ActionOptions,
  type FailureReason,
  type LogisticsOrder,
  type ReturnItemInput,
} from './api';
import { isNetworkError } from './offlineCache';

const QUEUE_KEY = 'queue:actions';
const FAILED_KEY = 'queue:failed';

interface ActionBase {
  id: string;
  occurredAt: string;
  label: string;
}

export type QueuedAction = ActionBase &
  (
    | { type: 'status'; payload: { orderId: number; status: LogisticsOrder['status'] } }
    | { type: 'deliverStop'; payload: { clientId: number } }
    | { type: 'reportStopProblem'; payload: { clientId: number; reason: FailureReason; note: string } }
    | { type: 'reportOrderProblem'; payload: { orderId: number; reason: FailureReason; note: string } }
    | { type: 'withdrawProblem'; payload: { orderIds: number[] } }
    | { type: 'deliveryNote'; payload: { clientId: number; note: string } }
    | {
        type: 'uploadProof';
        payload: { clientId: number; kind: DeliveryProof['kind']; image: Blob; signerName: string };
      }
    | { type: 'deleteProof'; payload: { clientId: number; proofId: number } }
    | { type: 'saveReturns'; payload: { clientId: number; items: ReturnItemInput[]; date?: string } }
  );

export type FailedAction = QueuedAction & { error: string; failedAt: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewAction = DistributiveOmit<QueuedAction, 'id' | 'occurredAt'>;

export interface SyncResult {
  sent: number;
  failed: number;
  pending: number;
}

function newActionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createAction(input: NewAction): QueuedAction {
  return { ...input, id: newActionId(), occurredAt: new Date().toISOString() } as QueuedAction;
}

export async function loadQueue(): Promise<QueuedAction[]> {
  try {
    return (await get<QueuedAction[]>(QUEUE_KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function enqueue(action: QueuedAction): Promise<void> {
  await update<QueuedAction[]>(QUEUE_KEY, (queue = []) => [...queue, action]);
}

export async function removeFromQueue(actionId: string): Promise<boolean> {
  let removed = false;
  await update<QueuedAction[]>(QUEUE_KEY, (queue = []) => {
    const next = queue.filter((action) => action.id !== actionId);
    removed = next.length !== queue.length;
    return next;
  });
  return removed;
}

export async function loadFailed(): Promise<FailedAction[]> {
  try {
    return (await get<FailedAction[]>(FAILED_KEY)) ?? [];
  } catch {
    return [];
  }
}

async function addFailed(action: FailedAction): Promise<void> {
  await update<FailedAction[]>(FAILED_KEY, (failed = []) => [...failed, action]);
}

export async function dismissFailed(actionId: string): Promise<void> {
  await update<FailedAction[]>(FAILED_KEY, (failed = []) => failed.filter((action) => action.id !== actionId));
}

export async function clearFailed(): Promise<void> {
  await update<FailedAction[]>(FAILED_KEY, () => []);
}

export async function clearQueue(): Promise<void> {
  await delMany([QUEUE_KEY, FAILED_KEY]);
}

export function executeAction(action: QueuedAction): Promise<unknown> {
  const options: ActionOptions = { actionId: action.id, occurredAt: action.occurredAt };
  switch (action.type) {
    case 'status':
      return updateOrderStatus(action.payload.orderId, action.payload.status, options);
    case 'deliverStop':
      return deliverStop(action.payload.clientId, options);
    case 'reportStopProblem':
      return reportStopProblem(action.payload.clientId, action.payload.reason, action.payload.note, options);
    case 'reportOrderProblem':
      return reportOrderProblem(action.payload.orderId, action.payload.reason, action.payload.note, options);
    case 'withdrawProblem':
      return withdrawProblemReport(action.payload.orderIds, options);
    case 'uploadProof':
      return uploadDeliveryProof(
        action.payload.clientId,
        action.payload.kind,
        action.payload.image,
        action.payload.signerName,
        options
      );
    case 'deleteProof':
      return deleteDeliveryProof(action.payload.proofId, options);
    case 'deliveryNote':
      return saveStopDeliveryNote(action.payload.clientId, action.payload.note, options);
    case 'saveReturns':
      return saveStopReturns(action.payload.clientId, action.payload.items, options, action.payload.date);
  }
}

export function isRetryableError(error: unknown): boolean {
  return isNetworkError(error) || (error instanceof ApiError && error.status >= 500);
}

let syncInProgress: Promise<SyncResult> | null = null;

export function syncQueue(): Promise<SyncResult> {
  if (!syncInProgress) {
    syncInProgress = runSync().finally(() => {
      syncInProgress = null;
    });
  }
  return syncInProgress;
}

async function runSync(): Promise<SyncResult> {
  let sent = 0;
  let failed = 0;

  for (const action of await loadQueue()) {
    try {
      await executeAction(action);
      await removeFromQueue(action.id);
      sent += 1;
    } catch (error) {
      if (isRetryableError(error)) break;
      await removeFromQueue(action.id);
      await addFailed({
        ...action,
        error: error instanceof Error ? error.message : 'Nieznany błąd.',
        failedAt: new Date().toISOString(),
      });
      failed += 1;
    }
  }

  return { sent, failed, pending: (await loadQueue()).length };
}