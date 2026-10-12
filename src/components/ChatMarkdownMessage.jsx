'use client';

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cleanEmDashes } from '@/lib/cleanText';
import './ChatMarkdownMessage.css';

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
              components={{
                table: ({ node, ...props }) => {
                  void node;
                  return (
                    <div className="chat-ai-markdown__table-wrap">
                      <table {...props} />
                    </div>
                  );
                },
              }}
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
            components={{
              table: ({ node, ...props }) => {
                void node;
                return (
                  <div className="chat-ai-markdown__table-wrap">
                    <table {...props} />
                  </div>
                );
              },
            }}
          >
            {segment.content || ''}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
