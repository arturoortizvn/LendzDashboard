import { SUBITEM_STATUS_COLUMN_ID } from './config.js'

export interface RawSubtask {
  name: string
  status: string
}

export interface RawStory {
  name: string
  status: string
  module: string | null
  subtasks?: RawSubtask[]
}

interface MondayColumnValue {
  id: string
  text: string | null
}

interface MondaySubitem {
  name: string
  column_values: MondayColumnValue[]
}

interface MondayItem {
  name: string
  column_values: MondayColumnValue[]
  subitems?: MondaySubitem[]
}

interface ItemsPage {
  cursor: string | null
  items: MondayItem[]
}

const MONDAY_API = 'https://api.monday.com/v2'

async function mondayRequest(
  fetchImpl: typeof fetch,
  token: string,
  query: string,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Monday API HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown }
  if (json.errors) throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`)
  return json.data ?? {}
}

function toStory(item: MondayItem, statusColumnId: string, moduleColumnId?: string): RawStory {
  const textOf = (id: string) => item.column_values.find((c) => c.id === id)?.text ?? null
  return {
    name: item.name,
    status: textOf(statusColumnId) ?? '',
    module: moduleColumnId ? textOf(moduleColumnId) : null,
    subtasks: (item.subitems ?? []).map((s) => ({
      name: s.name,
      status: s.column_values.find((c) => c.id === SUBITEM_STATUS_COLUMN_ID)?.text ?? '',
    })),
  }
}

export async function fetchBoardStories(opts: {
  token: string
  boardId: number
  statusColumnId?: string
  moduleColumnId?: string
  pageLimit?: number
  fetchImpl?: typeof fetch
}): Promise<RawStory[]> {
  const { token, boardId, statusColumnId = 'task_status', moduleColumnId, pageLimit = 100, fetchImpl = fetch } = opts
  const cols = JSON.stringify(moduleColumnId ? [statusColumnId, moduleColumnId] : [statusColumnId])
  const itemFields = `name column_values(ids: ${cols}) { id text } subitems { name column_values(ids: ["${SUBITEM_STATUS_COLUMN_ID}"]) { id text } }`
  const out: RawStory[] = []

  const firstData = await mondayRequest(
    fetchImpl,
    token,
    `query { boards(ids: ${boardId}) { items_page(limit: ${pageLimit}) { cursor items { ${itemFields} } } } }`,
  )
  const firstBoard = (firstData.boards as Array<{ items_page: ItemsPage }>)[0]
  if (!firstBoard) throw new Error(`Monday board ${boardId} not found`)
  let page = firstBoard.items_page
  out.push(...page.items.map((i) => toStory(i, statusColumnId, moduleColumnId)))

  while (page.cursor) {
    const nextData = await mondayRequest(
      fetchImpl,
      token,
      `query { next_items_page(limit: ${pageLimit}, cursor: "${page.cursor}") { cursor items { ${itemFields} } } }`,
    )
    if (!nextData.next_items_page) throw new Error('Monday API: missing next_items_page in paginated response')
    page = nextData.next_items_page as ItemsPage
    out.push(...page.items.map((i) => toStory(i, statusColumnId, moduleColumnId)))
  }

  return out
}
