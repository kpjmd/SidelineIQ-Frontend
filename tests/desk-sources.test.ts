import { describe, it, expect } from 'vitest';
import { normalizeSources, sourcesForSave, countValidSources, isHttpUrl } from '../lib/desk-sources';

describe('normalizeSources', () => {
  it('reads nothing from the shapes the column has held or could hold', () => {
    expect(normalizeSources(null)).toEqual([]);
    expect(normalizeSources(undefined)).toEqual([]);
    expect(normalizeSources('ESPN')).toEqual([]);
    expect(normalizeSources({ a: 1 })).toEqual([]);
  });

  it('keeps well-formed rows and blanks non-string fields', () => {
    expect(normalizeSources([{ label: 'ESPN', url: 'https://espn.com/x' }, { label: 3, url: null }, 'x'])).toEqual([
      { label: 'ESPN', url: 'https://espn.com/x' },
      { label: '', url: '' },
    ]);
  });
});

describe('sourcesForSave', () => {
  it('drops blank and unparseable URLs so they cannot clear the linter blocker', () => {
    const rows = [
      { label: ' ESPN ', url: ' https://espn.com/a ' },
      { label: 'half typed', url: 'espn.com' },
      { label: '', url: '' },
      { label: 'ftp', url: 'ftp://x.test/f' },
    ];
    expect(sourcesForSave(rows)).toEqual([{ label: 'ESPN', url: 'https://espn.com/a' }]);
    expect(countValidSources(rows)).toBe(1);
  });

  it('saves an empty array when every row is removed, which is non-null and so clears the stored value', () => {
    expect(sourcesForSave([])).toEqual([]);
  });
});

describe('isHttpUrl', () => {
  it('accepts http and https only', () => {
    expect(isHttpUrl('https://x.com/a')).toBe(true);
    expect(isHttpUrl('http://x.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});
