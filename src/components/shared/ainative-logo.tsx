import { OfMark } from "@/components/shared/of-mark";

interface AinativeLogoProps {
  size?: number;
  className?: string;
  /** Kept for API compatibility; the delta mark is identical across variants. */
  variant?: "icon" | "symbol";
}

/**
 * The Orionfold delta mark at small sizes (icon-rail / collapsed contexts).
 * Theme-aware SVG — see {@link OfMark}. Replaces the pre-brand raster logo.
 */
export function AinativeLogo({ size = 24, className }: AinativeLogoProps) {
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className ?? ""}`}>
      <OfMark size={size} />
    </span>
  );
}
