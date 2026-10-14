'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Seo from './Seo';
import ThemeToggle from './ThemeToggle';
import StudyCordLogo from './StudyCordLogo';

const NAV_ITEMS = [
  ['/about', 'About'],
  ['/features', 'Features'],
  ['/technology', 'Technology'],
  ['/team', 'Team'],
  ['/faq', 'FAQ'],
];

export default function PublicLayout({ seo, children }) {
  const pathname = usePathname();

  return (
    <div className="public-site">
      <Seo {...seo} />
      <a className="public-site__skip-link" href="#public-content">Skip to content</a>
      <header className="public-site__header">
        <div className="public-site__header-inner">
          <Link className="public-site__brand" href="/" aria-label="StudyCord home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <StudyCordLogo fontSize={22} dotSize={7} />
          </Link>
          <nav className="public-site__nav" aria-label="Public navigation">
            {NAV_ITEMS.map(([path, label]) => (
              <Link
                key={path}
                href={path}
                className={pathname === path ? 'active' : ''}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="public-site__actions">
            <ThemeToggle />
            <Link className="public-site__sign-in" href="/login">Sign in</Link>
          </div>
        </div>
      </header>

      <main id="public-content" className="public-site__main">
        {children}
      </main>

      <footer className="public-site__footer">
        <div className="public-site__footer-inner">
          <div>
            <Link className="public-site__brand" href="/" aria-label="StudyCord home" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              <StudyCordLogo fontSize={20} dotSize={6} />
            </Link>
            <p>An AI-powered student collaboration platform for learning together.</p>
          </div>
          <nav aria-label="Product links">
            <Link href="/about">About</Link>
            <Link href="/features">Features</Link>
            <Link href="/technology">Technology</Link>
            <Link href="/team">Team</Link>
            <Link href="/faq">FAQ</Link>
          </nav>
          <nav aria-label="Legal and project links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <p className="public-site__copyright">© 2026 StudyCord. Built for students who learn together.</p>
      </footer>
    </div>
  );
}

export function PublicHero({ eyebrow, title, lead, children }) {
  return (
    <section className="public-hero">
      <p className="public-hero__eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="public-hero__lead">{lead}</p>
      {children}
    </section>
  );
}

export function PublicSection({ id, eyebrow, title, children }) {
  return (
    <section className="public-section" id={id}>
      {eyebrow && <p className="public-section__eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      <div className="public-section__body">{children}</div>
    </section>
  );
}

