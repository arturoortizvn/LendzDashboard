import { expect, test } from 'vitest'
import { subtaskStatus } from './subtaskStatus'

test('maps sub-task statuses to a dot tone and a done flag', () => {
  expect(subtaskStatus('Done')).toEqual({ tone: 'green', done: true })
  expect(subtaskStatus('Working on it')).toEqual({ tone: 'amber', done: false })
  expect(subtaskStatus('In Progress')).toEqual({ tone: 'amber', done: false })
  expect(subtaskStatus('Stuck')).toEqual({ tone: 'red', done: false })
  expect(subtaskStatus('')).toEqual({ tone: 'grey', done: false })
  expect(subtaskStatus('Whatever')).toEqual({ tone: 'grey', done: false })
})
