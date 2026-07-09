import { expect, test, vi } from 'vitest'
import { fetchBoardStories } from './monday'

function jsonRes(data: unknown) {
  return { ok: true, json: () => Promise.resolve({ data }) }
}

test('paginates via cursor and maps id/name/status/module', async () => {
  const moduleColId = 'status_module'
  const page1 = { boards: [{ items_page: { cursor: 'C1', items: [
    { id: '101', name: 'F-01-06 · Eligibility', column_values: [
      { id: 'task_status', text: 'Done' },
      { id: moduleColId, text: 'Pricing & Eligibility' },
    ] },
  ] } }] }
  const page2 = { next_items_page: { cursor: null, items: [
    { id: '102', name: 'CLTV issue', column_values: [
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
    { id: '101', name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility', subtasks: [] },
    { id: '102', name: 'CLTV issue', status: 'In Progress', module: null, subtasks: [] },
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
    { id: '55', name: 'Implement Bank Statement Analyzer', column_values: [
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
  expect(sentBody.query).toContain('items { id name')
  expect(stories).toEqual([
    { id: '55', name: 'Implement Bank Statement Analyzer', status: 'Not Started', module: null, subtasks: [] },
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

test('parses sub-items into subtasks with their status, unset status → empty string', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [
    { name: 'U-02-ID · ID Analyzer', column_values: [{ id: 'task_status', text: 'In Progress' }],
      subitems: [
        { name: 'U-02-ID-01: Structured extraction', column_values: [{ id: 'status', text: 'Done' }] },
        { name: 'U-02-ID-02: Provenance linking', column_values: [{ id: 'status', text: null }] },
      ] },
    { name: 'Story with no sub-items', column_values: [{ id: 'task_status', text: 'Done' }], subitems: [] },
  ] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))

  const stories = await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'task_status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  expect(stories[0].subtasks).toEqual([
    { name: 'U-02-ID-01: Structured extraction', status: 'Done' },
    { name: 'U-02-ID-02: Provenance linking', status: '' },
  ])
  expect(stories[1].subtasks).toEqual([])
})

test('requests the subitems field with the sub-item status column', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))
  await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'task_status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })
  const sentBody = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as { query: string }
  expect(sentBody.query).toContain('subitems { name column_values(ids: ["status"])')
})
