'use client';

import { useState } from 'react';

export default function ChatterRoomsView({
  servers = [],
  activeServerId,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onJoinVoiceChannel,
  isJoinedInVoiceRoom = false,
  activeVoiceChannelName = null,
}) {
  const [selectedInterest, setSelectedInterest] = useState('All');

  const interests = ['All', 'Computer Science', 'Mathematics', 'Biology', 'Medicine', 'Physics', 'Law'];

  // Simulated live audio study spaces matching Chatter
  const [audioSpaces] = useState([
    {
      id: 'space-1',
      title: 'Late Night Algorithms & LeetCode Sprint 🚀',
      category: 'Computer Science',
      tags: ['#DynamicProgramming', '#Graphs', '#BigO'],
      listenersCount: 8,
      speakers: [
        { name: 'David', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80' },
        { name: 'Elena', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80' },
        { name: 'Kenji', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80' },
      ],
    },
    {
      id: 'space-2',
      title: 'MCAT Biology & Organic Chemistry Drill 🧬',
      category: 'Medicine',
      tags: ['#MCAT', '#Biochemistry', '#AminoAcids'],
      listenersCount: 14,
      speakers: [
        { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
        { name: 'Michael', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&auto=format&fit=crop&q=80' },
      ],
    },
    {
      id: 'space-3',
      title: 'Silent Pomodoro Room (50/10) ⏳ Concentration',
      category: 'All',
      tags: ['#Pomodoro', '#DeepWork', '#Focus'],
      listenersCount: 22,
      speakers: [
        { name: 'Mia', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80' },
      ],
    },
  ]);

  const filteredSpaces = selectedInterest === 'All'
    ? audioSpaces
    : audioSpaces.filter((s) => s.category === selectedInterest || s.category === 'All');

  return (
    <div style={{ paddingBottom: 80, maxWidth: 680, margin: '0 auto', width: '100%' }}>
      {/* ── 1. Top Interests Filter Carousel ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          padding: '12px 16px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {interests.map((tag) => {
          const isSelected = selectedInterest === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedInterest(tag)}
              style={{
                padding: '7px 15px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: 'pointer',
                background: isSelected ? 'var(--chatter-primary)' : 'rgba(255, 255, 255, 0.08)',
                color: isSelected ? '#0E0E0E' : '#979797',
                transition: 'all 0.15s ease',
              }}
            >
              #{tag}
            </button>
          );
        })}
      </div>

      {/* ── 2. Live Audio Spaces Section ── */}
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Live Audio Spaces</span>
            <span className="chatter-audiospace-live-badge">
              <span className="chatter-audiospace-live-dot" />
              LIVE
            </span>
          </h2>
        </div>

        {filteredSpaces.map((space) => (
          <div key={space.id} className="chatter-audiospace-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 6px 0' }}>
                  {space.title}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {space.tags.map((t) => (
                    <span key={t} style={{ fontSize: 12, color: 'var(--chatter-hashtag)', fontWeight: 600 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--chatter-light-text)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                🎙️ {space.listenersCount} listening
              </div>
            </div>

            {/* Overlapping Speaker Avatars */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
              <div className="chatter-speaker-stack">
                {space.speakers.map((sp, i) => (
                  <img
                    key={i}
                    src={sp.avatar}
                    alt={sp.name}
                    className="chatter-speaker-avatar"
                    title={sp.name}
                  />
                ))}
                <span style={{ fontSize: 12, color: 'var(--chatter-light-text)', marginLeft: 10, fontWeight: 500 }}>
                  {space.speakers.map((s) => s.name).join(', ')} speaking
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  // If a server has voice channels, join the first available voice channel
                  const serverWithVoice = servers.find((s) => s.channels?.some((c) => c.type === 'voice'));
                  if (serverWithVoice) {
                    const voiceChan = serverWithVoice.channels.find((c) => c.type === 'voice');
                    onJoinVoiceChannel?.(serverWithVoice.id, voiceChan.id, voiceChan.name);
                  }
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 20,
                  background: 'var(--chatter-primary)',
                  border: 'none',
                  color: '#0E0E0E',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  transition: 'transform 0.12s ease',
                }}
              >
                Join Space
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. Study Rooms / Servers Directory ── */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>
            Study Group Rooms ({servers.length})
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onJoinServer}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Join with Code
            </button>
            <button
              type="button"
              onClick={onCreateServer}
              style={{
                padding: '6px 12px',
                borderRadius: 16,
                background: 'var(--chatter-primary)',
                border: 'none',
                color: '#0E0E0E',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              + Create Room
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {servers.map((server) => {
            const isCurrent = activeServerId === server.id;
            const channelsCount = server.channels?.length || 0;
            return (
              <div
                key={server.id}
                onClick={() => onSelectServer(server.id)}
                style={{
                  background: 'var(--chatter-sheet)',
                  border: isCurrent ? '1.5px solid var(--chatter-primary)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {server.icon_url ? (
                    <img
                      src={server.icon_url}
                      alt={server.name}
                      style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: '#242424',
                        color: 'var(--chatter-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16,
                      }}
                    >
                      {server.name?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}

                  <div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px 0' }}>
                      {server.name}
                    </h4>
                    <div style={{ fontSize: 12, color: 'var(--chatter-light-text)' }}>
                      {channelsCount} study channels · {server.member_count || 1} members
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isCurrent && (
                    <span style={{ fontSize: 11, background: 'rgba(64, 227, 120, 0.15)', color: 'var(--chatter-primary)', padding: '4px 8px', borderRadius: 10, fontWeight: 700 }}>
                      Active
                    </span>
                  )}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#979797' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
