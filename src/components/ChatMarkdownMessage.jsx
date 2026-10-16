'use client';

import { useState, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cleanEmDashes } from '@/lib/cleanText';
import './ChatMarkdownMessage.css';

/**
 * Dedicated Code Block Component with language tag, syntax container,
 * and individual copy icon button.
 */
function CodeBlock({ node, inline, className, children, ...props }) {
  void node;
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const rawString = String(children || '').replace(/\n$/, '');

  // Render clean inline code badge if inline
  if (inline || (!match && !rawString.includes('\n'))) {
    return (
      <code className="chat-inline-code" {...props}>
        {children}
      </code>
    );
  }

  const language = match ? match[1].toLowerCase() : 'code';

  const handleCopyCode = async (e) => {
    e.stopPropagation();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rawString);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = rawString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code snippet:', err);
    }
  };

  return (
    <div className="chat-code-block-wrapper">
      <div className="chat-code-block-header">
        <div className="chat-code-block-lang">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>{language.toUpperCase()}</span>
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className={`chat-code-block-copy-btn ${copied ? 'chat-code-block-copy-btn--copied' : ''}`}
          aria-label={copied ? 'Code copied to clipboard' : 'Copy code snippet'}
          title="Copy code"
        >
          {copied ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="chat-code-block-pre">
        <code className={className} {...props}>
          {rawString}
        </code>
      </pre>
    </div>
  );
}

/**
 * Unique Section Embed Component for callouts and blockquotes with individual copy button.
 */
function SectionEmbed({ node, children, ...props }) {
  void node;
  const [copied, setCopied] = useState(false);
  const contentRef = useRef(null);

  const handleCopySection = async (e) => {
    e.stopPropagation();
    try {
      const textToCopy = contentRef.current?.innerText || '';
      if (!textToCopy) return;

      if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy section:', err);
    }
  };

  return (
    <div className="chat-section-embed">
      <div className="chat-section-embed__header">
        <div className="chat-section-embed__badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>KEY TAKEAWAY / SECTION</span>
        </div>
        <button
          type="button"
          onClick={handleCopySection}
          className={`chat-section-embed__copy-btn ${copied ? 'chat-section-embed__copy-btn--copied' : ''}`}
          aria-label={copied ? 'Section copied to clipboard' : 'Copy section'}
          title="Copy this section"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <blockquote ref={contentRef} className="chat-section-embed__body" {...props}>
        {children}
      </blockquote>
    </div>
  );
}

const markdownCustomComponents = {
  pre: ({ children }) => <>{children}</>,
  code: CodeBlock,
  blockquote: SectionEmbed,
  a: ({ node, href, children, ...props }) => {
    void node;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-ai-markdown__link"
        {...props}
      >
        {children}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginLeft: 4, display: 'inline-block', verticalAlign: 'baseline', opacity: 0.85 }}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    );
  },
  table: ({ node, ...props }) => {
    void node;
    return (
      <div className="chat-ai-markdown__table-wrap">
        <table {...props} />
      </div>
    );
  },
  img: ({ node, ...props }) => {
    void node;
    return (
      <div className="chat-ai-markdown__image-wrap">
        <img
          loading="lazy"
          alt={props.alt || 'Study diagram'}
          className="chat-ai-markdown__img"
          {...props}
        />
        {props.alt && (
          <span className="chat-ai-markdown__img-caption">
            📷 {props.alt}
          </span>
        )}
      </div>
    );
  },
};

/**
 * Interactive collapsible deck card component.
 * Allows tapping/clicking "(+3 more cards in this deck)" to reveal remaining cards right in channel chat.
 */
