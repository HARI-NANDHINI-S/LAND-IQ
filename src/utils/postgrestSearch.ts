export function buildIlikeOrFilter(columns: string[], search: string): string {
  const normalizedSearch = Array.from(search, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : character;
  }).join('');
  const escapedSearch = normalizedSearch
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, '\\$&')
    .replace(/[(),]/g, '\\$&');

  return columns.map((column) => `${column}.ilike."%${escapedSearch}%"`).join(',');
}