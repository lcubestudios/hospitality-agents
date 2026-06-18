/**
 * Integration test: subject-lock pipeline
 * Pizza slice test covering:
 * - Brand with null/empty atmosphere values
 * - Campaign generation flow
 * - Sanitization of arrays
 * - DirectorBrief output validation
 */

import { sanitizeArrayForPrompt } from '@/lib/prompts/sanitizeArrayForPrompt'
import { resolveTierToScene } from '@/lib/prompts/resolveTierToScene'

describe('Subject Lock Integration Test', () => {
  describe('Pizza slice: brand with messy atmosphere data', () => {
    it('sanitizes atmosphere array with nulls and empty strings', () => {
      const messyAtmosphere = ['', null as unknown as string, 'casual']
      const sanitized = sanitizeArrayForPrompt(messyAtmosphere)
      expect(sanitized).toBe('casual')
      expect(sanitized).not.toContain(', ,')
    })

    it('sanitizes personality array with whitespace', () => {
      const messyPersonality = ['  friendly  ', '', 'playful']
      const sanitized = sanitizeArrayForPrompt(messyPersonality)
      expect(sanitized).toBe('friendly, playful')
      expect(sanitized).not.toContain('  ')
    })

    it('builds brand profile lines without malformed strings', () => {
      const brand = {
        name: 'Test Pizzeria',
        business_type: 'Restaurant',
        food_drink_type: 'Pizza & Pasta',
        atmosphere: ['', null as unknown as string, 'casual', '  ', 'family-friendly'],
        personality: ['  warm  ', '', 'authentic'],
      }

      const brandProfileLines = [
        brand.business_type && `Venue type: ${brand.business_type}`,
        brand.food_drink_type && `Food & drink focus: ${brand.food_drink_type}`,
        brand.atmosphere?.length && `Atmosphere: ${sanitizeArrayForPrompt(brand.atmosphere)}`,
        brand.personality?.length && `Personality: ${sanitizeArrayForPrompt(brand.personality)}`,
      ].filter(Boolean)

      const brandProfile = brandProfileLines.join('\n')

      // Verify no malformed strings (no `, , ` pattern)
      expect(brandProfile).not.toContain(', ,')
      expect(brandProfile).toContain('Atmosphere: casual, family-friendly')
      expect(brandProfile).toContain('Personality: warm, authentic')
    })
  })

  describe('Tier resolution validation', () => {
    it('validates subject preservation with tier selection', () => {
      const result = resolveTierToScene({
        subjectLock: { original_subject: 'Margherita Pizza' },
        selectedTier: 'enhanced',
        brandContext: {
          atmosphere: ['casual', 'family-friendly'],
          personality: ['warm', 'authentic'],
        },
      })

      expect(result.subjectPreserved).toBe(true)
      expect(result.warnings).toHaveLength(0)
      expect(result.selectedScene).toContain('Master retoucher pass')
    })

    it('warns when subject lock is empty', () => {
      const result = resolveTierToScene({
        subjectLock: { original_subject: '' },
        selectedTier: 'editorial',
        brandContext: { atmosphere: ['upscale'], personality: ['refined'] },
      })

      expect(result.subjectPreserved).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('logs tier selection correctly', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

      resolveTierToScene({
        subjectLock: { original_subject: 'Truffle Pasta' },
        selectedTier: 'cinematic',
        brandContext: { atmosphere: ['moody', 'elegant'], personality: ['sophisticated'] },
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TierResolution] Tier selected: cinematic'),
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TierResolution] Subject lock: "Truffle Pasta"'),
      )

      consoleSpy.mockRestore()
    })

    it('handles all three tier types', () => {
      const tiers: Array<'enhanced' | 'editorial' | 'cinematic'> = [
        'enhanced',
        'editorial',
        'cinematic',
      ]

      tiers.forEach((tier) => {
        const result = resolveTierToScene({
          subjectLock: { original_subject: 'Pizza' },
          selectedTier: tier,
          brandContext: { atmosphere: [], personality: [] },
        })

        expect(result.selectedScene).toBeTruthy()
        expect(result.selectedScene.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Array sanitization edge cases', () => {
    it('caps array length to maxLength', () => {
      const longArray = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      const result = sanitizeArrayForPrompt(longArray, 5)
      expect(result).toBe('a, b, c, d, e')
    })

    it('handles array with only whitespace entries', () => {
      const whitespaceOnly = ['   ', '\t', '\n']
      const result = sanitizeArrayForPrompt(whitespaceOnly)
      expect(result).toBe('')
    })

    it('trims and filters consistently', () => {
      const input = ['  item1  ', 'item2', null as unknown as string, '', '  item3  ']
      const result = sanitizeArrayForPrompt(input)
      expect(result).toBe('item1, item2, item3')
    })
  })
})