function ExpandableChatSection({ label, content }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize label, e.g. "(+3 more cards in this deck)"
  let cleanLabel = (label || '').trim();
  cleanLabel = cleanLabel.replace(/^[\*\(\)]+|[\*\(\)]+$/g, '').trim();
  if (!cleanLabel.startsWith('+') && !cleanLabel.toLowerCase().includes('more')) {
    cleanLabel = `+${cleanLabel}`;
  }
  const displayLabel = cleanLabel.startsWith('(') ? cleanLabel : `(${cleanLabel})`;

  return (
    <div className={`chat-deck-expand ${isExpanded ? 'chat-deck-expand--open' : ''}`}>
      <button
        type="button"
        className="chat-deck-expand__trigger"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse remaining items' : 'Click to reveal remaining items'}
      >
        <span className="chat-deck-expand__icon" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="16" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2H6" />
          </svg>
        </span>
        <span className="chat-deck-expand__label">
          {isExpanded
            ? cleanLabel.toLowerCase().includes('question')
              ? 'Hide remaining questions'
              : cleanLabel.toLowerCase().includes('card')
              ? 'Hide remaining cards'
              : 'Collapse section'
            : displayLabel}
        </span>
        <span
          className={`chat-deck-expand__chevron ${isExpanded ? 'chat-deck-expand__chevron--open' : ''}`}
          aria-hidden="true"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="chat-deck-expand__body">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownCustomComponents}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <div className="chat-deck-expand__empty-notice">
              💡 <em>This preview deck was shared with initial preview cards. Re-share the deck from the AI Study Helper panel to view all remaining cards interactively.</em>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Parses markdown message into segments of regular markdown and interactive expandable sections.
 */
function parseMessageSegments(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return [];

  // Remove unnecessary hyphens / em-dashes '—' across the whole response
  const sanitized = cleanEmDashes(rawContent);

  // Match:
  // 1. :::expand (+3 more cards in this deck)\n...\n:::
  // 2. <details><summary>(+3 more cards in this deck)</summary>...</details>
  // 3. *(+3 more cards in this deck)* (standalone or followed by remaining cards)
  const pattern = /(?:(?:^|\n):::expand(?:\s*\(?([^)\n]+)\)?)?\s*\n([\s\S]*?)\n:::)|(?:<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>)|(?:\*(?:\((?:[+]\d+\s+more\s+[^)]+)\)|(?:[+]\d+\s+more\s+[^*]+))\*)/gi;

  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(sanitized)) !== null) {
    const matchStart = match.index;
    const matchEnd = pattern.lastIndex;

    // Preceding markdown text
    if (matchStart > lastIndex) {
      const normalPart = sanitized.slice(lastIndex, matchStart);
      if (normalPart.trim()) {
        segments.push({ type: 'markdown', content: normalPart });
      }
    }

    if (match[2] !== undefined) {
      // :::expand syntax
      segments.push({
        type: 'expandable',
        label: (match[1] || '+more cards in this deck').trim(),
        content: match[2].trim(),
      });
    } else if (match[4] !== undefined) {
      // <details> syntax
      segments.push({
        type: 'expandable',
        label: (match[3] || '+more cards in this deck').replace(/<[^>]+>/g, '').trim(),
        content: match[4].trim(),
      });
    } else {
      // Standalone *(+3 more cards in this deck)*
      const rawBadge = match[0].replace(/^\*+|\*+$/g, '').trim();
      const remainingText = sanitized.slice(matchEnd).trim();
      if (
        remainingText &&
        (remainingText.startsWith('---') ||
          remainingText.startsWith('**Card') ||
          remainingText.startsWith('Card') ||
          remainingText.startsWith('#### Question') ||
          remainingText.startsWith('•'))
      ) {
        segments.push({
          type: 'expandable',
          label: rawBadge,
          content: remainingText,
        });
        lastIndex = sanitized.length;
        break;
      } else {
        segments.push({
          type: 'expandable',
          label: rawBadge,
          content: '',
        });
      }
    }

    lastIndex = matchEnd;
  }

  // Trailing markdown text
  if (lastIndex < sanitized.length) {
    const trailing = sanitized.slice(lastIndex);
    if (trailing.trim()) {
      segments.push({ type: 'markdown', content: trailing });
    }
  }

  if (segments.length === 0) {
    segments.push({ type: 'markdown', content: sanitized });
  }

  return segments;
}

export default function ChatMarkdownMessage({ content }) {
  const segments = useMemo(() => parseMessageSegments(content), [content]);

  return (
    <div className="chat-ai-markdown">
      {segments.map((segment, idx) => {
        if (segment.type === 'expandable') {
          return (
            <ExpandableChatSection
              key={`expand-${idx}`}
              label={segment.label}
              content={segment.content}
            />
          );
        }

        return (
          <ReactMarkdown
            key={`md-${idx}`}
            remarkPlugins={[remarkGfm]}
            components={markdownCustomComponents}
          >
            {segment.content || ''}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
