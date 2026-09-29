const flowNodes = [
  { x: 48, y: 75 },
  { x: 148, y: 32 },
  { x: 248, y: 78 },
  { x: 198, y: 154 },
  { x: 92, y: 163 },
];

export function CommandCenterHero() {
  return (
    <section className="landiq-hero">
      <div className="landiq-hero__glow" aria-hidden="true" />
      <div className="landiq-hero__grid" aria-hidden="true" />
      <div className="landiq-hero__panel">
        <div className="landiq-hero__copy">
          <h1>LAND-IQ Command Center</h1>
          <p>Operational overview of land records, verification, risk, monitoring, and analytics in your active scope.</p>
        </div>

        <div className="landiq-hero__visual" aria-hidden="true">
          <svg viewBox="0 0 360 220" role="presentation">
            <defs>
              <linearGradient id="landiq-link" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(100, 196, 161, 0.9)" />
                <stop offset="100%" stopColor="rgba(125, 164, 255, 0.9)" />
              </linearGradient>
            </defs>

            <path d="M48 75 L148 32 L248 78 L198 154 L92 163 L48 75" fill="none" stroke="url(#landiq-link)" strokeWidth="1.2" strokeDasharray="7 9" opacity="0.9" />
            <path d="M148 32 L92 163" fill="none" stroke="url(#landiq-link)" strokeWidth="1.2" strokeDasharray="7 9" opacity="0.75" />
            <path d="M248 78 L92 163" fill="none" stroke="url(#landiq-link)" strokeWidth="1.2" strokeDasharray="7 9" opacity="0.7" />

            {flowNodes.map((node) => (
              <g key={`${node.x}-${node.y}`} className="landiq-node" transform={`translate(${node.x} ${node.y})`}>
                <circle r="16" className="landiq-node__core" />
                <circle r="26" className="landiq-node__halo" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
