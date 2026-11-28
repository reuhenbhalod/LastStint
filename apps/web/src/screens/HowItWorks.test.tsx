// @vitest-environment jsdom
// How it works (HowItWorks.tsx): a page of rules with one control of its own, Back, which
// closes it (the banner and the footer have their own tests).

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HowItWorks } from './HowItWorks.js';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ announcement: null }))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('HowItWorks', () => {
  it('Back closes the page, by click and by keyboard', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<HowItWorks onClose={onClose} />);
    expect(screen.getByRole('heading', { level: 1, name: 'How it works' })).toBeInTheDocument();
    const back = screen.getByRole('button', { name: /^Back/ });
    expect(back).toHaveAccessibleName('Back: close How it works');
    await user.click(back);
    expect(onClose).toHaveBeenCalledTimes(1);
    back.focus();
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows the four grade bands and the footer links', () => {
    render(<HowItWorks onClose={() => {}} />);
    for (const band of [
      'Best call, or within half a point of it',
      'Close (within 5 points)',
      'Costly (within 15 points)',
      'A big miss',
    ])
      expect(screen.getByText(band)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
