export function toCalendarDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addCalendarDays(value: string, days: number): string {
  const date = fromCalendarDate(value);
  date.setDate(date.getDate() + days);
  return toCalendarDate(date);
}
