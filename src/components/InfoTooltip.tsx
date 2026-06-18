import type { ReactNode } from 'react'

export function InfoTooltip({ children, flipLeft }: { children: ReactNode; flipLeft?: boolean }) {
  return (
    <span className={`info${flipLeft ? ' tip-left' : ''}`} tabIndex={0}>
      i<span className="tip">{children}</span>
    </span>
  )
}
