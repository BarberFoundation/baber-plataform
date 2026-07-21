/** Formats a Date as 'YYYY-MM-DD' using local time components (avoids the UTC-rollover bug that toISOString().slice(0, 10) has near midnight). */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
