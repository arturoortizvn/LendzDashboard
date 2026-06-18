import { useEffect, useState } from 'react'

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent))
    return () => cancelAnimationFrame(id)
  }, [percent])
  return (
    <div className="track">
      <div
        className="fill"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ width: `${width}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  )
}
