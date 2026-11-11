// Small display formatters shared by panels.

/** 1 -> "1st", 12 -> "12th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + "th";
  switch (n % 10) {
    case 1:
      return n + "st";
    case 2:
      return n + "nd";
    case 3:
      return n + "rd";
    default:
      return n + "th";
  }
}
