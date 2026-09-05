export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(y,m-1,d,12);
  return y >= 1900 && y <= 9999 && localDate(date) === value;
}
export const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
