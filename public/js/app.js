const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error((await res.json()).error || 'Request failed');
    return res.json();
  }
};

let historyPage = 0;
let queuePage = 0;
const pageSize = 5;

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  loadHomePage();
  startPolling();
  
  // Modal close on background click
  document.getElementById('channel-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeChannelModal();
  });
  document.getElementById('video-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeVideoModal();
  });
  document.getElementById('add-channel-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAddChannelModal();
  });
});

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`page-${page}`).classList.add('active');
      
      if (page === 'home') loadHomePage();
      if (page === 'channels') loadChannelsPage();
      if (page === 'config') loadConfigPage();
    });
  });
}

function setupEventListeners() {
  document.getElementById('add-channel-form').addEventListener('submit', handleAddChannel);
  document.getElementById('playlist-mode').addEventListener('change', (e) => {
    document.getElementById('playlist-options').style.display = e.target.checked ? 'block' : 'none';
  });
}

async function loadHomePage() {
  await Promise.all([loadStats(), loadHistory(), loadQueue()]);
}

async function loadStats() {
  try {
    const stats = await api.get('/api/stats');
    document.getElementById('stat-channels').textContent = stats.channel_count;
    document.getElementById('stat-total-downloads').textContent = stats.total_downloads;
    document.getElementById('stat-library-size').textContent = formatSize(stats.library_size);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadHistory() {
  try {
    const history = await api.get(`/api/downloads/recent?limit=${pageSize}&offset=${historyPage * pageSize}`);
    const tbody = document.getElementById('history-table-body');
    
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No downloads yet</td></tr>';
      document.getElementById('history-next').disabled = true;
    } else {
      tbody.innerHTML = history.map(v => `
        <tr>
          <td>
            <a href="#" onclick="viewVideo('${v.video_id}'); return false;">${escapeHtml(v.video_title)}</a>
            ${v.download_status === 'failed' ? `<br><small class="error-text" title="${escapeHtml(v.error_message || 'Download failed')}">${escapeHtml(v.error_message || 'Download failed')}</small>` : ''}
          </td>
          <td>${formatDate(v.upload_date)}</td>
          <td>${formatTimestamp(v.created_at)}</td>
          <td>
            ${v.download_status === 'completed' ? formatTimestamp(v.downloaded_at) : '-'}
            <span class="status-badge status-${v.download_status}">${v.download_status}</span>
          </td>
          <td>${escapeHtml(v.channel_name || 'Unknown')}</td>
        </tr>
      `).join('');
      document.getElementById('history-next').disabled = history.length < pageSize;
    }
    document.getElementById('history-prev').disabled = historyPage === 0;
    document.getElementById('history-page-info').textContent = `Page ${historyPage + 1}`;
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

async function loadQueue() {
  try {
    const [status, pendingVideos] = await Promise.all([
      api.get('/api/download/status'),
      api.get('/api/download/queue?limit=10')
    ]);
    
    const allItems = [
      ...status.downloads.map(d => ({ 
        ...d, 
        status: 'downloading', 
        type: 'active',
        video_title: d.video_title,
        channel_name: d.channel_name
      })),
      ...pendingVideos.map(v => ({
        video_id: v.video_id,
        video_title: v.video_title,
        channel_name: v.channel_name,
        status: 'pending',
        type: 'queued'
      }))
    ];
    
    const tbody = document.getElementById('queue-table-body');
    if (allItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No items in queue</td></tr>';
    } else {
      const start = queuePage * pageSize;
      const pageItems = allItems.slice(start, start + pageSize);
      
      tbody.innerHTML = pageItems.map(item => `
        <tr>
          <td title="${escapeHtml(item.video_id)}">${escapeHtml(item.video_title || item.video_id)}</td>
          <td><span class="status-badge status-${item.status}">${item.status}</span></td>
          <td>
            ${item.progress ? `
              <div class="progress-bar"><div class="progress-fill" style="width: ${item.progress}%"></div></div>
              ${item.progress.toFixed(1)}%
            ` : (item.status === 'pending' ? 'Waiting' : '-')}
          </td>
          <td>${item.channel_name || '-'}</td>
        </tr>
      `).join('');
      
      document.getElementById('queue-next').disabled = start + pageSize >= allItems.length;
    }
    document.getElementById('queue-prev').disabled = queuePage === 0;
    document.getElementById('queue-page-info').textContent = `Page ${queuePage + 1}`;
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
}

async function loadChannelsPage() {
  try {
    const channelStats = await api.get('/api/stats/channels');
    const tbody = document.getElementById('channels-table-body');
    
    if (channelStats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No channels added yet</td></tr>';
      return;
    }
    
    tbody.innerHTML = channelStats.map(c => {
      // Channel is still enumerating if it has no name AND (no playlists found OR hasn't been scraped yet)
      const isEnumerating = !c.channel_name && (!c.last_scraped_at || c.playlist_count === 0);
      const isCompleteButNoName = !c.channel_name && c.last_scraped_at && c.playlist_count > 0;
      const hasPlaylists = c.playlist_count > 0;
      
      let channelDisplay = c.channel_name;
      if (!channelDisplay) {
        if (isEnumerating) {
          channelDisplay = '⏳ Enumerating...';
        } else if (isCompleteButNoName) {
          channelDisplay = `Unknown (${c.playlist_count} playlist${c.playlist_count !== 1 ? 's' : ''} found)`;
        } else {
          channelDisplay = 'Unknown';
        }
      }
      
      return `
        <tr>
          <td>
            <a href="#" onclick="viewChannel(${c.id}); return false;">${escapeHtml(channelDisplay)}</a>
            ${isEnumerating ? `
              <div style="margin-top: 0.5rem;">
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${hasPlaylists ? '100' : '50'}%"></div>
                </div>
                <small style="color: var(--text-muted);">${hasPlaylists ? 'Complete - found ' + c.playlist_count + ' playlist(s)' : 'Scanning channel...'}</small>
              </div>
            ` : ''}
          </td>
          <td>${c.pending_count || 0}</td>
          <td>${c.completed_count || 0}</td>
          <td>-</td>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" checked onchange="toggleChannel(${c.id}, this.checked)">
              <span class="slider"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load channels:', err);
  }
}

function loadConfigPage() {
  loadCookies();
  loadSchedulerStatus();
}

async function viewChannel(channelId) {
  const modal = document.getElementById('channel-modal');
  const modalBody = document.getElementById('channel-modal-body');
  
  modalBody.innerHTML = '<p class="loading">Loading playlists...</p>';
  modal.style.display = 'flex';
  
  try {
    const channel = await api.get(`/api/channels/${channelId}`);
    const playlists = await api.get(`/api/channels/${channelId}/playlists`);
    
    document.getElementById('modal-channel-name').textContent = channel.channel_name || 'Channel';
    
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
      <div class="box-header">
        <h3>Playlists (${playlists.length})</h3>
        <div class="button-group">
          <button class="btn btn-secondary btn-small" onclick="enumeratePlaylists(${channelId})">Refresh</button>
          <button class="btn btn-primary btn-small" onclick="downloadChannel(${channelId})">Download All</button>
        </div>
      </div>
      ${playlists.map(p => `
        <div class="playlist-item">
          <div class="playlist-info">
            <h4>${escapeHtml(p.playlist_title)}</h4>
            <small style="color: var(--text-muted);">${p.video_count || 0} video${(p.video_count || 0) !== 1 ? 's' : ''}</small>
          </div>
          <div class="playlist-actions">
            <label class="toggle-switch">
              <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="togglePlaylist(${p.id}, this.checked)">
              <span class="slider"></span>
            </label>
            <button class="btn btn-primary btn-small" onclick="downloadPlaylist(${p.id})">Download</button>
          </div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    showNotification('Failed to load channel: ' + err.message, 'error');
  }
}

async function viewVideo(videoId) {
  const modal = document.getElementById('video-modal');
  const modalBody = document.getElementById('video-modal-body');
  
  modalBody.innerHTML = '<p class="loading">Loading video metadata...</p>';
  modal.style.display = 'flex';
  
  try {
    const video = await api.get(`/api/videos/${videoId}`);
    document.getElementById('modal-video-title').textContent = video.video_title || 'Video';
    
    modalBody.innerHTML = `
      <table class="data-table">
        <tr><th>Video ID</th><td>${escapeHtml(video.video_id)}</td></tr>
        <tr><th>Title</th><td>${escapeHtml(video.video_title)}</td></tr>
        <tr><th>Channel</th><td>${escapeHtml(video.channel_name || 'Unknown')}</td></tr>
        <tr><th>Playlist</th><td>${escapeHtml(video.playlist_title || 'None')}</td></tr>
        <tr><th>Uploader</th><td>${escapeHtml(video.uploader || 'Unknown')}</td></tr>
        <tr><th>Upload Date</th><td>${formatDate(video.upload_date)}</td></tr>
        <tr><th>Duration</th><td>${formatDuration(video.duration)}</td></tr>
        <tr><th>Indexed</th><td>${formatTimestamp(video.created_at)}</td></tr>
        <tr><th>Downloaded</th><td>${formatTimestamp(video.downloaded_at)}</td></tr>
        <tr><th>Status</th><td><span class="status-badge status-${video.download_status}">${video.download_status}</span></td></tr>
        <tr><th>File Path</th><td>${escapeHtml(video.file_path || 'N/A')}</td></tr>
        <tr><th>URL</th><td><a href="${escapeHtml(video.video_url)}" target="_blank">${escapeHtml(video.video_url)}</a></td></tr>
      </table>
    `;
  } catch (err) {
    showNotification('Failed to load video: ' + err.message, 'error');
  }
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
      url, playlist_mode: playlistMode ? 'enumerate' : 'flat',
      flat_mode: flatMode, auto_add_new_playlists: autoAddPlaylists,
      yt_dlp_options: ytDlpOptions || null, rescrape_interval_days: rescrapeDays
    });
    
    closeAddChannelModal();
    showNotification('Channel added! Enumerating playlists...', 'success');
    
    // Switch to channels page and start polling for enumeration completion
    document.querySelector('.nav-item[data-page="channels"]').click();
    
    // Poll for channel name to appear (enumeration complete)
    if (result.type !== 'video') {
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        try {
          const channel = await api.get(`/api/channels/${result.id}`);
          if (channel.channel_name || pollCount > 20) { // Stop after 20 tries (100 seconds)
            clearInterval(pollInterval);
            loadChannelsPage();
            if (channel.channel_name) {
              showNotification(`Channel "${channel.channel_name}" ready!`, 'success');
            }
          } else {
            loadChannelsPage(); // Refresh to show progress
          }
          pollCount++;
        } catch (err) {
          clearInterval(pollInterval);
        }
      }, 5000);
    }
    
    loadStats();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add';
  }
}

async function enumeratePlaylists(channelId) {
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

async function toggleChannel(channelId, enabled) {
  showNotification(`Channel ${enabled ? 'enabled' : 'disabled'} for automation`, 'info');
}

async function downloadChannel(channelId) {
  if (!confirm('Download all enabled playlists from this channel?')) return;
  try {
    const result = await api.post(`/api/channels/${channelId}/download`);
    showNotification(`Queued ${result.queued} videos`, 'success');
    loadQueue();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function downloadPlaylist(playlistId) {
  try {
    const result = await api.post(`/api/playlists/${playlistId}/download`);
    showNotification(`Queued ${result.queued} videos`, 'success');
    loadQueue();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function loadSchedulerStatus() {
  try {
    const status = await api.get('/api/scheduler/status');
    document.getElementById('scheduler-status').innerHTML = 
      `<p>Scheduler is ${status.running ? '<strong style="color: var(--success)">✓ running</strong>' : '<strong style="color: var(--warning)">○ stopped</strong>'}</p>`;
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

function showAddChannelModal() {
  document.getElementById('add-channel-modal').style.display = 'flex';
  document.getElementById('channel-url').focus();
}

function closeAddChannelModal() {
  document.getElementById('add-channel-modal').style.display = 'none';
  // Reset form
  document.getElementById('add-channel-form').reset();
}

function closeChannelModal() {
  document.getElementById('channel-modal').style.display = 'none';
}

function closeVideoModal() {
  document.getElementById('video-modal').style.display = 'none';
}

function prevHistoryPage() {
  if (historyPage > 0) {
    historyPage--;
    loadHistory();
  }
}

function nextHistoryPage() {
  historyPage++;
  loadHistory();
}

function prevQueuePage() {
  if (queuePage > 0) {
    queuePage--;
    loadQueue();
  }
}

function nextQueuePage() {
  queuePage++;
  loadQueue();
}

function startPolling() {
  setInterval(() => {
    const activePage = document.querySelector('.page.active').id;
    if (activePage === 'page-home') {
      loadStats();
      loadQueue();
    } else if (activePage === 'page-channels') {
      loadChannelsPage(); // Refresh to show enumeration progress
    }
  }, 5000);
}

// Utils
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

function formatTimestamp(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString();
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` 
               : `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 ** 3);
  return gb.toFixed(2) + ' GB';
}

function showNotification(message, type = 'info') {
  const colors = { success: '#10b981', error: '#ef4444', info: '#8b5cf6' };
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.background = colors[type];
  notification.style.color = 'white';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Modal close on background click
document.getElementById('channel-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeChannelModal();
});
document.getElementById('video-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeVideoModal();
});
