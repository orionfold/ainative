interface OfMarkProps {
  /** Pixel size of the square mark. */
  size?: number;
  className?: string;
}

/**
 * OfMark — the Orionfold delta-star brand mark.
 *
 * A cyan disc with a white 5-pointed star rotated 45°. Self-contained inline SVG
 * so it inherits the theme: the disc fill reads `var(--primary)` (Tide cyan in
 * both light + dark), the star stays white. This is the canonical theme-aware
 * mark used at every size — nav/app-bar brand, footer, boot splash, seals.
 * Replaces the pre-brand raster `ainative-s-*.png` logos.
 */
export function OfMark({ size = 24, className }: OfMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Orionfold"
      className={className}
    >
      <circle cx="32" cy="32" r="32" fill="var(--primary)" />
      <g transform="rotate(45 32 32)">
        <path
          fill="#ffffff"
          d="M32,9L37.41,24.56L53.88,24.89L40.75,34.84L45.52,50.61L32,41.2L18.48,50.61L23.25,34.84L10.12,24.89L26.59,24.56Z"
        />
      </g>
    </svg>
  );
}
