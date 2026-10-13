'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { getPusherClient } from '@/lib/pusherClient';

export default function SnapshotRail({ serverId, currentUserId, currentUserName }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const fetchSnapshots = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const data = await apiRequest(`/api/servers/${serverId}/snapshots`);
      if (Array.isArray(data)) {
        setSnapshots(data);
      }
    } catch (err) {
      console.warn('Failed to fetch snapshots:', err);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Realtime subscription for new snapshots
  useEffect(() => {
    if (!serverId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `server-${serverId}`;
    let chan = null;
    try {
      chan = pusher.subscribe(channelName);
      chan.bind('new-snapshot', (newSnap) => {
        setSnapshots((prev) => {
          if (prev.some((s) => s.id === newSnap.id)) return prev;
          return [newSnap, ...prev];
        });
      });
    } catch {}

    return () => {
      try {
        chan?.unbind('new-snapshot');
      } catch {}
    };
  }, [serverId]);

  const handleOpenSnapshot = async (snap) => {
    setSelectedSnapshot(snap);
    if (!snap.is_viewed) {
      try {
        await apiRequest(`/api/servers/${serverId}/snapshots/${snap.id}/view`, {
          method: 'POST',
        });
        setSnapshots((prev) =>
          prev.map((s) => (s.id === snap.id ? { ...s, is_viewed: true } : s))
        );
      } catch {}
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !imageFile) return;

    setSubmitting(true);
    setError('');

    try {
      let imageUrl = '';
      if (imageFile) {
        // Upload image
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('folder', 'studycord_snapshots');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadRes.ok) throw new Error('Failed to upload image');
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.secure_url || uploadData.url || '';
      }

      const res = await apiRequest(`/api/servers/${serverId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption.trim(),
        }),
      });

      if (res?.id) {
        setSnapshots((prev) => [res, ...prev]);
        setCreateOpen(false);
        setCaption('');
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to share snapshot');
    } finally {
      setSubmitting(false);
    }
  };

  if (!serverId) return null;

  return (
    <>
      <div className="snapshot-rail-container" role="region" aria-label="Study Snapshots">
        {/* Create Snapshot Button */}
        <button
          type="button"
          className="snapshot-card-btn"
          onClick={() => setCreateOpen(true)}
          title="Share Study Snapshot (24h)"
        >
          <div className="snapshot-ring snapshot-ring--add">
            <div className="snapshot-inner-avatar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
          <span className="snapshot-label">Add Note</span>
        </button>

        {/* Existing Snapshots */}
        {snapshots.map((snap) => {
          const authorName = snap.author?.username || snap.author?.name || 'Study Buddy';
          const initials = authorName.slice(0, 2).toUpperCase();
          const isOwn = snap.user_id === currentUserId;

          return (
            <button
              key={snap.id}
              type="button"
              className="snapshot-card-btn"
              onClick={() => handleOpenSnapshot(snap)}
              title={`${authorName}'s snapshot`}
            >
              <div
                className={`snapshot-ring ${snap.is_viewed ? 'snapshot-ring--viewed' : 'snapshot-ring--unviewed'}`}
              >
                <div className="snapshot-inner-avatar">
                  {snap.author?.avatar_url ? (
                    <img src={snap.author.avatar_url} alt={authorName} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
              </div>
              <span className="snapshot-label">{isOwn ? 'Your Story' : authorName}</span>
            </button>
          );
        })}
      </div>

      {/* Snapshot Viewer Modal */}
      {selectedSnapshot && (
        <div className="snapshot-viewer" onClick={() => setSelectedSnapshot(null)}>
          <div className="snapshot-viewer-card" onClick={(e) => e.stopPropagation()}>
            <div className="snapshot-viewer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                  }}
                >
                  {selectedSnapshot.author?.username?.[0]?.toUpperCase() || 'S'}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>
                    {selectedSnapshot.author?.username || selectedSnapshot.author?.name || 'Study Buddy'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Study Snapshot · 24h
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="settings-mini-btn"
                onClick={() => setSelectedSnapshot(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {selectedSnapshot.image_url && (
              <div className="snapshot-viewer-image-wrap">
                <img src={selectedSnapshot.image_url} alt="Study Snapshot" />
              </div>
            )}

            {selectedSnapshot.caption && (
              <div className="snapshot-viewer-body">
                <p style={{ margin: 0 }}>{selectedSnapshot.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Snapshot Modal */}
      {createOpen && (
        <div className="modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-card__title">Post Study Snapshot</h3>
            <p className="modal-card__desc">
              Share a quick photo of your notes, problem solution, or progress. This post disappears in 24 hours.
            </p>

            <form onSubmit={handleCreateSnapshot}>
              {imagePreview && (
                <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', maxHeight: '180px', position: 'relative' }}>
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />

              {!imagePreview && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ width: '100%', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Attach Photo of Notes
                </button>
              )}

              <label className="form-label" htmlFor="snapshot-caption">
                Caption / Quick Note
              </label>
              <textarea
                id="snapshot-caption"
                className="form-input"
                rows={3}
                placeholder="e.g. Mastered Chapter 4 integration by parts! 🎯"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={300}
                disabled={submitting}
              />

              {error && <div className="error-message" style={{ marginTop: '10px' }}>{error}</div>}

              <div className="modal-card__actions" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || (!caption.trim() && !imageFile)}
                >
                  {submitting ? 'Posting…' : 'Share (24h)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
