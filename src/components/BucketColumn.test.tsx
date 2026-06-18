import { render, screen } from '@testing-library/react'
import { BucketColumn } from './BucketColumn'

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
