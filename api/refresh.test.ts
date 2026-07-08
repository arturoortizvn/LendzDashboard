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
  process.env.MONDAY_MODULE_COLUMN_ID = 'status_module'
  process.env.ID_MONDAY = '18402839374'
  process.env.ID_MONDAY_ANALYZERS = '18403908550'
})
afterEach(() => vi.clearAllMocks())

test('rejects requests without the cron secret', async () => {
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(401)
  expect(fetchBoardStories).not.toHaveBeenCalled()
  expect(writeLatest).not.toHaveBeenCalled()
})

test('fetches all six boards, assembles, writes the blob, and returns 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
  ])
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(fetchBoardStories).toHaveBeenCalledTimes(6)
  const boardIds = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0].boardId)
  expect(boardIds).toEqual(
    expect.arrayContaining([18402839374, 18420951194, 18420951197, 18420951201, 18420951200, 18403908550]),
  )
  expect(writeLatest).toHaveBeenCalledTimes(1)

  const calls = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0])
  const byBoard = (id: number) => calls.find((c) => c.boardId === id)!
  // dedicated analyzer boards: task_status, no module column
  for (const id of [18420951194, 18420951197, 18420951201, 18420951200]) {
    expect(byBoard(id).statusColumnId).toBe('task_status')
    expect(byBoard(id).moduleColumnId).toBeUndefined()
  }
  // shared Tax board: status column + module column
  expect(byBoard(18403908550).statusColumnId).toBe('status')
  expect(byBoard(18403908550).moduleColumnId).toBeDefined()
  // stories board: module column present
  expect(byBoard(18402839374).moduleColumnId).toBeDefined()
})

test('on a Monday failure returns 500 and does NOT overwrite the blob', async () => {
  vi.mocked(fetchBoardStories).mockRejectedValue(new Error('Monday API HTTP 500'))
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(500)
  expect(writeLatest).not.toHaveBeenCalled()
})
