import clsx from "clsx";

function barColor(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 60) return "bg-amber-500";
  if (percent >= 40) return "bg-orange-500";
  return "bg-red-500";
}

export default function ProgressBar({
  value,
  className,
  showLabel = false,
  size = "md",
  tone = "auto",
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  /** "auto" colours by percentage; "brand" always uses the accent colour. */
  tone?: "auto" | "brand";
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };

  return (
    <div className={clsx("w-full", className)}>
      {showLabel && (
        <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
          <span>Progress</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        className={clsx(
          "w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--foreground)_14%,transparent)]",
          heights[size]
        )}
      >
        <div
          className={clsx("h-full rounded-full transition-all duration-500", tone === "brand" ? "bg-brand" : barColor(clamped))}
          style={{ width: clamped > 0 ? `max(${clamped}%, 0.5rem)` : 0 }}
        />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 120 }: { value: number; size?: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-[var(--surface-muted)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={clsx(
            clamped >= 80 ? "text-emerald-500" :
            clamped >= 60 ? "text-amber-500" :
            clamped >= 40 ? "text-orange-500" : "text-red-500"
          )}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold text-[var(--foreground)]">{clamped}%</div>
      </div>
    </div>
  );
}
