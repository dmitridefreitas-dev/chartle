import { describe, expect, it } from 'vitest';

import { esc } from './escape';

describe('esc (innerHTML defense-in-depth)', () => {
  it('neutralises every HTML-significant character', () => {
    expect(esc(`<script>alert('x')</script>`)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;',
    );
    expect(esc('<img src=x onerror="pwn">')).toBe(
      '&lt;img src=x onerror=&quot;pwn&quot;&gt;',
    );
  });

  it('fixes real ticker/company names that contain ampersands', () => {
    expect(esc('AT&T')).toBe('AT&amp;T');
    expect(esc('S&P 500')).toBe('S&amp;P 500');
  });

  it('leaves ordinary text alone', () => {
    expect(esc('GameStop · Jan 2021')).toBe('GameStop · Jan 2021');
  });
});
