import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

vi.mock('./_lib/monday.js', () => ({ fetchBoardStories: vi.fn() }))
vi.mock('./_lib/blob.js', () => ({ writeLatest: vi.fn() }))

import handler from './refresh'
import { fetchBoardStories } from './_lib/monday.js'
import { writeLatest } from './_lib/blob.js'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number } = {
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

beforeEach(() => {
  process.env.CRON_SECRET = 'secret'
  process.env.MONDAY_API_TOKEN = 'tok'
})
afterEach(() => vi.clearAllMocks())

const authed = { headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest

test('rejects requests without the cron secret', async () => {
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(401)
  expect(fetchBoardStories).not.toHaveBeenCalled()
  expect(writeLatest).not.toHaveBeenCalled()
})

test('fetches every board-backed board with its status column, assembles, writes, and returns 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([{ id: 'x', name: 'X', status: 'Done', module: null }])
  const res = mockRes()
  await handler(authed, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  // Eight board-backed modules; lexi and broker both read the shared Broker LOS board.
  expect(fetchBoardStories).toHaveBeenCalledTimes(8)
  const calls = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0])
  const boardIds = calls.map((c) => c.boardId)
  expect(boardIds).toEqual(
    expect.arrayContaining([
      18420951236, 18420951193, 18420631446, 18420951194, 18420951197, 18420951201, 18420951200,
    ]),
  )
  // The Broker LOS board is fetched twice: once for broker, once for lexi.
  expect(boardIds.filter((id) => id === 18420631446)).toHaveLength(2)
  // The Broker LOS board keeps its status in `status`; every other board uses `task_status`.
  const statusColumnByBoard = new Map(calls.map((c) => [c.boardId, c.statusColumnId]))
  expect(statusColumnByBoard.get(18420631446)).toBe('status')
  for (const [boardId, col] of statusColumnByBoard) {
    if (boardId !== 18420631446) expect(col).toBe('task_status')
  }
  expect(writeLatest).toHaveBeenCalledTimes(1)
})

test('the shared Broker LOS board routes the seven Lexi items to lexi, the rest to broker', async () => {
  const lexiIds = [
    '12451013226', '12482521999', '12482526623', '12451140139',
    '12451122951', '12451013290', '12451008846',
  ]
  const brokerId = 18420631446
  const brokerBoardStories = [
    ...lexiIds.map((id) => ({ id, name: `Lexi ${id}`, status: 'Done', module: null })),
    { id: '90001', name: 'Broker One', status: 'Done', module: null },
    { id: '90002', name: 'Broker Two', status: 'Done', module: null },
  ]
  vi.mocked(fetchBoardStories).mockImplementation((opts: { boardId: number }) =>
    Promise.resolve(
      opts.boardId === brokerId
        ? brokerBoardStories
        : [{ id: 'x', name: 'X', status: 'Done', module: null }],
    ),
  )
  const res = mockRes()
  await handler(authed, res as VercelResponse)
  expect(res.statusCode).toBe(200)

  const payload = vi.mocked(writeLatest).mock.calls[0][0] as {
    modules: Array<{ key: string; buckets: { delivered: Array<{ title: string }> } }>
  }
  const titlesOf = (key: string) =>
    payload.modules.find((m) => m.key === key)!.buckets.delivered.map((b) => b.title).sort()

  const lexiTitles = titlesOf('lexi')
  const brokerTitles = titlesOf('broker')
  expect(lexiTitles).toEqual(lexiIds.map((id) => `Lexi ${id}`).sort())
  expect(brokerTitles).toEqual(['Broker One', 'Broker Two'])
  // Exclusive partition: no title is counted in both modules.
  expect(lexiTitles.filter((t) => brokerTitles.includes(t))).toEqual([])
})

test('one board failing still writes; that module falls back to assumed, others live', async () => {
  vi.mocked(fetchBoardStories).mockImplementation((opts: { boardId: number }) =>
    opts.boardId === 18420951193
      ? Promise.reject(new Error('board gone'))
      : Promise.resolve([{ id: 'x', name: 'X', status: 'Done', module: null }]),
  )
  const res = mockRes()
  await handler(authed, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(writeLatest).toHaveBeenCalledTimes(1)
  const payload = vi.mocked(writeLatest).mock.calls[0][0] as { modules: Array<{ key: string; assumed: boolean }> }
  expect(payload.modules.find((m) => m.key === 'uw')!.assumed).toBe(true)
  expect(payload.modules.find((m) => m.key === 'pe')!.assumed).toBe(false)
})

test('all boards failing returns 500 and does NOT overwrite the blob', async () => {
  vi.mocked(fetchBoardStories).mockRejectedValue(new Error('Monday down'))
  const res = mockRes()
  await handler(authed, res as VercelResponse)
  expect(res.statusCode).toBe(500)
  expect(writeLatest).not.toHaveBeenCalled()
})
