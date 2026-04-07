export function computeUrgency(expiryTime: string): "urgent" | "medium" | "safe" {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 1) return "urgent";
  if (hoursLeft <= 4) return "medium";
  return "safe";
}

export const urgencyConfig = {
  urgent: { emoji: "🔴", label: "Urgent", color: "bg-urgent" },
  medium: { emoji: "🟡", label: "Medium", color: "bg-medium" },
  safe: { emoji: "🟢", label: "Safe", color: "bg-safe" },
} as const;
