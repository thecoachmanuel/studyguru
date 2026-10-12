'use client';

import Link from 'next/link';
import PublicLayout, { PublicHero, PublicSection } from '@/components/PublicLayout';

const FAQS = [
  ['What is StudyGuru?', 'StudyGuru is an AI-powered student collaboration platform. It combines servers, text and voice channels, realtime messaging, video and screen sharing, shared documents, semantic search, and a personal AI Study Assistant.'],
  ['Who is StudyGuru for?', 'StudyGuru is designed for students, study groups, educators, and mentors who want communication, shared resources, live meetings, and active revision tools in one workspace.'],
  ['Is StudyGuru free?', 'The current StudyGuru deployment can be accessed without a published paid plan. Service availability and future plans may change as the project develops.'],
  ['Can I create a study group?', 'Yes. Create a server, invite members, organize text and voice channels, and use owner or administrator roles to manage the space.'],
  ['How does the AI Study Assistant work?', 'You choose a PDF, DOCX, or TXT study document. StudyGuru extracts and indexes its content so questions, summaries, flashcards, and quizzes can be grounded in that selected material.'],
  ['Does StudyGuru store my documents?', 'Shared channel files are stored securely through dedicated application storage endpoints. Personal AI Study Assistant documents and their local indexes are processed and stored by the backend according to the current deployment configuration. See the Privacy Policy for more detail.'],
  ['How does semantic search work?', 'Supported server documents are validated, split into chunks, converted into embeddings, and searched with pgvector HNSW cosine retrieval. StudyGuru returns relevant documents and snippets within the selected server. Semantic Search does not generate answers and is independent from the AI Study Assistant.'],
  ['Do ratings change search ranking?', 'No. Community ratings are displayed separately and do not alter the semantic relevance order.'],
  ['What makes StudyGuru different from Discord?', 'StudyGuru uses familiar server, channel, messaging, and call concepts, but its focus is academic work. Shared study documents can become searchable resources and can be handed into personal, document-grounded AI study sessions.'],
  ['Are voice and video calls recorded?', 'StudyGuru does not implement call recording. WebRTC transports live media between participants directly when possible or through a TURN relay when required.'],
  ['Can I share system audio with my screen?', 'Yes, when supported by the browser and operating system. System audio is optional and can be left disabled for video-only screen sharing.'],
  ['Which file formats are supported for study features?', 'The current document ingestion and semantic indexing flows support PDF, DOCX, and TXT files. Files are validated by the backend before they are treated as ready study resources.'],
];

const SEO = {
  title: 'StudyGuru FAQ – AI Study, Search, Calls and Documents',
  description: 'Answers to common questions about StudyGuru, AI study sessions, semantic document search, study groups, shared files, voice, video, and privacy.',
  path: '/faq',
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': 'https://www.studyguru.me/faq#faqpage',
    url: 'https://www.studyguru.me/faq',
    name: 'StudyGuru Frequently Asked Questions',
    isPartOf: { '@id': 'https://www.studyguru.me/#website' },
    mainEntity: FAQS.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  },
};

export default function FaqPage() {
  return (
    <PublicLayout seo={SEO}>
      <PublicHero
        eyebrow="Frequently asked questions"
        title="Straightforward answers about StudyGuru"
        lead="Learn how StudyGuru handles collaboration, AI study tools, shared documents, semantic search, and live communication."
      />
      <PublicSection eyebrow="FAQ" title="Product and technology">
        <div className="public-faq-list">
          {FAQS.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </PublicSection>
      <section className="public-cta">
        <div><p>Looking for implementation details?</p><h2>Read how the platform is built.</h2></div>
        <Link className="public-button" href="/technology">Technology overview</Link>
      </section>
    </PublicLayout>
  );
}
