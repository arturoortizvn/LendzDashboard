import { afterEach, beforeEach, expect, test, vi } from 'vitest'

vi.mock('./monday.js', () => ({ fetchBoardStories: vi.fn() }))
vi.mock('./blob.js', () => ({ writeLatest: vi.fn() }))

import { runRefresh } from './refresh-core'
import { fetchBoardStories } from './monday.js'
import { writeLatest } from './blob.js'

beforeEach(() => {
  process.env.MONDAY_API_TOKEN = 'tok'
})
afterEach(() => vi.clearAllMocks())

test('fetches every board-backed board with its status column, assembles, writes, returns a summary', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([{ id: 'x', name: 'X', status: 'Done', module: null }])
  const result = await runRefresh()
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
  expect(result.modules).toBeGreaterThan(0)
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
  await runRefresh()

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
  await runRefresh()
  expect(writeLatest).toHaveBeenCalledTimes(1)
  const payload = vi.mocked(writeLatest).mock.calls[0][0] as { modules: Array<{ key: string; assumed: boolean }> }
  expect(payload.modules.find((m) => m.key === 'uw')!.assumed).toBe(true)
  expect(payload.modules.find((m) => m.key === 'pe')!.assumed).toBe(false)
})

test('all boards failing throws and does NOT write the blob', async () => {
  vi.mocked(fetchBoardStories).mockRejectedValue(new Error('Monday down'))
  await expect(runRefresh()).rejects.toThrow(/all Monday board fetches failed/)
  expect(writeLatest).not.toHaveBeenCalled()
})
