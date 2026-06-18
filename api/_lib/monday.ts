export interface RawStory {
  name: string
  status: string
  module: string | null
}

interface MondayColumnValue {
  id: string
  text: string | null
}

interface MondayItem {
  name: string
  column_values: MondayColumnValue[]
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

function toStory(item: MondayItem, moduleColumnId: string): RawStory {
  const textOf = (id: string) => item.column_values.find((c) => c.id === id)?.text ?? null
  return {
    name: item.name,
    status: textOf('task_status') ?? '',
    module: textOf(moduleColumnId),
  }
}

export async function fetchBoardStories(opts: {
  token: string
  boardId: number
  moduleColumnId: string
  pageLimit?: number
  fetchImpl?: typeof fetch
}): Promise<RawStory[]> {
  const { token, boardId, moduleColumnId, pageLimit = 100, fetchImpl = fetch } = opts
  const cols = JSON.stringify(['task_status', moduleColumnId])
  const out: RawStory[] = []

  const firstData = await mondayRequest(
    fetchImpl,
    token,
    `query { boards(ids: ${boardId}) { items_page(limit: ${pageLimit}) { cursor items { name column_values(ids: ${cols}) { id text } } } } }`,
  )
  let page = (firstData.boards as Array<{ items_page: ItemsPage }>)[0].items_page
  out.push(...page.items.map((i) => toStory(i, moduleColumnId)))

  while (page.cursor) {
    const nextData = await mondayRequest(
      fetchImpl,
      token,
      `query { next_items_page(limit: ${pageLimit}, cursor: "${page.cursor}") { cursor items { name column_values(ids: ${cols}) { id text } } } }`,
    )
    page = nextData.next_items_page as ItemsPage
    out.push(...page.items.map((i) => toStory(i, moduleColumnId)))
  }

  return out
}
