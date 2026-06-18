export function Masthead({ asOf }: { asOf: string }) {
  const when = new Date(asOf).toLocaleString()
  return (
    <div className="masthead">
      <div className="brand">
        LendLogic
        <span>Delivery Readiness Console</span>
      </div>
      <div className="asof">
        as of
        <b>{when}</b>
      </div>
    </div>
  )
}
