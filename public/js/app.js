// API helper functions
const api = {
  async get(url) {
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  async post(url, data) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  async put(url, data) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  },

  async delete(url) {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  }
};

// State management
let channels = [];
let currentChannel = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadChannels();
});

function setupEventListeners() {
  // Add channel form
  document.getElementById('add-channel-form').addEventListener('submit', handleAddChannel);

  // Playlist mode toggle
  document.getElementById('playlist-mode').addEventListener('change', (e) => {
    document.getElementById('playlist-options').style.display = e.target.checked ? 'block' : 'none';
  });
}

async function handleAddChannel(e) {
  e.preventDefault();

  const url = document.getElementById('channel-url').value.trim();
  const playlistMode = document.getElementById('playlist-mode').checked;
  const flatMode = document.getElementById('flat-mode').checked;
  const autoAddPlaylists = document.getElementById('auto-add-playlists').checked;
  const ytDlpOptions = document.getElementById('yt-dlp-options').value.trim();
  const rescrapeDays = parseInt(document.getElementById('rescrape-days').value);

  try {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    await api.post('/api/channels', {
      url,
      playlist_mode: playlistMode ? 'enumerate' : 'flat',
      flat_mode: flatMode,
      auto_add_new_playlists: autoAddPlaylists,
      yt_dlp_options: ytDlpOptions || null,
      rescrape_interval_days: rescrapeDays
    });

    // Reset form
    e.target.reset();
    
    // Reload channels
    await loadChannels();

    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Channel';

    // Show success message
    showNotification('Channel added successfully! Enumerating playlists in background...', 'success');
  } catch (err) {
    console.error('Failed to add channel:', err);
    showNotification('Failed to add channel: ' + err.message, 'error');
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Channel';
  }
}

async function loadChannels() {
  try {
    channels = await api.get('/api/channels');
    renderChannels();
  } catch (err) {
    console.error('Failed to load channels:', err);
    showNotification('Failed to load channels: ' + err.message, 'error');
  }
}

function renderChannels() {
  const channelsList = document.getElementById('channels-list');

  if (channels.length === 0) {
    channelsList.innerHTML = '<p class="empty-state">No channels added yet. Add one above to get started!</p>';
    return;
  }

  channelsList.innerHTML = channels.map(channel => {
    const lastScraped = channel.last_scraped_at 
      ? new Date(channel.last_scraped_at * 1000).toLocaleDateString()
      : 'Never';

    return `
      <div class="channel-item">
        <div class="channel-header">
          <div class="channel-info">
            <h3>${escapeHtml(channel.channel_name || 'Loading...')}</h3>
            <p class="url">${escapeHtml(channel.url)}</p>
          </div>
          <div class="channel-actions">
            <button class="btn btn-secondary btn-small" onclick="viewChannel(${channel.id})">
              View Details
            </button>
            <button class="btn btn-primary btn-small" onclick="deleteChannel(${channel.id})">
              Delete
            </button>
          </div>
        </div>
        <div class="channel-meta">
          <span class="badge">${channel.playlist_mode === 'enumerate' ? '📋 Playlist Mode' : '📁 Flat Mode'}</span>
          ${channel.auto_add_new_playlists ? '<span class="badge success">Auto-add playlists</span>' : ''}
          <span class="badge">Last scraped: ${lastScraped}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function viewChannel(channelId) {
  try {
    currentChannel = channels.find(c => c.id === channelId);
    
    const modal = document.getElementById('channel-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = currentChannel.channel_name || 'Channel Details';
    modalBody.innerHTML = '<p class="loading">Loading playlists</p>';
    
    modal.style.display = 'flex';

    // Load playlists
    const playlists = await api.get(`/api/channels/${channelId}/playlists`);

    if (playlists.length === 0) {
      modalBody.innerHTML = `
        <div class="empty-state">
          <p>No playlists found yet.</p>
          <button class="btn btn-primary" onclick="enumeratePlaylists(${channelId})">
            Enumerate Playlists Now
          </button>
        </div>
      `;
      return;
    }

    modalBody.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h3>Playlists (${playlists.length})</h3>
        <button class="btn btn-secondary btn-small" onclick="enumeratePlaylists(${channelId})">
          Refresh Playlists
        </button>
      </div>
      ${playlists.map(playlist => `
        <div class="playlist-item">
          <div class="playlist-info">
            <h4>${escapeHtml(playlist.playlist_title)}</h4>
            <p class="video-count">${playlist.video_count || 0} videos</p>
          </div>
          <div class="playlist-toggle">
            <label class="toggle-switch">
              <input 
                type="checkbox" 
                ${playlist.enabled ? 'checked' : ''}
                onchange="togglePlaylist(${playlist.id}, this.checked)"
              >
              <span class="slider"></span>
            </label>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    console.error('Failed to load channel details:', err);
    showNotification('Failed to load channel details: ' + err.message, 'error');
  }
}

async function enumeratePlaylists(channelId) {
  try {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = '<p class="loading">Enumerating playlists</p>';

    await api.post(`/api/channels/${channelId}/enumerate`);
    
    // Reload channel view
    await viewChannel(channelId);
    
    showNotification('Playlists enumerated successfully!', 'success');
  } catch (err) {
    console.error('Failed to enumerate playlists:', err);
    showNotification('Failed to enumerate playlists: ' + err.message, 'error');
  }
}

async function togglePlaylist(playlistId, enabled) {
  try {
    await api.put(`/api/playlists/${playlistId}`, { enabled });
    showNotification(`Playlist ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    console.error('Failed to toggle playlist:', err);
    showNotification('Failed to toggle playlist: ' + err.message, 'error');
  }
}

async function deleteChannel(channelId) {
  if (!confirm('Are you sure you want to delete this channel? This will remove all associated playlists and videos from the database.')) {
    return;
  }

  try {
    await api.delete(`/api/channels/${channelId}`);
    await loadChannels();
    showNotification('Channel deleted successfully', 'success');
  } catch (err) {
    console.error('Failed to delete channel:', err);
    showNotification('Failed to delete channel: ' + err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('channel-modal').style.display = 'none';
  currentChannel = null;
}

// Close modal on background click
document.getElementById('channel-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeModal();
  }
});

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // Simple notification - could be enhanced with a toast library
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#8b5cf6'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
