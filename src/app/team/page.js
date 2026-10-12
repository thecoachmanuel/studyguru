'use client';

import Link from 'next/link';
import PublicLayout, {
  PublicHero,
  PublicSection,
} from '@/components/PublicLayout';

const FOUNDERS = [
  { name: 'Adewale Olaitan', id: 'adewale-olaitan' },
];

const SEO = {
  title: 'Meet the StudyGuru Team',
  description: 'Meet the founding developer who created and continues to maintain StudyGuru, an AI-powered student collaboration platform.',
  path: '/team',
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': 'https://www.studyguru.me/team#teampage',
    url: 'https://www.studyguru.me/team',
    name: 'Meet the StudyGuru Team',
    description: 'The founding developer behind StudyGuru and the history of the project.',
    isPartOf: { '@id': 'https://www.studyguru.me/#website' },
    about: { '@id': 'https://www.studyguru.me/#organization' },
    mainEntity: {
      '@type': 'ItemList',
      name: 'StudyGuru Founding Developer',
      itemListElement: FOUNDERS.map((founder, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Person',
          '@id': `https://www.studyguru.me/#${founder.id}`,
          name: founder.name,
          jobTitle: 'Founding Developer of StudyGuru',
        },
      })),
    },
  },
};

export default function TeamPage() {
  return (
    <PublicLayout seo={SEO}>
      <PublicHero
        eyebrow="StudyGuru team"
        title="Meet the StudyGuru Team"
        lead="StudyGuru was founded and developed by Adewale Olaitan, who continues to maintain and improve the project."
      />

      <PublicSection eyebrow="Founding developer" title="The person behind StudyGuru">
        <p>
          Adewale Olaitan designed and built StudyGuru as an AI-powered student collaboration platform.
        </p>
        <div className="public-card-grid public-card-grid--one public-team-grid" style={{ maxWidth: '380px' }}>
          {FOUNDERS.map((founder) => (
            <article className="public-card" key={founder.name}>
              <div className="public-team-grid__initial" aria-hidden="true">
                {founder.name.charAt(0)}
              </div>
              <h3>{founder.name}</h3>
              <p>Founding Developer of StudyGuru</p>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection eyebrow="Project history" title="From inception to active platform">
        <p>
          StudyGuru began as a project focused on bringing student communication,
          shared study resources, semantic document search, and document-grounded
          AI study tools into one workspace.
        </p>
        <p>
          The project remains under active development. Its founding developer continues to
          maintain and improve the application and its public documentation.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Project links" title="Learn more about StudyGuru">
        <p>
          Read the <Link href="/about">StudyGuru story and mission</Link>, or explore our <Link href="/technology">technology stack</Link>.
        </p>
      </PublicSection>
    </PublicLayout>
  );
}
