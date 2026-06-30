import { Badge } from "@/components/ui/badge";
import {
  type StatusFamily,
  getStatusDef,
  autoDetectFamily,
} from "@/lib/constants/status-families";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  /** The status key (e.g., "running", "pending_approval", "claude") */
  status: string;
  /** Which family to look up in. Auto-detected if omitted. */
  family?: StatusFamily;
  /** sm = tables/lists, md = headers/cards */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
}

/**
 * StatusChip — unified status rendering across all Orionfold Relay surfaces.
 *
 * Encodes 5 status families (lifecycle, governance, runtime, risk, schedule)
 * with consistent icon + color + text. Running/active states show a pulse indicator.
 *
 * Usage:
 *   <StatusChip status="running" />
 *   <StatusChip status="pending_approval" family="governance" />
 *   <StatusChip status="claude" family="runtime" size="sm" />
 */
export function StatusChip({
  status,
  family,
  size = "sm",
  className,
}: StatusChipProps) {
  const resolvedFamily = family ?? autoDetectFamily(status);
  const def = resolvedFamily ? getStatusDef(resolvedFamily, status) : undefined;

  if (!def) {
    // Graceful fallback for unknown statuses
    return (
      <Badge variant="outline" className={cn("text-xs", className)}>
        {status}
      </Badge>
    );
  }

  const Icon = def.icon;
  const isSm = size === "sm";
  const iconSize = isSm ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Badge
      variant={def.badgeVariant}
      className={cn(
        "inline-flex items-center gap-1",
        isSm ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-0.5",
        className
      )}
    >
      {def.live ? (
        <span className="relative flex shrink-0">
          <Icon className={cn(iconSize, "relative z-10")} />
          <span
            className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-40",
              `bg-${def.colorToken}`
            )}
          />
        </span>
      ) : (
        <Icon className={cn(iconSize, "shrink-0")} />
      )}
      {def.label}
    </Badge>
  );
}
