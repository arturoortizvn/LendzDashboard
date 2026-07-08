import { render, screen } from '@testing-library/react'
import { BucketColumn } from './BucketColumn'
import type { BucketItem } from '../../shared/readiness'

test('renders title and item leads', () => {
  render(
    <BucketColumn
      tone="green"
      title="Delivered"
      count="53 stories"
      items={[{ title: 'Product catalog', detail: 'and field library.' }]}
    />,
  )
  expect(screen.getByText('Delivered')).toBeInTheDocument()
  expect(screen.getByText('53 stories')).toBeInTheDocument()
  expect(screen.getByText('Product catalog')).toBeInTheDocument()
})

test('renders the weight chip for any weight including 0, omits it when absent', () => {
  const { container } = render(
    <BucketColumn
      tone="amber"
      title="Holding"
      items={[
        { title: 'Reads correctly.', weight: 30 },
        { title: 'Cost at scale.', weight: 0 },
        { title: 'No weight here.' },
      ]}
    />,
  )
  expect(screen.getByText('30%')).toBeInTheDocument()
  expect(screen.getByText('0%')).toBeInTheDocument()
  expect(container.querySelectorAll('.wt')).toHaveLength(2)
})

test('omits the count line when count is not provided', () => {
  const { container } = render(<BucketColumn tone="grey" title="Remaining" items={[]} />)
  expect(container.querySelector('.bcount')).toBeNull()
})

test('renders sub-tasks with a roll-up count when a story has them', () => {
  const items: BucketItem[] = [
    { title: 'ID Analyzer', subtasks: [
      { title: 'Structured extraction', status: 'Done' },
      { title: 'Provenance linking', status: '' },
      { title: 'Discrepancy detection', status: 'Working on it' },
    ] },
  ]
  render(<BucketColumn tone="amber" title="In Progress" items={items} />)
  expect(screen.getByText('1/3 done')).toBeInTheDocument()
  expect(screen.getByText('Structured extraction')).toBeInTheDocument()
  expect(screen.getByText('Provenance linking')).toBeInTheDocument()
})

test('renders no roll-up or sub-task list when a story has no sub-tasks', () => {
  const items: BucketItem[] = [{ title: 'Plain story' }]
  const { container } = render(<BucketColumn tone="green" title="Delivered" items={items} />)
  expect(screen.queryByText(/done$/)).not.toBeInTheDocument()
  expect(container.querySelector('.subtasks')).toBeNull()
})
