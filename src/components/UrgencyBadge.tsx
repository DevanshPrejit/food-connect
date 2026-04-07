import { urgencyConfig } from "@/lib/urgency";

export default function UrgencyBadge({ urgency }: { urgency: "urgent" | "medium" | "safe" }) {
  const config = urgencyConfig[urgency];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-primary-foreground ${config.color}`}>
      {config.emoji} {config.label}
    </span>
  );
}
