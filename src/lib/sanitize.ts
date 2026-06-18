/**
 * Sanitization utilities for safe prompt injection and array handling.
 */

/**
 * Sanitizes an array for safe injection into prompts by filtering nulls,
 * undefined values, and empty strings, then joining with comma+space.
 *
 * @param arr - Array to sanitize (may contain mixed types, nulls, undefined)
 * @param maxLength - Optional maximum length; if exceeded, array is truncated and warning logged
 * @returns Clean comma-separated string safe for prompt injection, or empty string if result is empty
 *
 * @example
 * sanitizeArrayForPrompt(['artisanal', '', null, 'warm'])
 * // → 'artisanal, warm'
 *
 * @example
 * sanitizeArrayForPrompt(['a', 'b', 'c', 'd', 'e', 'f'], 5)
 * // → 'a, b, c, d, e' (logs: "Array truncated from 6 to 5 elements")
 */
export function sanitizeArrayForPrompt(arr: unknown[], maxLength?: number): string {
  if (!Array.isArray(arr)) {
    return ''
  }

  // Filter: remove null, undefined, and empty strings; trim remaining elements
  const cleaned = arr
    .filter((item) => item != null && item !== '')
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)

  // Validate length
  if (maxLength !== undefined && cleaned.length > maxLength) {
    console.warn(
      `Array truncated from ${cleaned.length} to ${maxLength} elements for prompt safety`,
    )
    return cleaned.slice(0, maxLength).join(', ')
  }

  // Return empty string if result is empty (never return "undefined" or "null")
  return cleaned.length > 0 ? cleaned.join(', ') : ''
}
