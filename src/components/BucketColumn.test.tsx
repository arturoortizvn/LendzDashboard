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
