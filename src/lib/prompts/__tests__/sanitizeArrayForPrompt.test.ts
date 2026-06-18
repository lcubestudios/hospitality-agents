import { sanitizeArrayForPrompt } from '../sanitizeArrayForPrompt'

describe('sanitizeArrayForPrompt', () => {
  it('removes null and empty strings', () => {
    const input = ['', null as unknown as string, 'rustic']
    const result = sanitizeArrayForPrompt(input)
    expect(result).toBe('rustic')
  })

  it('caps array length to maxLength parameter', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f']
    const result = sanitizeArrayForPrompt(input, 5)
    expect(result).toBe('a, b, c, d, e')
  })

  it('handles null input', () => {
    const result = sanitizeArrayForPrompt(null)
    expect(result).toBe('')
  })

  it('handles undefined input', () => {
    const result = sanitizeArrayForPrompt(undefined)
    expect(result).toBe('')
  })

  it('trims whitespace', () => {
    const input = ['  rustic  ', 'modern']
    const result = sanitizeArrayForPrompt(input)
    expect(result).toBe('rustic, modern')
  })

  it('preserves order', () => {
    const input = ['c', 'a', 'b']
    const result = sanitizeArrayForPrompt(input)
    expect(result).toBe('c, a, b')
  })

  it('filters whitespace-only strings', () => {
    const input = ['casual', '   ', 'upscale']
    const result = sanitizeArrayForPrompt(input)
    expect(result).toBe('casual, upscale')
  })

  it('handles empty array', () => {
    const result = sanitizeArrayForPrompt([])
    expect(result).toBe('')
  })

  it('applies default maxLength of 5', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const result = sanitizeArrayForPrompt(input)
    expect(result).toBe('a, b, c, d, e')
  })
})
