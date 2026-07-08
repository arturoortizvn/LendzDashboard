export type SubtaskTone = 'green' | 'amber' | 'grey' | 'red'

export function subtaskStatus(status: string): { tone: SubtaskTone; done: boolean } {
  switch (status) {
    case 'Done':
      return { tone: 'green', done: true }
    case 'Working on it':
    case 'In Progress':
      return { tone: 'amber', done: false }
    case 'Stuck':
      return { tone: 'red', done: false }
    default:
      return { tone: 'grey', done: false }
  }
}
