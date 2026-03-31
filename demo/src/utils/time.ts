export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function timeAgo(unix: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  const d = new Date(unix * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
