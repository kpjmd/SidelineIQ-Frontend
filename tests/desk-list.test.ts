import { describe, it, expect } from 'vitest';
import { partitionDeskPosts } from '../lib/desk-list';

describe('partitionDeskPosts', () => {
  const posts = [
    { id: 'a', status: 'PUBLISHED' },
    { id: 'b', status: 'RETRACTED' },
    { id: 'c', status: 'DRAFT' },
    { id: 'd', status: 'READY' },
    { id: 'e', status: 'RETRACTED' },
  ];

  it('moves only RETRACTED posts out of the main list', () => {
    const { active, retracted } = partitionDeskPosts(posts);
    expect(active.map((p) => p.id)).toEqual(['a', 'c', 'd']);
    expect(retracted.map((p) => p.id)).toEqual(['b', 'e']);
  });

  it('keeps the incoming (newest-updated-first) order in both lists', () => {
    const { active, retracted } = partitionDeskPosts([...posts].reverse());
    expect(active.map((p) => p.id)).toEqual(['d', 'c', 'a']);
    expect(retracted.map((p) => p.id)).toEqual(['e', 'b']);
  });

  it('handles an empty list', () => {
    expect(partitionDeskPosts([])).toEqual({ active: [], retracted: [] });
  });
});
