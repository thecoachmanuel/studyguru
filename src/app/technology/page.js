'use client';

import Link from 'next/link';
import PublicLayout, { PublicHero, PublicSection } from '@/components/PublicLayout';

const SEO = {
  title: 'StudyCord Technology – Next.js, MongoDB Atlas, Cloudflare R2, Pusher and WebRTC',
  description: 'Understand the unified StudyCord architecture: Next.js App Router, MongoDB Atlas, Cloudflare R2, Pusher Channels, NextAuth, WebRTC, Gemini embeddings, and RAG.',
  path: '/technology',
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': 'https://www.studyguru.me/technology#article',
    url: 'https://www.studyguru.me/technology',
    headline: 'How StudyCord is built',
    description: 'An implementation-level overview of the StudyCord unified full-stack collaboration and AI architecture.',
    about: { '@id': 'https://www.studyguru.me/#softwareapplication' },
    author: { '@id': 'https://www.studyguru.me/#organization' },
    publisher: { '@id': 'https://www.studyguru.me/#organization' },
  },
};

const STACK = [
  ['Full-Stack Framework', ['Next.js 16 (App Router)', 'React 19', 'Serverless Route Handlers', 'Turbopack', 'Framer Motion']],
  ['Database & Search', ['MongoDB Atlas', 'Atlas Vector Search ($vectorSearch)', 'Connection Pooling Singleton', 'MongoDB Node Driver v6']],
  ['Authentication', ['NextAuth.js (Auth.js v5)', 'MongoDB Adapter', 'Secure Bcrypt Credentials', 'Google OAuth 2.0']],
  ['Realtime Messaging', ['Pusher Channels', 'WebSockets', 'Presence & Signaling Channels', 'Instant Event Broadcasting']],
  ['Object Storage', ['Cloudflare R2 (S3-Compatible)', 'Direct-to-R2 Presigned Uploads', 'Zero Egress Fees', 'AWS S3 SDK v3']],
  ['Voice & Video', ['WebRTC PeerConnection', 'Metered.live TURN/STUN', 'Screen Sharing', 'Spatial & System Audio']],
  ['AI & RAG Engine', ['Google Gemini 2.5 Flash', 'Text Embedding 004 (768-dim)', 'Browser-Side PDF/DOCX Extraction (pdfjs-dist, Mammoth)', 'Server-Sent Events (SSE) Streaming']],
  ['Deployment & Edge', ['Vercel Serverless', 'Cloudflare Global Edge', 'MongoDB Atlas Cloud']],
];

