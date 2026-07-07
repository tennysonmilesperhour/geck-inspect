import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../blog-helpers';

describe('markdownToHtml XSS hardening', () => {
  it('escapes raw HTML tags rather than emitting them', () => {
    const html = markdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('neutralizes javascript: URLs in links', () => {
    const html = markdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('neutralizes javascript: URLs in images', () => {
    const html = markdownToHtml('![x](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('src="#"');
  });

  it('blocks other dangerous schemes (data:, vbscript:)', () => {
    expect(markdownToHtml('[x](data:text/html,<script>1</script>)')).toContain('href="#"');
    expect(markdownToHtml('[x](vbscript:msgbox)')).toContain('href="#"');
  });

  it('preserves legitimate http(s), mailto, relative, and anchor URLs', () => {
    expect(markdownToHtml('[x](https://geckinspect.com/a)')).toContain('href="https://geckinspect.com/a"');
    expect(markdownToHtml('[x](/MorphGuide/cappuccino)')).toContain('href="/MorphGuide/cappuccino"');
    expect(markdownToHtml('[x](mailto:hi@geckinspect.com)')).toContain('href="mailto:hi@geckinspect.com"');
    expect(markdownToHtml('[x](#section)')).toContain('href="#section"');
  });

  it('still renders basic markdown structure', () => {
    const html = markdownToHtml('# Title\n\nSome **bold** text.');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<strong>bold</strong>');
  });
});
