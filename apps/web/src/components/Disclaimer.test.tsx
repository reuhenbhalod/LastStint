// @vitest-environment jsdom
// The site footer (Disclaimer.tsx): no buttons, only links. Each link is found by its name and
// checked for where it goes; the external one opens in a new tab without an opener.

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Disclaimer } from './Disclaimer.js';

describe('Disclaimer', () => {
  it('is the page footer and carries the fan-guidelines notice', () => {
    render(<Disclaimer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('This website is unofficial and is not associated in any way');
    expect(footer).toHaveTextContent('Unofficial fan game');
    expect(within(footer).queryAllByRole('button')).toEqual([]);
  });

  it('links Privacy, Terms and Credits to their pages', () => {
    render(<Disclaimer />);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Credits' })).toHaveAttribute('href', '/credits');
  });

  it('opens the OpenStreetMap credit in a new tab, without an opener', () => {
    render(<Disclaimer />);
    const osm = screen.getByRole('link', { name: 'OpenStreetMap contributors' });
    expect(osm).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    expect(osm).toHaveAttribute('target', '_blank');
    expect(osm).toHaveAttribute('rel', 'noreferrer');
  });

  it('compact drops the side padding and the two-column grid; className is passed on', () => {
    const { container, rerender } = render(<Disclaimer className="extra" />);
    const footer = container.querySelector('footer');
    expect(footer).toHaveClass('extra');
    expect(footer?.firstElementChild).toHaveClass('md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]');
    rerender(<Disclaimer compact />);
    expect(container.querySelector('footer')?.firstElementChild).not.toHaveClass('px-4');
  });
});
