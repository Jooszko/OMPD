import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';

const store = vi.hoisted(() => new Map<string, unknown>());
const api = vi.hoisted(() => ({
  updateOrderStatus: vi.fn(),
  deliverStop: vi.fn(),
  reportStopProblem: vi.fn(),
  reportOrderProblem: vi.fn(),
  withdrawProblemReport: vi.fn(),
  saveStopDeliveryNote: vi.fn(),
}));

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  update: vi.fn(async (key: string, updater: (old: unknown) => unknown) => {
    store.set(key, updater(store.get(key)));
  }),
  delMany: vi.fn(async (keys: string[]) => {
    keys.forEach((key) => store.delete(key));
  }),
  keys: vi.fn(async () => [...store.keys()]),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
}));

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  ...api,
}));

const { createAction, enqueue, loadFailed, loadQueue, removeFromQueue, syncQueue } = await import('./actionQueue');

function deliverAction(clientId: number) {
  return createAction({ type: 'deliverStop', payload: { clientId }, label: `Klient ${clientId}` });
}

describe('actionQueue', () => {
  beforeEach(() => {
    store.clear();
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it('creates actions with unique ids and ISO time', () => {
    const first = deliverAction(1);
    const second = deliverAction(1);

    expect(first.id).not.toBe(second.id);
    expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Date(first.occurredAt).toISOString()).toBe(first.occurredAt);
  });

  it('sends queued actions in order with action headers and empties the queue', async () => {
    const first = deliverAction(1);
    const second = createAction({
      type: 'status',
      payload: { orderId: 7, status: 'delivered' },
      label: 'Pozycja 7',
    });
    await enqueue(first);
    await enqueue(second);
    api.deliverStop.mockResolvedValue({});
    api.updateOrderStatus.mockResolvedValue({});

    const result = await syncQueue();

    expect(result).toEqual({ sent: 2, failed: 0, pending: 0 });
    expect(api.deliverStop).toHaveBeenCalledWith(1, { actionId: first.id, occurredAt: first.occurredAt });
    expect(api.updateOrderStatus).toHaveBeenCalledWith(7, 'delivered', {
      actionId: second.id,
      occurredAt: second.occurredAt,
    });
    expect(api.deliverStop.mock.invocationCallOrder[0]).toBeLessThan(
      api.updateOrderStatus.mock.invocationCallOrder[0]
    );
    expect(await loadQueue()).toEqual([]);
  });

  it('stops on a network error and keeps the remaining actions in order', async () => {
    const first = deliverAction(1);
    const second = deliverAction(2);
    await enqueue(first);
    await enqueue(second);
    api.deliverStop.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await syncQueue();

    expect(result).toEqual({ sent: 0, failed: 0, pending: 2 });
    expect(api.deliverStop).toHaveBeenCalledTimes(1);
    expect((await loadQueue()).map((a) => a.id)).toEqual([first.id, second.id]);
  });

  it('keeps actions for later on server errors', async () => {
    await enqueue(deliverAction(1));
    api.deliverStop.mockRejectedValueOnce(new ApiError('Błąd serwera: 503', 503));

    const result = await syncQueue();

    expect(result.pending).toBe(1);
    expect(await loadFailed()).toEqual([]);
  });

  it('moves rejected actions to the failed list and continues', async () => {
    const rejected = deliverAction(1);
    const accepted = deliverAction(2);
    await enqueue(rejected);
    await enqueue(accepted);
    api.deliverStop
      .mockRejectedValueOnce(new ApiError('U tego klienta nie ma dziś zamówień w dostawie.', 400))
      .mockResolvedValueOnce({});

    const result = await syncQueue();

    expect(result).toEqual({ sent: 1, failed: 1, pending: 0 });
    const failed = await loadFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe(rejected.id);
    expect(failed[0].error).toBe('U tego klienta nie ma dziś zamówień w dostawie.');
  });

  it('runs only one synchronisation at a time', async () => {
    await enqueue(deliverAction(1));
    api.deliverStop.mockResolvedValue({});

    const [first, second] = await Promise.all([syncQueue(), syncQueue()]);

    expect(first).toBe(second);
    expect(api.deliverStop).toHaveBeenCalledTimes(1);
  });

  it('reports whether an action was still waiting when removed', async () => {
    const action = deliverAction(1);
    await enqueue(action);

    expect(await removeFromQueue(action.id)).toBe(true);
    expect(await removeFromQueue(action.id)).toBe(false);
  });
});