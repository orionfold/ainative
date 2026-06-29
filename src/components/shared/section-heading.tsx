import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeading({ children, className }: SectionHeadingProps) {
  return (
    <h3
      className={cn(
        // Orionfold "receipt voice": mono-uppercase eyebrow, letter-spaced.
        "font-mono text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground mb-3",
        className,
      )}
    >
      {children}
    </h3>
  );
}
