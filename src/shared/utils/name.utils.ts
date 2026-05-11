export function formatFirstName(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;

  const first = raw.split(/\s+/g).filter(Boolean)[0];
  if (!first) return null;

  const lower = first.toLowerCase();
  return lower.replace(/(^|[-'’])[a-z]/g, (match) => match.toUpperCase());
}