export default function TechnologyPage() {
  return (
    <PublicLayout seo={SEO}>
      <PublicHero
        eyebrow="Technology"
        title="A unified collaboration platform with modern cloud architecture"
        lead="StudyCord unifies browser UI, authenticated serverless services, durable MongoDB Atlas storage, live peer media, instant Pusher pub/sub, and browser-orchestrated document AI into a cohesive full-stack platform."
      />

      <PublicSection eyebrow="Architecture" title="How requests, data, and media move">
        <div className="public-architecture" role="img" aria-label="StudyCord architecture: unified Next.js App Router communicates with MongoDB Atlas, Pusher Channels, and Cloudflare R2, while WebRTC carries peer media">
          <div><strong>Next.js Full-Stack</strong><span>App Router, Serverless API Routes, React 19 UI</span></div>
          <span aria-hidden="true">↕</span>
          <div><strong>MongoDB Atlas</strong><span>User data, servers, channels, messages, vector search</span></div>
          <span aria-hidden="true">↕</span>
          <div><strong>Pusher & R2</strong><span>Realtime events, signaling, direct Cloudflare R2 storage</span></div>
          <span aria-hidden="true">＋</span>
          <div><strong>WebRTC & TURN</strong><span>Peer voice, video, screen share with Metered relay</span></div>
        </div>
        <p>
          Signaling, durable data, and live media follow optimized cloud paths. MongoDB Atlas handles
          transactional data and vector embeddings with connection-pooled serverless access. Pusher Channels
          delivers instant presence, typing indicators, and WebRTC peer signaling. Once peer connections are negotiated,
          WebRTC carries encrypted audio and video directly peer-to-peer or relays through Metered TURN when firewalls require it.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Stack" title="Technologies in the current implementation">
        <div className="public-card-grid public-card-grid--two">
          {STACK.map(([group, technologies]) => (
            <article className="public-card" key={group}>
              <h3>{group}</h3>
              <ul>
                {technologies.map((technology) => <li key={technology}>{technology}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </PublicSection>

      <PublicSection eyebrow="Application" title="Unified Next.js full-stack platform">
        <div className="public-split">
          <article>
            <h3>Modern Next.js App Router</h3>
            <p>
              StudyCord consolidates the user interface and backend logic into a single high-performance
              Next.js application. Route handlers serve REST and streaming SSE endpoints, while React 19
              powers the responsive multi-panel workspace, server channels, voice stage, and AI tutor modal.
            </p>
          </article>
          <article>
            <h3>Serverless Route Handlers</h3>
            <p>
              Serverless API routes handle authentication, server membership verification, channel permissions,
              presigned storage uploads, real-time event publishing, and AI prompt orchestration without requiring
              a separate backend container service.
            </p>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Data and security" title="MongoDB Atlas as the persistence layer">
        <p>
          MongoDB Atlas provides resilient, highly scalable document storage for user accounts, server spaces,
          channel hierarchies, messages, attachments, pinned notes, and ratings. A globally cached singleton
          maintains connection pooling across serverless executions for minimal query latency.
        </p>
        <p>
          Authentication is driven by NextAuth.js (Auth.js v5) with the official MongoDB adapter,
          supporting salted bcrypt password credentials alongside Google OAuth 2.0. Server permissions
          and channel privacy rules are strictly enforced at the API route layer before documents are returned.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Storage and realtime" title="Cloudflare R2 and Pusher Channels">
        <div className="public-split">
          <article>
            <h3>Cloudflare R2 Direct Uploads</h3>
            <p>
              Uploaded study materials, PDFs, DOCX files, and avatars stream directly from the user&apos;s browser
              to Cloudflare R2 via S3-compatible presigned URLs. This eliminates serverless body payload restrictions
              and guarantees zero egress bandwidth fees for students downloading shared resources.
            </p>
          </article>
          <article>
            <h3>Pusher Channels Realtime Engine</h3>
            <p>
              Real-time messaging, unread notifications, live member presence, and WebRTC peer signaling
              are powered by Pusher Channels. Broadcasts deliver updates across subscribed clients in milliseconds
              without placing persistent polling overhead on the database.
            </p>
          </article>
        </div>
      </PublicSection>

      <PublicSection eyebrow="AI and search" title="Two intelligent document workflows">
        <div className="public-card-grid public-card-grid--two">
          <article className="public-card">
            <p className="public-card__label">AI Study Assistant · Personal</p>
            <h3>Zero-Timeout In-Browser RAG</h3>
            <p>
              When a student uploads a study document, text is extracted directly inside the browser using
              pdfjs-dist and mammoth, using zero server execution time. Chunks are embedded in micro-batches
              and indexed into MongoDB Atlas. Interactive Q&amp;A chat, executive summaries, flashcards, and
              practice quizzes are streamed back in real time via Server-Sent Events (SSE).
            </p>
          </article>
          <article className="public-card">
            <p className="public-card__label">Semantic Document Search · Server</p>
            <h3>Atlas Vector Search Discovery</h3>
            <p>
              Shared server resources are indexed into MongoDB Atlas Vector Search using Google&apos;s 768-dimensional
              text embeddings. Semantic queries utilize Atlas <code>$vectorSearch</code> with cosine similarity
              to find relevant documents and passages across course channels based on conceptual meaning.
            </p>
          </article>
        </div>
        <div className="public-code-flow" aria-label="RAG flow">
          <code>client extract → chunk → micro-batch embed → Atlas Vector Search → SSE stream</code>
        </div>
      </PublicSection>

      <PublicSection eyebrow="Realtime media" title="Voice, video, and screen sharing with WebRTC">
        <p>
          Each participant in a voice channel connects via dedicated browser RTCPeerConnections. Microphone audio,
          webcam video, and screen shares are transmitted directly between peers with spatial audio and mute states.
          STUN enables direct connectivity, while low-latency Metered.live TURN credentials ensure seamless relay
          connectivity behind strict campus networks and firewalls.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Deployment" title="Serverless production deployment">
        <p>
          The application deploys seamlessly on Vercel with automatic edge optimization. MongoDB Atlas hosts the database
          and vector search clusters, Cloudflare R2 serves static assets and study documents, and Pusher handles real-time
          WebSockets globally.
        </p>
      </PublicSection>

      <PublicSection eyebrow="Project leadership" title="Built and maintained by the founding developer">
        <p>
          StudyCord was founded and developed by Adewale Olaitan, who continues to maintain and improve the project.
        </p>
        <p><Link href="/team">Meet the StudyCord team</Link>.</p>
      </PublicSection>
    </PublicLayout>
  );
}
