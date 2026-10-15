import { describe, expect, it } from 'vitest';
import { canDeleteGecko, canWriteGecko } from '../geckoAccess';

const owner = { email: 'Owner@example.com' };
const editor = { email: 'editor@example.com' };
const admin = { email: 'admin@example.com', role: 'admin' };
const gecko = { id: 'g1', created_by: 'owner@example.com', collection_id: 'c1' };
const editorSeat = [{ collection_id: 'c1', status: 'accepted', role: 'editor' }];

describe('who may delete a gecko', () => {
  it('lets the owner delete, whatever the letter case of the address', () => {
    expect(canDeleteGecko(gecko, owner)).toBe(true);
  });

  it('lets a collection editor edit a shared gecko but not delete it', () => {
    expect(canWriteGecko(gecko, editor, editorSeat)).toBe(true);
    expect(canDeleteGecko(gecko, editor)).toBe(false);
  });

  it('lets an admin delete', () => {
    expect(canDeleteGecko(gecko, admin)).toBe(true);
  });

  it('refuses when signed out or the gecko has no owner', () => {
    expect(canDeleteGecko(gecko, null)).toBe(false);
    expect(canDeleteGecko({ id: 'g2' }, owner)).toBe(false);
  });
});
