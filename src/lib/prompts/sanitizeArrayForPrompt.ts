/**
 * Sanitize an array of strings for use in prompts.
 * - Filters out null, undefined, empty strings, and whitespace-only strings
 * - Caps array length to maxLength parameter (default 5)
 * - Joins with comma-space separator
 * - Returns empty string if input is falsy/empty
 */
export function sanitizeArrayForPrompt(arr: string[] | null | undefined, maxLength = 5): string {
  if (!arr || !Array.isArray(arr)) return ''
  return arr
    .filter((item) => item && item.trim())
    .slice(0, maxLength)
    .map((item) => item.trim())
    .join(', ')
}
