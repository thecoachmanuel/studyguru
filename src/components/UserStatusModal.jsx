'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api';

const STATUS_PRESETS = [
  { state: 'studying', emoji: '📚', label: 'Deep Study Session', text: 'Studying deeply' },
  { state: 'studying', emoji: '✍️', label: 'Working on Assignment', text: 'Writing assignment' },
  { state: 'studying', emoji: '🎧', label: 'Reviewing Lectures', text: 'Listening to lecture' },
  { state: 'busy', emoji: '⛔', label: 'Focus Mode (Do Not Disturb)', text: 'Do not disturb' },
  { state: 'idle', emoji: '☕', label: 'Taking a Quick Break', text: 'On a short break' },
  { state: 'online', emoji: '🟢', label: 'Online & Available to Help', text: 'Ready to collaborate' },
];

export default function UserStatusModal({ currentStatus, onClose, onStatusUpdated }) {
  const [selectedState, setSelectedState] = useState(currentStatus?.state || 'online');
  const [customText, setCustomText] = useState(currentStatus?.text || '');
  const [selectedEmoji, setSelectedEmoji] = useState(currentStatus?.emoji || '🟢');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSelectPreset = (preset) => {
    setSelectedState(preset.state);
    setSelectedEmoji(preset.emoji);
    setCustomText(preset.text);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await apiRequest('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: selectedState,
          text: customText.trim(),
          emoji: selectedEmoji,
        }),
      });

      if (res?.status) {
        onStatusUpdated?.(res.status);
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('/api/user/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: 'online',
          text: '',
          emoji: '🟢',
        }),
      });
      if (res?.status) {
        onStatusUpdated?.(res.status);
        onClose?.();
      }
    } catch (err) {
      setError(err.message || 'Failed to clear status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <h3 className="modal-card__title">Set Study Status</h3>
        <p className="modal-card__desc">
          Let your study group know what you are focusing on right now.
        </p>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="custom-status-text">
              Status Message
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={selectedEmoji}
                onChange={(e) => setSelectedEmoji(e.target.value)}
                style={{ width: '44px', textAlign: 'center', fontSize: '18px' }}
                className="form-input"
                maxLength={4}
              />
              <input
                id="custom-status-text"
                type="text"
                className="form-input"
                placeholder="What are you studying?"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          <label className="form-label">Quick Presets</label>
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '14px' }}>
            {STATUS_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`status-modal-option ${customText === p.text ? 'status-modal-option--selected' : ''}`}
                onClick={() => handleSelectPreset(p)}
              >
                <span style={{ fontSize: '18px' }}>{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {error && <div className="error-message" style={{ marginBottom: '12px' }}>{error}</div>}

          <div className="modal-card__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={saving}
              style={{ marginRight: 'auto' }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
