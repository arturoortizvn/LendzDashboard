import { expect, test, vi } from 'vitest'
import { fetchBoardStories } from './monday'

function jsonRes(data: unknown) {
  return { ok: true, json: () => Promise.resolve({ data }) }
}

test('paginates via cursor and maps name/status/module', async () => {
  const moduleColId = 'status_module'
  const page1 = { boards: [{ items_page: { cursor: 'C1', items: [
    { name: 'F-01-06 · Eligibility', column_values: [
      { id: 'task_status', text: 'Done' },
      { id: moduleColId, text: 'Pricing & Eligibility' },
    ] },
  ] } }] }
  const page2 = { next_items_page: { cursor: null, items: [
    { name: 'CLTV issue', column_values: [
      { id: 'task_status', text: 'In Progress' },
      { id: moduleColId, text: null },
    ] },
  ] } }
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonRes(page1))
    .mockResolvedValueOnce(jsonRes(page2))

  const stories = await fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: moduleColId,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  expect(fetchImpl).toHaveBeenCalledTimes(2)
  expect(stories).toEqual([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
    { name: 'CLTV issue', status: 'In Progress', module: null },
  ])
})

test('throws on a GraphQL errors payload', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true, json: () => Promise.resolve({ errors: [{ message: 'bad' }] }),
  })
  await expect(fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: 'm',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/Monday API error/)
})

test('throws on a non-ok HTTP response', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
  await expect(fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: 'm',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/HTTP 500/)
})

test('throws a descriptive error when boards array is empty', async () => {
  const fetchImpl = vi.fn().mockResolvedValue(jsonRes({ boards: [] }))
  await expect(fetchBoardStories({
    token: 't', boardId: 99, moduleColumnId: 'm',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/not found/)
})

test('reads a custom status column and omits the module column when absent', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [
    { name: 'Implement Bank Statement Analyzer', column_values: [
      { id: 'status', text: 'Not Started' },
    ] },
  ] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))

  const stories = await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  const sentBody = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as { query: string }
  expect(sentBody.query).toContain('ids: ["status"]')
  expect(stories).toEqual([
    { name: 'Implement Bank Statement Analyzer', status: 'Not Started', module: null },
  ])
})

test('throws when paginated response is missing next_items_page', async () => {
  const page1 = { boards: [{ items_page: { cursor: 'C1', items: [
    { name: 'Story A', column_values: [
      { id: 'task_status', text: 'Done' },
      { id: 'status_module', text: null },
    ] },
  ] } }] }
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonRes(page1))
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: {} }) })

  await expect(fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: 'status_module',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/missing next_items_page/)
})
