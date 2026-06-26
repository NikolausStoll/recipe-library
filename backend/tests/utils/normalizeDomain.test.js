/**
 * Unit tests for normalizeDomain helpers.
 * Run: node --test tests/utils/normalizeDomain.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  normalizeDomainFromUrl,
  canonicalWebsiteSourceUrl,
  faviconUrlForDomain,
  urlLooksLikeRecipePage,
} from '../../src/utils/normalizeDomain.js'

describe('normalizeDomainFromUrl', () => {
  it('strips scheme, path, query, and www', () => {
    assert.equal(normalizeDomainFromUrl('https://www.example.com/recipes/pasta?id=1'), 'example.com')
    assert.equal(normalizeDomainFromUrl('example.com/foo'), 'example.com')
    assert.equal(normalizeDomainFromUrl('  HTTPS://WWW.Chef.Example.org/path  '), 'chef.example.org')
  })

  it('keeps mobile subdomains', () => {
    assert.equal(normalizeDomainFromUrl('https://m.example.com/recipe'), 'm.example.com')
  })

  it('returns empty string for blank input', () => {
    assert.equal(normalizeDomainFromUrl(''), '')
    assert.equal(normalizeDomainFromUrl(null), '')
  })
})

describe('canonicalWebsiteSourceUrl', () => {
  it('builds https URL from domain', () => {
    assert.equal(canonicalWebsiteSourceUrl('www.example.com'), 'https://example.com')
    assert.equal(canonicalWebsiteSourceUrl(''), '')
  })
})

describe('faviconUrlForDomain', () => {
  it('returns google favicon URL for normalized domain', () => {
    const url = faviconUrlForDomain('https://www.example.com')
    assert.ok(url?.includes('favicons'))
    assert.ok(url?.includes('example.com'))
  })

  it('returns null for empty domain', () => {
    assert.equal(faviconUrlForDomain(''), null)
  })
})

describe('urlLooksLikeRecipePage', () => {
  it('returns true when pathname has segments', () => {
    assert.equal(urlLooksLikeRecipePage('https://example.com/recipes/pasta'), true)
    assert.equal(urlLooksLikeRecipePage('example.com/dessert'), true)
  })

  it('returns false for bare domain or empty', () => {
    assert.equal(urlLooksLikeRecipePage('https://example.com'), false)
    assert.equal(urlLooksLikeRecipePage(''), false)
  })
})
