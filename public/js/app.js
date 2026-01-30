// API helper
const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  }
};

let channels = [];
let currentChannel = null;
let downloadStatusInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadChannels();
  startDownloadStatusPolling();
});

function setupEventListeners() {
  document.getElementById('add-channel-form').addEventListener('submit', handleAddChannel);
  document.getElementById('playlist-mode').addEventListener('change', (e) => {
    document.getElementById('playlist-options').style.display = e.target.checked ? 'block' : 'none';
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      
      if (tab === 'channels') loadChannels();
      if (tab === 'downloads') updateDownloadStatus();
    });
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

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  try {
    const result = await api.post('/api/channels', {
      url,
      playlist_mode: playlistMode ? 'enumerate' : 'flat',
      flat_mode: flatMode,
      auto_add_new_playlists: autoAddPlaylists,
      yt_dlp_options: ytDlpOptions || null,
      rescrape_interval_days: rescrapeDays
    });

    e.target.reset();
    
    if (result.type === 'video') {
      showNotification('Video added and queued for download!', 'success');
    } else {
      showNotification('Channel added! Enumerating playlists in background...', 'success');
      setTimeout(loadChannels, 2000);
    }
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add';
  }
}

async function loadChannels() {
  try {
    channels = await api.get('/api/channels');
    renderChannels();
  } catch (err) {
    showNotification('Failed to load channels: ' + err.message, 'error');
  }
}

