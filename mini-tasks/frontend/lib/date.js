// Today's date as YYYY-MM-DD in the user's LOCAL timezone.
// (new Date().toISOString() is UTC and can be a day off in the evening.)
export function todayLocal(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
