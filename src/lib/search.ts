export function toSearchText(
  ...parts: (string | number | null | undefined)[]
): string {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map(String)
    .join(" ");
}
