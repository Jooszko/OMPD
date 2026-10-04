export function formatTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}