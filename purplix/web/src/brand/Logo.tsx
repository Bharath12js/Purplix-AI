/**
 * Purplix AI brand mark.
 *
 * Structure, matching the supplied artwork:
 *
 *   - The shield is TWO armour plates, not one ring: crimson left, steel right,
 *     with a seam that opens at the apex and closes at the point.
 *   - The plates are THICK — roughly a sixth of the shield's width. A thin
 *     frame reads as an icon; a thick one reads as armour.
 *   - The A-with-loop sits inside, but its apex breaks through the top edge
 *     and its left leg crosses over the crimson plate. That overlap is what
 *     gives the mark depth — an A tucked neatly inside reads as clip-art.
 *   - The loop stays fully contained. It is the continuous assurance loop, and
 *     a loop hanging out of the shield looks like a mistake.
 *   - Every surface carries a gloss gradient (highlight → base → shade).
 *
 * The gradient is the product thesis: crimson → purple → steel is
 * Red → Purple → Blue.
 */

type Props = { size?: number; className?: string; glow?: boolean }

export function Mark({ size = 40, className = '', glow = false }: Props) {
  // Below ~34px the crossbar, seam highlight and spark collapse into noise,
  // so the small form drops them and thickens what remains.
  const detail = size >= 34
  const uid = detail ? 'pxd' : 'pxs'
  const sw = detail ? 18 : 20

  return (
    <svg
      width={size}
      height={(size * 220) / 200}
      viewBox="0 0 200 220"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-red`} x1="28" y1="34" x2="110" y2="205" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F2879A" />
          <stop offset="22%" stopColor="#D84A63" />
          <stop offset="62%" stopColor="#BA2742" />
          <stop offset="100%" stopColor="#87102A" />
        </linearGradient>

        <linearGradient id={`${uid}-blue`} x1="176" y1="34" x2="98" y2="205" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9DC2EC" />
          <stop offset="22%" stopColor="#5A8ECF" />
          <stop offset="62%" stopColor="#36639F" />
          <stop offset="100%" stopColor="#1D3A66" />
        </linearGradient>

        <linearGradient id={`${uid}-mono`} x1="58" y1="40" x2="142" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E0BBFF" />
          <stop offset="22%" stopColor="#B06CF5" />
          <stop offset="58%" stopColor="#8B2FD6" />
          <stop offset="100%" stopColor="#5B1A93" />
        </linearGradient>

        <radialGradient id={`${uid}-spark`} cx="0.5" cy="0.42" r="0.6">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#F0DDFF" />
          <stop offset="100%" stopColor="#A855F7" />
        </radialGradient>

        {/* Shield frame: outer shield minus inner shield, drawn as one ring. */}
        <path
          id={`${uid}-ring`}
          fillRule="evenodd"
          d="M100 24 L178 52 V122 C178 167 144 198 100 213 C56 198 22 167 22 122 V52 Z
             M100 55 L151 73 V122 C151 151 129 173 100 185 C71 173 49 151 49 122 V73 Z"
        />

        {/* The seam: open at the apex, closing to nothing at the point. */}
        <clipPath id={`${uid}-clipL`}>
          <path d={detail ? 'M0 0 H95 V120 L100 220 H0 Z' : 'M0 0 H99 V220 H0 Z'} />
        </clipPath>
        <clipPath id={`${uid}-clipR`}>
          <path d={detail ? 'M105 0 H200 V220 H100 L105 120 Z' : 'M101 0 H200 V220 H101 Z'} />
        </clipPath>

        {glow && (
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
              result="bs"
            />
            <feMerge>
              <feMergeNode in="bs" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      <g filter={glow ? `url(#${uid}-glow)` : undefined}>
        {/* armour plates */}
        <g clipPath={`url(#${uid}-clipL)`}>
          <use href={`#${uid}-ring`} fill={`url(#${uid}-red)`} />
        </g>
        <g clipPath={`url(#${uid}-clipR)`}>
          <use href={`#${uid}-ring`} fill={`url(#${uid}-blue)`} />
        </g>

        {/* specular highlight along the top bevel of each plate */}
        {detail && (
          <>
            <path
              d="M104 33 L168 56 V78"
              stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="4.5"
              strokeLinecap="round" fill="none"
            />
            <path
              d="M96 33 L32 56 V78"
              stroke="#FFFFFF" strokeOpacity="0.30" strokeWidth="4.5"
              strokeLinecap="round" fill="none"
            />
          </>
        )}

        {/* monogram — over the frame, so the left leg crosses the crimson plate */}
        <g
          stroke={`url(#${uid}-mono)`}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeWidth={sw}
        >
          <path d="M100 48 L58 165" />
          <path d="M100 48 L120 106" />
        </g>
        <circle
          cx="101" cy="140" r={detail ? 26 : 27}
          stroke={`url(#${uid}-mono)`} strokeWidth={sw} fill="none"
        />
        {detail && (
          <path
            d="M76 111 H118"
            stroke={`url(#${uid}-mono)`} strokeWidth="14" strokeLinecap="round"
          />
        )}

        {/* Apex spark. Concave curved sides, not straight edges — straight
            lines at this scale read as a needle rather than a sparkle. */}
        {detail && (
          <path
            d="M100 4 C103 20 108 25 124 28 C108 31 103 36 100 52
               C97 36 92 31 76 28 C92 25 97 20 100 4 Z"
            fill={`url(#${uid}-spark)`}
          />
        )}
      </g>
    </svg>
  )
}

/**
 * Full lockup. `stack` puts the wordmark under the mark, as on the hero.
 *
 * Poppins for the wordmark — geometric, with the round single-storey 'a' the
 * artwork uses. Inter's 'a' is double-storey and reads as a different logo.
 */
export function Logo({
  size = 34,
  tagline = true,
  stack = false,
  className = '',
  glow = false,
}: {
  size?: number; tagline?: boolean; stack?: boolean; className?: string; glow?: boolean
}) {
  if (stack) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <Mark size={size} glow={glow} />
        <div className="mt-5 text-center">
          <div
            className="font-brand font-bold leading-none tracking-[-0.025em]"
            style={{ fontSize: size * 0.46 }}
          >
            <span className="text-brand-deep">Purplix</span>{' '}
            <span className="text-steel">AI</span>
          </div>
          {tagline && (
            <div
              className="mt-3 font-brand font-semibold uppercase text-muted"
              style={{ fontSize: Math.max(8, size * 0.108), letterSpacing: '0.22em' }}
            >
              Continuous assurance loop
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark size={size} glow={glow} />
      <div className="leading-none">
        <div className="font-brand text-[16px] font-bold tracking-[-0.025em]">
          <span className="text-brand-deep">Purplix</span>{' '}
          <span className="text-steel">AI</span>
        </div>
        {tagline && (
          // nowrap: at sidebar width this breaks onto two lines and pushes the
          // lockup out of the 72px header.
          <div className="mt-1.5 whitespace-nowrap font-brand text-[7.5px] font-semibold
                          uppercase tracking-[0.15em] text-muted">
            Continuous assurance loop
          </div>
        )}
      </div>
    </div>
  )
}