function renderChannels() {
  const channelsList = document.getElementById('channels-list');
  if (channels.length === 0) {
    channelsList.innerHTML = '<p class="empty-state">No channels added yet.</p>';
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
            <button class="btn btn-secondary btn-small" onclick="viewChannel(${channel.id})">View</button>
            <button class="btn btn-primary btn-small" onclick="downloadChannel(${channel.id})">Download</button>
            <button class="btn btn-small" onclick="deleteChannel(${channel.id})">Delete</button>
          </div>
        </div>
        <div class="channel-meta">
          <span class="badge">${channel.playlist_mode === 'enumerate' ? '📋 Playlist Mode' : '📁 Flat Mode'}</span>
          ${channel.auto_add_new_playlists ? '<span class="badge success">Auto-add</span>' : ''}
          <span class="badge">Scraped: ${lastScraped}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function viewChannel(channelId) {
  currentChannel = channels.find(c => c.id === channelId);
  const modal = document.getElementById('channel-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  modalTitle.textContent = currentChannel.channel_name || 'Channel Details';
  modalBody.innerHTML = '<p class="loading">Loading playlists</p>';
  modal.style.display = 'flex';

  try {
    const playlists = await api.get(`/api/channels/${channelId}/playlists`);
    if (playlists.length === 0) {
      modalBody.innerHTML = `
        <div class="empty-state">
          <p>No playlists found.</p>
          <button class="btn btn-primary" onclick="enumeratePlaylists(${channelId})">Enumerate Now</button>
        </div>
      `;
      return;
    }

    modalBody.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between;">
        <h3>Playlists (${playlists.length})</h3>
        <button class="btn btn-secondary btn-small" onclick="enumeratePlaylists(${channelId})">Refresh</button>
      </div>
      ${playlists.map(playlist => `
        <div class="playlist-item">
          <div class="playlist-info">
            <h4>${escapeHtml(playlist.playlist_title)}</h4>
          </div>
          <div class="playlist-toggle">
            <label class="toggle-switch">
              <input type="checkbox" ${playlist.enabled ? 'checked' : ''} 
                onchange="togglePlaylist(${playlist.id}, this.checked)">
              <span class="slider"></span>
            </label>
            <button class="btn btn-small btn-primary" onclick="downloadPlaylist(${playlist.id})">Download</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    showNotification('Failed to load playlists: ' + err.message, 'error');
  }
}

async function downloadChannel(channelId) {
  if (!confirm('Start downloading all enabled playlists from this channel?')) return;
  try {
    const result = await api.post(`/api/channels/${channelId}/download`);
    showNotification(`Queued ${result.queued} videos from ${result.playlists} playlists`, 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function downloadPlaylist(playlistId) {
  try {
    const result = await api.post(`/api/playlists/${playlistId}/download`);
    showNotification(`Queued ${result.queued} videos for download`, 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function enumeratePlaylists(channelId) {
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = '<p class="loading">Enumerating playlists</p>';
  try {
    await api.post(`/api/channels/${channelId}/enumerate`);
    await viewChannel(channelId);
    showNotification('Playlists enumerated!', 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function togglePlaylist(playlistId, enabled) {
  try {
    await api.put(`/api/playlists/${playlistId}`, { enabled });
    showNotification(`Playlist ${enabled ? 'enabled' : 'disabled'}`, 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function deleteChannel(channelId) {
  if (!confirm('Delete this channel and all associated data?')) return;
  try {
    await api.delete(`/api/channels/${channelId}`);
    await loadChannels();
    showNotification('Channel deleted', 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

function closeModal() {
  document.getElementById('channel-modal').style.display = 'none';
}

// Download status polling
function startDownloadStatusPolling() {
  updateDownloadStatus();
  downloadStatusInterval = setInterval(updateDownloadStatus, 3000);
}

async function updateDownloadStatus() {
  try {
    const status = await api.get('/api/download/status');
    document.getElementById('stat-queue').textContent = status.queue;
    document.getElementById('stat-active').textContent = status.active;
    
    const activeDiv = document.getElementById('active-downloads');
    if (status.downloads.length > 0) {
      activeDiv.innerHTML = status.downloads.map(d => `
        <div class="download-progress">
          <div><strong>${d.video_id}</strong></div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${d.progress}%"></div>
          </div>
          <div>${d.progress.toFixed(1)}% • ${d.elapsed}s elapsed</div>
        </div>
      `).join('');
    } else {
      activeDiv.innerHTML = '';
    }

    const headerStatus = document.getElementById('download-status');
    if (status.active > 0 || status.queue > 0) {
      headerStatus.textContent = `⬇️ ${status.active} active, ${status.queue} queued`;
    } else {
      headerStatus.textContent = '';
    }
  } catch (err) {
    console.error('Failed to update download status:', err);
  }
}

// Settings
function openSettings() {
  document.getElementById('settings-modal').style.display = 'flex';
  loadCookies();
  loadSchedulerStatus();
}

function closeSettingsModal() {
  document.getElementById('settings-modal').style.display = 'none';
}

async function loadSchedulerStatus() {
  try {
    const status = await api.get('/api/scheduler/status');
    const statusDiv = document.getElementById('scheduler-status');
    statusDiv.innerHTML = `<p class="help-text">Scheduler is ${status.running ? '✓ running' : '○ stopped'}</p>`;
  } catch (err) {
    console.error('Failed to load scheduler status:', err);
  }
}

async function startScheduler() {
  const days = parseInt(document.getElementById('scheduler-interval').value);
  try {
    await api.post('/api/scheduler/start', { intervalDays: days });
    showNotification('Scheduler started', 'success');
    loadSchedulerStatus();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function stopScheduler() {
  try {
    await api.post('/api/scheduler/stop');
    showNotification('Scheduler stopped', 'success');
    loadSchedulerStatus();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function loadCookies() {
  try {
    const result = await api.get('/api/cookies');
    document.getElementById('cookies-content').value = result.content || '';
  } catch (err) {
    console.error('Failed to load cookies:', err);
  }
}

async function saveCookies() {
  const content = document.getElementById('cookies-content').value;
  try {
    await api.post('/api/cookies', { content });
    showNotification('Cookies saved', 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function deleteCookies() {
  if (!confirm('Delete cookie file?')) return;
  try {
    await api.delete('/api/cookies');
    document.getElementById('cookies-content').value = '';
    showNotification('Cookies deleted', 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

// Utils
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#8b5cf6'
  };
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: ${colors[type]}; color: white;
    padding: 1rem 1.5rem; border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    z-index: 9999; animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Close modals on background click
document.getElementById('channel-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeSettingsModal();
});

// Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
  .progress-bar {
    width: 100%; height: 10px;
    background: var(--surface-hover);
    border-radius: 5px; overflow: hidden;
    margin: 0.5rem 0;
  }
  .progress-fill {
    height: 100%; background: var(--primary-color);
    transition: width 0.3s ease;
  }
  .download-progress {
    background: var(--background);
    padding: 1rem; margin: 0.5rem 0;
    border-radius: 4px; border: 1px solid var(--border);
  }
`;
document.head.appendChild(style);
