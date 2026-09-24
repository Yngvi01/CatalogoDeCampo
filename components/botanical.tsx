export function Botanical() {
  return (
    <svg viewBox="0 0 440 330" className="botanical" aria-hidden="true">
      <defs>
        <radialGradient id="glow">
          <stop stopColor="#81995b" stopOpacity=".16" />
          <stop offset="1" stopColor="#81995b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="leaf" x2="1" y2="1">
          <stop stopColor="#829965" stopOpacity=".7" />
          <stop offset="1" stopColor="#354738" stopOpacity=".2" />
        </linearGradient>
      </defs>
      <circle cx="235" cy="160" r="170" fill="url(#glow)" />
      <g fill="none" stroke="#7f9866" strokeWidth=".6" opacity=".24">
        <circle cx="245" cy="164" r="119" />
        <circle cx="245" cy="164" r="150" strokeDasharray="2 8" />
        <path d="M58 164h352M245 9v308" />
      </g>
      <g
        transform="translate(175 307) rotate(15)"
        stroke="#a0b77a"
        strokeWidth="1"
      >
        <path d="M0 0Q30-145 5-278" fill="none" />
        {Array.from({ length: 11 }, (_, i) => {
          const y = -25 - i * 22,
            w = 65 - Math.abs(i - 4) * 8;
          return (
            <g key={i}>
              <path
                d={`M${13 + i * 0.5} ${y} Q${-w} ${y - 5} ${-w + 4} ${y - 41} Q${-5} ${y - 36} ${13 + i * 0.5} ${y}`}
                fill="url(#leaf)"
              />
              <path
                d={`M${13 + i * 0.5} ${y} Q${w + 45} ${y - 15} ${w + 25} ${y - 53} Q${28} ${y - 36} ${13 + i * 0.5} ${y}`}
                fill="url(#leaf)"
              />
              <path
                d={`M${13 + i * 0.5} ${y}L${-w + 4} ${y - 41} M${13 + i * 0.5} ${y}L${w + 25} ${y - 53}`}
                opacity=".45"
              />
            </g>
          );
        })}
      </g>
      <g fill="#a0b77a" fontSize="9" fontFamily="monospace" opacity=".65">
        <text x="328" y="88">
          PLANTAE
        </text>
        <path d="M322 92h-30l-25 24" stroke="#a0b77a" fill="none" />
        <text x="68" y="256">
          OBS. 001
        </text>
        <text x="330" y="273">
          23° S
        </text>
      </g>
    </svg>
  );
}
