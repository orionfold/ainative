import { OfMark } from "@/components/shared/of-mark";

interface AinativeWordmarkProps {
  className?: string;
}

/**
 * The Orionfold Relay brand lockup: the theme-aware delta mark + the wordmark
 * "Orion·fold·Relay" with `fold` in the cyan accent. (Brand mark/voice aligns to
 * Orionfold; the npm product identity stays `ainative-business` — see
 * aligned/ log R2.)
 */
export function AinativeWordmark({ className }: AinativeWordmarkProps) {
  return (
    <span className={`group inline-flex items-center gap-2 ${className ?? ""}`}>
      <span className="inline-flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-[1.03]">
        <OfMark size={28} />
      </span>
      <span className="text-xl font-semibold tracking-tight leading-none">
        <span className="text-foreground">Orion</span>
        <span className="text-primary">fold</span>
        <span className="text-foreground"> Relay</span>
      </span>
    </span>
  );
}
