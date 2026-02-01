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
  loadProfilesIntoDropdowns(); // Load profiles for channel forms
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
  document.getElementById('playlist-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closePlaylistModal();
  });
  document.getElementById('add-profile-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAddProfileModal();
  });
  document.getElementById('edit-profile-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeEditProfileModal();
  });
});

function setupNavigation() {
  // Restore last viewed page from localStorage
  const savedPage = localStorage.getItem('currentPage') || 'home';
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      // Save current page to localStorage
      localStorage.setItem('currentPage', page);
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(`page-${page}`).classList.add('active');
      
      if (page === 'home') loadHomePage();
      if (page === 'channels') loadChannelsPage();
      if (page === 'profiles') loadProfilesPage();
      if (page === 'config') loadConfigPage();
    });
  });
  
  // Restore saved page on load
  const savedPageElement = document.querySelector(`.nav-item[data-page="${savedPage}"]`);
  if (savedPageElement) {
    savedPageElement.click();
  }
}

function setupEventListeners() {
  document.getElementById('add-channel-form').addEventListener('submit', handleAddChannel);
  document.getElementById('playlist-mode').addEventListener('change', (e) => {
    document.getElementById('playlist-options').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('sponsorblock-enabled').addEventListener('change', (e) => {
    document.getElementById('sponsorblock-settings').style.display = e.target.checked ? 'block' : 'none';
  });

  // Enhanced yt-dlp options - show subtitle settings when either subtitle option is enabled
  const updateSubtitleSettings = () => {
    const downloadSubs = document.getElementById('download-subtitles').checked;
    const embedSubs = document.getElementById('embed-subtitles').checked;
    document.getElementById('subtitle-settings').style.display = (downloadSubs || embedSubs) ? 'block' : 'none';
  };
  
  document.getElementById('download-subtitles').addEventListener('change', updateSubtitleSettings);
  document.getElementById('embed-subtitles').addEventListener('change', updateSubtitleSettings);
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
    
    // Calculate total pages
    const totalVideos = await api.get('/api/stats').then(s => s.total_downloads + s.pending_downloads);
    const totalPages = Math.max(1, Math.ceil(totalVideos / pageSize));
    
    if (history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No downloads yet</td></tr>';
      document.getElementById('history-next').disabled = true;
    } else {
      tbody.innerHTML = history.map(v => `
        <tr>
          <td>
            <a href="#" onclick="viewVideo('${v.video_id}'); return false;">${escapeHtml(v.video_title)}</a>
            ${v.download_status === 'failed' ? `<br><small class="error-text" title="${escapeHtml(v.error_message || 'Download failed')}">${escapeHtml(v.error_message || 'Download failed')}</small>` : ''}
          </td>
          <td>${formatDate(v.upload_date)}</td>
          <td>
            ${v.download_status === 'completed' ? '<span class="status-badge status-completed">✓ Completed</span>' : 
              v.download_status === 'pending' ? '<span class="status-badge status-pending">Pending</span>' :
              v.download_status === 'downloading' ? '<span class="status-badge status-downloading">Downloading</span>' :
              v.download_status === 'failed' ? '<span class="status-badge status-failed">✗ Failed</span>' :
              `<span class="status-badge status-${v.download_status}">${v.download_status}</span>`}
          </td>
          <td>${formatTimestamp(v.created_at)}</td>
          <td>${v.download_status === 'completed' ? formatTimestamp(v.downloaded_at) : '-'}</td>
          <td>${escapeHtml(v.channel_name || 'Unknown')}</td>
        </tr>
      `).join('');
      document.getElementById('history-next').disabled = history.length < pageSize;
    }
    document.getElementById('history-prev').disabled = historyPage === 0;
    document.getElementById('history-page-info').textContent = `Page ${historyPage + 1} of ${totalPages}`;
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

async function loadQueue() {
  try {
    const [status, pendingVideos, failedVideos] = await Promise.all([
      api.get('/api/download/status'),
      api.get('/api/download/queue?limit=10'),
      api.get('/api/downloads/recent?limit=50&status=failed')
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
      })),
      ...failedVideos.slice(0, 5).map(v => ({
        video_id: v.video_id,
        video_title: v.video_title,
        channel_name: v.channel_name,
        error_message: v.error_message,
        status: 'failed',
        type: 'failed'
      }))
    ];
    
    const queueStatus = document.getElementById('queue-status');
    const hasPending = pendingVideos.length > 0 && status.active === 0;
    if (hasPending) {
      queueStatus.innerHTML = `
        <div style="background: var(--warning); color: white; padding: 0.5rem 1rem; border-radius: 4px; margin-bottom: 1rem;">
          ${pendingVideos.length} videos pending • 
          <button class="btn btn-secondary btn-small" onclick="startDownloads()" style="margin-left: 0.5rem;">Start Downloads</button>
        </div>
      `;
    } else {
      queueStatus.innerHTML = '';
    }
    
    const hasFailedVideos = failedVideos.length > 0;
    if (hasFailedVideos) {
      const retrySection = queueStatus.innerHTML;
      queueStatus.innerHTML = retrySection + `
        <div style="background: var(--danger); color: white; padding: 0.5rem 1rem; border-radius: 4px; margin-bottom: 1rem;">
          ${failedVideos.length} failed downloads • 
          <button class="btn btn-secondary btn-small" onclick="retryFailedDownloads()" style="margin-left: 0.5rem;">Retry All Failed</button>
        </div>
      `;
    }
    
    const tbody = document.getElementById('queue-table-body');
    if (allItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No items in queue</td></tr>';
    } else {
      const start = queuePage * pageSize;
      const pageItems = allItems.slice(start, start + pageSize);
      const totalPages = Math.ceil(allItems.length / pageSize);
      
      tbody.innerHTML = pageItems.map(item => `
        <tr onclick="viewVideo('${item.video_id}')" style="cursor: pointer;">
          <td title="${escapeHtml(item.video_id)}">${escapeHtml(item.video_title || item.video_id)}</td>
          <td>
            ${item.status === 'completed' ? '<span class="status-badge status-completed">✓ Completed</span>' : 
              item.status === 'pending' ? '<span class="status-badge status-pending">Pending</span>' :
              item.status === 'downloading' ? '<span class="status-badge status-downloading">Downloading</span>' :
              item.status === 'failed' ? '<span class="status-badge status-failed">✗ Failed</span>' :
              `<span class="status-badge status-${item.status}">${item.status}</span>`}
          </td>
          <td>
            ${item.progress ? `
              <div class="progress-bar"><div class="progress-fill" style="width: ${item.progress}%"></div></div>
              ${item.progress.toFixed(1)}%
            ` : (item.status === 'pending' ? 'Waiting' : item.status === 'failed' ? `<span class="error-text" title="${escapeHtml(item.error_message || 'Error')}">${escapeHtml((item.error_message || 'Error').substring(0, 30))}${(item.error_message || '').length > 30 ? '...' : ''}</span>` : '-')}
          </td>
          <td>${item.channel_name || '-'}</td>
        </tr>
      `).join('');
      
      document.getElementById('queue-next').disabled = start + pageSize >= allItems.length;
      document.getElementById('queue-page-info').textContent = `Page ${queuePage + 1} of ${totalPages}`;
    }
    document.getElementById('queue-prev').disabled = queuePage === 0;
  } catch (err) {
    console.error('Failed to load queue:', err);
  }
}

async function loadChannelsPage() {
  try {
    const channelStats = await api.get('/api/stats/channels');
    const tbody = document.getElementById('channels-table-body');
    
    if (channelStats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No channels added yet</td></tr>';
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
          <td>${c.total_size ? formatSize(c.total_size) : '0 GB'}</td>
          <td>${formatDateTime(c.last_scraped_at)}</td>
          <td>
            <label class="toggle-switch">
              <input type="checkbox" ${c.enabled !== 0 ? 'checked' : ''} onchange="toggleChannel(${c.id}, this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load channels:', err);
  }
}

async function loadProfilesPage() {
  try {
    const profiles = await api.get('/api/profiles');
    const tbody = document.getElementById('profiles-table-body');
    
    if (profiles.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No profiles created yet</td></tr>';
      return;
    }
    
    tbody.innerHTML = profiles.map(p => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td style="font-family: monospace; font-size: 0.85em;">${escapeHtml(p.output_template)}</td>
        <td style="font-family: monospace; font-size: 0.85em;">${escapeHtml(p.format_selection || 'default')}</td>
        <td>
          <button class="btn btn-secondary btn-small" onclick="editProfile(${p.id})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="deleteProfile(${p.id})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
}

async function loadConfigPage() {
  loadCookies();
  loadSchedulerStatus();
  await checkAndShowApiQuota(); // Check if API key exists first
}

// Check for API key and conditionally show/hide quota section
async function checkAndShowApiQuota() {
  try {
    const response = await api.get('/api/youtube-api/key');
    const quotaStatusDiv = document.getElementById('youtube-api-quota-status');
    
    if (quotaStatusDiv) {
      if (response.hasKey) {
        // Has key - load and display quota
        await loadYouTubeApiQuota();
      } else {
        // No key - hide the quota display
        quotaStatusDiv.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Add an API key above to see quota information</p>';
      }
    }
  } catch (err) {
    console.error('Failed to check API key:', err);
  }
}

async function viewChannel(channelId) {
  const modal = document.getElementById('channel-modal');
  const modalBody = document.getElementById('channel-modal-body');
  
  modalBody.innerHTML = '<p class="loading">Loading channel details...</p>';
  modal.style.display = 'flex';
  
  try {
    const channel = await api.get(`/api/channels/${channelId}`);
    const playlists = await api.get(`/api/channels/${channelId}/playlists`);
    
    document.getElementById('modal-channel-name').textContent = channel.channel_name || 'Channel';
    
    modalBody.innerHTML = `
      <!-- Playlists -->
      <div class="content-box" style="margin-bottom: 1rem;">
        ${playlists.length === 0 ? `
          <div class="empty-state">
            <p>No playlists found.</p>
            <button class="btn btn-primary" onclick="enumeratePlaylists(${channelId})">Enumerate Now</button>
          </div>
        ` : `
          <div class="box-header">
            <h3>Playlists (${playlists.length})</h3>
            <div class="button-group">
              <button class="btn btn-secondary btn-small" onclick="enumeratePlaylists(${channelId})">Refresh All</button>
              <button class="btn btn-primary btn-small" onclick="downloadChannel(${channelId})">Download All</button>
            </div>
          </div>
          ${playlists.map(p => `
            <div class="playlist-item">
              <div class="playlist-info" style="cursor: pointer;" onclick="viewPlaylist(${p.id})">
                <h4>${escapeHtml(p.playlist_title)}</h4>
                <small style="color: var(--text-muted);">
                  ${p.video_count || 0} video${(p.video_count || 0) !== 1 ? 's' : ''}
                  ${p.total_size ? ` • ${formatFileSize(p.total_size)} downloaded` : ''}
                </small>
              </div>
              <div class="playlist-actions">
                <label class="toggle-switch">
                  <input type="checkbox" ${p.enabled ? 'checked' : ''} onchange="togglePlaylist(${p.id}, this.checked)">
                  <span class="toggle-slider"></span>
                </label>
                <button class="btn btn-secondary btn-small" onclick="refreshPlaylist(${p.id}, ${channelId})" title="Refresh video count">↻</button>
                <button class="btn btn-primary btn-small" onclick="downloadPlaylist(${p.id})">Download</button>
              </div>
            </div>
          `).join('')}
        `}
      </div>

      <!-- Channel Settings -->
      <div class="content-box">
        <h3>Channel Settings</h3>
        <form id="edit-channel-form-${channelId}" onsubmit="saveChannelSettings(${channelId}, event); return false;">
          <div class="form-group">
            <label>Channel URL</label>
            <input type="text" value="${escapeHtml(channel.url)}" disabled style="background: var(--surface-hover); cursor: not-allowed;">
            <small>URL cannot be changed after adding</small>
          </div>
          <div class="form-group">
            <label for="edit-profile-${channelId}">yt-dlp Profile</label>
            <select id="edit-profile-${channelId}">
              <option value="">None (uses custom options below)</option>
            </select>
            <small>Select a profile or leave as None to use custom yt-dlp options in the Advanced section below</small>
          </div>
          <div class="form-group">
            <label>
              <div class="toggle-switch">
                <input type="checkbox" id="edit-playlist-mode-${channelId}" ${channel.playlist_mode === 'enumerate' ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </div>
              Enumerate Playlists
            </label>
          </div>
          <div class="form-group">
            <label>
              <div class="toggle-switch">
                <input type="checkbox" id="edit-auto-add-${channelId}" ${channel.auto_add_new_playlists ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </div>
              Auto-enable new playlists
            </label>
          </div>
          <div class="form-group">
            <label>
              <div class="toggle-switch">
                <input type="checkbox" id="edit-flat-mode-${channelId}" ${channel.flat_mode ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </div>
              Flat mode (single folder)
            </label>
          </div>

          <!-- Enhanced yt-dlp Options -->
          <div class="content-box" style="margin: 1rem 0;">
            <h3>Enhanced yt-dlp Options</h3>
            
            <!-- Metadata Options -->
            <div class="form-group">
              <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Metadata</label>
              <div style="margin-left: 0.5rem;">
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-download-metadata-${channelId}" ${channel.download_metadata ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Download Metadata
                </label>
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-embed-metadata-${channelId}" ${channel.embed_metadata ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Embed Metadata
                </label>
              </div>
              <small style="display: block; margin-top: 0.25rem;">Download writes .info.json file. Embed adds metadata to video file.</small>
            </div>

            <!-- Thumbnail Options -->
            <div class="form-group">
              <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Thumbnails</label>
              <div style="margin-left: 0.5rem;">
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-download-thumbnail-${channelId}" ${channel.download_thumbnail ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Download Thumbnail
                </label>
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-embed-thumbnail-${channelId}" ${channel.embed_thumbnail ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Embed Thumbnail
                </label>
              </div>
              <small style="display: block; margin-top: 0.25rem;">Download writes image file. Embed adds thumbnail to video file.</small>
            </div>

            <!-- Subtitle Options -->
            <div class="form-group">
              <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Subtitles</label>
              <div style="margin-left: 0.5rem;">
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-download-subtitles-${channelId}" ${channel.download_subtitles ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Download Subtitles
                </label>
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-embed-subtitles-${channelId}" ${channel.embed_subtitles ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Embed Subtitles
                </label>
              </div>
              <small style="display: block; margin-top: 0.25rem;">Download writes .srt/.vtt files. Embed burns subtitles into video.</small>
            </div>

            <div id="edit-subtitle-settings-${channelId}" style="display: ${channel.download_subtitles || channel.embed_subtitles ? 'block' : 'none'}; margin-left: 1rem; padding-left: 1rem; border-left: 2px solid var(--border);">
              <div class="form-group">
                <label for="edit-subtitle-languages-${channelId}">Subtitle Languages</label>
                <input type="text" id="edit-subtitle-languages-${channelId}" value="${escapeHtml(channel.subtitle_languages || 'en')}" placeholder="en">
                <small>Comma-separated language codes (e.g., en,de,es,fr)</small>
              </div>
              <div class="form-group">
                <label>
                  <div class="toggle-switch">
                    <input type="checkbox" id="edit-auto-subtitles-${channelId}" ${channel.auto_subtitles ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </div>
                  Auto-generated Subtitles
                </label>
                <small style="display: block; margin-top: 0.25rem;">If enabled, downloads auto-generated subtitles when manual ones aren't available</small>
              </div>
            </div>
          </div>

          <!-- SponsorBlock Options -->
          <div class="content-box" style="margin: 1rem 0;">
            <h3>SponsorBlock Options</h3>
            <div class="form-group">
              <label>
                <div class="toggle-switch">
                  <input type="checkbox" id="edit-sponsorblock-enabled-${channelId}" ${channel.sponsorblock_enabled ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </div>
                Enable SponsorBlock
              </label>
              <small>Automatically handle sponsored segments and other video sections</small>
            </div>
            <div id="edit-sponsorblock-settings-${channelId}" style="display: ${channel.sponsorblock_enabled ? 'block' : 'none'};">
              <div class="form-group">
                <label for="edit-sponsorblock-mode-${channelId}">Behavior</label>
                <select id="edit-sponsorblock-mode-${channelId}">
                  <option value="mark" ${channel.sponsorblock_mode === 'mark' ? 'selected' : ''}>Mark segments as chapters</option>
                  <option value="remove" ${channel.sponsorblock_mode === 'remove' ? 'selected' : ''}>Remove segments</option>
                </select>
                <small>Mark: Add chapter markers. Remove: Cut segments from video (requires ffmpeg)</small>
              </div>
              <div class="form-group">
                <label>Categories to process:</label>
                <div style="margin-left: 0.5rem;">
                  ${['sponsor', 'intro', 'outro', 'selfpromo', 'interaction', 'preview', 'music_offtopic'].map(cat => {
                    const categories = (channel.sponsorblock_categories || '').split(',');
                    const checked = categories.includes(cat) ? 'checked' : '';
                    const labels = { sponsor: 'Sponsor', intro: 'Intro', outro: 'Outro/Credits', selfpromo: 'Self-promotion', interaction: 'Interaction (Subscribe/Like)', preview: 'Preview/Recap', music_offtopic: 'Non-music (in music videos)' };
                    return `<label>
                      <div class="toggle-switch">
                        <input type="checkbox" class="edit-sponsorblock-category-${channelId}" value="${cat}" ${checked}>
                        <span class="toggle-slider"></span>
                      </div>
                      ${labels[cat]}
                    </label>`;
                  }).join('')}
                </div>
                <small>Select which types of segments to mark or remove</small>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="edit-yt-dlp-options-${channelId}">Custom yt-dlp options</label>
            <textarea id="edit-yt-dlp-options-${channelId}" rows="3" placeholder="Example: --dateafter 20081004 --format-sort res:1080">${escapeHtml(channel.yt_dlp_options || '')}</textarea>
            <small>Advanced yt-dlp options only. Metadata/thumbnails/subtitles are controlled by toggles above.</small>
          </div>
          
          <!-- Computed Options Display -->
          <div class="content-box" style="margin: 1rem 0; background: var(--surface-hover);">
            <h4 style="margin-bottom: 0.5rem;">Final yt-dlp Options for This Channel</h4>
            <div id="computed-options-${channelId}" style="font-family: monospace; font-size: 0.85rem; color: var(--text-muted); padding: 0.75rem; background: var(--background); border-radius: 4px; word-wrap: break-word; white-space: pre-wrap;">
              Loading...
            </div>
            <small style="display: block; margin-top: 0.5rem;">This shows the actual flags that will be used when downloading. Toggles override conflicting flags in custom options.</small>
          </div>
          
          <div class="form-group">
            <label for="edit-rescrape-days-${channelId}">Re-scrape interval (days)</label>
            <input type="number" id="edit-rescrape-days-${channelId}" value="${channel.rescrape_interval_days || 7}" min="1">
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button type="submit" class="btn btn-primary">Save Settings</button>
            <button type="button" class="btn btn-danger" onclick="openDeleteChannelModal(${channelId}); return false;" style="margin-left: auto;">Delete Channel</button>
          </div>
        </form>
      </div>
    `;
    
    // Load profiles into the edit dropdown after rendering
    await loadProfilesIntoDropdowns();
    if (channel.profile_id) {
      document.getElementById(`edit-profile-${channelId}`).value = channel.profile_id;
    }
    
    // Compute and display final options
    updateComputedOptions(channelId, channel);
    
    // Update computed options on any field change
    const fieldsToWatch = [
      `edit-profile-${channelId}`,
      `edit-yt-dlp-options-${channelId}`,
      `edit-download-metadata-${channelId}`,
      `edit-embed-metadata-${channelId}`,
      `edit-download-thumbnail-${channelId}`,
      `edit-embed-thumbnail-${channelId}`,
      `edit-download-subtitles-${channelId}`,
      `edit-embed-subtitles-${channelId}`,
      `edit-subtitle-languages-${channelId}`,
      `edit-auto-subtitles-${channelId}`,
      `edit-sponsorblock-enabled-${channelId}`,
      `edit-sponsorblock-mode-${channelId}`
    ];
    
    fieldsToWatch.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.addEventListener('change', () => updateComputedOptions(channelId, channel));
        element.addEventListener('input', () => updateComputedOptions(channelId, channel));
      }
    });
    
    // Watch SponsorBlock category changes
    document.querySelectorAll(`.edit-sponsorblock-category-${channelId}`).forEach(cb => {
      cb.addEventListener('change', () => updateComputedOptions(channelId, channel));
    });
    
    // Add SponsorBlock toggle handler for edit form
    document.getElementById(`edit-sponsorblock-enabled-${channelId}`).addEventListener('change', function(e) {
      const settings = document.getElementById(`edit-sponsorblock-settings-${channelId}`);
      settings.style.display = e.target.checked ? 'block' : 'none';
    });
    
    // Add subtitle settings toggle handler for edit form
    const updateEditSubtitleSettings = () => {
      const downloadSubs = document.getElementById(`edit-download-subtitles-${channelId}`).checked;
      const embedSubs = document.getElementById(`edit-embed-subtitles-${channelId}`).checked;
      document.getElementById(`edit-subtitle-settings-${channelId}`).style.display = (downloadSubs || embedSubs) ? 'block' : 'none';
    };
    
    document.getElementById(`edit-download-subtitles-${channelId}`).addEventListener('change', updateEditSubtitleSettings);
    document.getElementById(`edit-embed-subtitles-${channelId}`).addEventListener('change', updateEditSubtitleSettings);
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
        <tr><th>Resolution</th><td>${escapeHtml(video.resolution || 'N/A')}</td></tr>
        <tr><th>Frame Rate</th><td>${video.fps ? video.fps + ' FPS' : 'N/A'}</td></tr>
        <tr><th>Video Codec</th><td>${formatVideoCodec(video.vcodec || 'N/A')}</td></tr>
        <tr><th>Audio Codec</th><td>${formatAudioCodec(video.acodec || 'N/A')}</td></tr>
        <tr><th>File Size</th><td>${video.file_size ? formatFileSize(video.file_size) : 'N/A'}</td></tr>
        <tr><th>Indexed</th><td>${formatTimestamp(video.created_at)}</td></tr>
        <tr><th>Downloaded</th><td>${formatTimestamp(video.downloaded_at)}</td></tr>
        <tr><th>Status</th><td><span class="status-badge status-${video.download_status}">${video.download_status}</span></td></tr>
        ${video.download_status === 'failed' && video.error_message ? `
          <tr><th>Error</th><td style="color: var(--danger); font-family: monospace; font-size: 0.85em;">${escapeHtml(video.error_message)}</td></tr>
        ` : ''}
        <tr><th>File Path</th><td style="word-break: break-all; font-family: monospace; font-size: 0.85em;">${escapeHtml(video.file_path || 'N/A')}</td></tr>
        <tr><th>URL</th><td><a href="${escapeHtml(video.video_url)}" target="_blank">${escapeHtml(video.video_url)}</a></td></tr>
      </table>
      <div class="button-group" style="margin-top: 1rem; justify-content: flex-end;">
        ${video.download_status === 'failed' || video.download_status === 'completed' ? `
          <button class="btn btn-secondary" onclick="forceRedownload('${video.video_id}')">Force Redownload</button>
        ` : ''}
        <button class="btn btn-danger" onclick="deleteVideo('${video.video_id}')">Delete Video</button>
      </div>
    `;
  } catch (err) {
    showNotification('Failed to load video: ' + err.message, 'error');
  }
}

async function deleteVideo(videoId) {
  if (!confirm('Delete this video? This will permanently delete the file from disk and remove it from the database.')) return;
  
  try {
    await api.delete(`/api/videos/${videoId}`);
    showNotification('Video and files deleted', 'success');
    closeVideoModal();
    loadHistory();
    loadQueue();
  } catch (err) {
    showNotification('Failed to delete video: ' + err.message, 'error');
  }
}

async function forceRedownload(videoId) {
  if (!confirm('Force redownload this video? This will reset its status to pending.')) return;
  
  try {
    await api.post(`/api/videos/${videoId}/redownload`);
    showNotification('Video queued for redownload', 'success');
    closeVideoModal();
    loadQueue();
  } catch (err) {
    showNotification('Failed to redownload: ' + err.message, 'error');
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
  const profileId = document.getElementById('profile-select').value || null;
  
  // Enhanced yt-dlp options
  const downloadMetadata = document.getElementById('download-metadata').checked;
  const embedMetadata = document.getElementById('embed-metadata').checked;
  const downloadThumbnail = document.getElementById('download-thumbnail').checked;
  const embedThumbnail = document.getElementById('embed-thumbnail').checked;
  const downloadSubtitles = document.getElementById('download-subtitles').checked;
  const embedSubtitles = document.getElementById('embed-subtitles').checked;
  const subtitleLanguages = document.getElementById('subtitle-languages').value.trim();
  const autoSubtitles = document.getElementById('auto-subtitles').checked;
  
  // SponsorBlock options
  const sponsorblockEnabled = document.getElementById('sponsorblock-enabled').checked;
  const sponsorblockMode = document.getElementById('sponsorblock-mode').value;
  const categoryCheckboxes = document.querySelectorAll('.sponsorblock-category:checked');
  const sponsorblockCategories = Array.from(categoryCheckboxes).map(cb => cb.value).join(',');

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  try {
    const result = await api.post('/api/channels', {
      url, playlist_mode: playlistMode ? 'enumerate' : 'flat',
      flat_mode: flatMode, auto_add_new_playlists: autoAddPlaylists,
      yt_dlp_options: ytDlpOptions || null, rescrape_interval_days: rescrapeDays,
      profile_id: profileId,
      download_metadata: downloadMetadata,
      embed_metadata: embedMetadata,
      download_thumbnail: downloadThumbnail,
      embed_thumbnail: embedThumbnail,
      download_subtitles: downloadSubtitles,
      embed_subtitles: embedSubtitles,
      subtitle_languages: subtitleLanguages || 'en',
      auto_subtitles: autoSubtitles,
      sponsorblock_enabled: sponsorblockEnabled,
      sponsorblock_mode: sponsorblockMode,
      sponsorblock_categories: sponsorblockCategories || null
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
    showNotification('Refreshing all playlists (this may take a moment)...', 'info');
    const result = await api.post(`/api/channels/${channelId}/enumerate`);
    await viewChannel(channelId);
    showNotification(`Refreshed ${result.playlists.length} playlists!`, 'success');
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}

async function saveChannelSettings(channelId, e) {
  e.preventDefault();
  
  const playlistMode = document.getElementById(`edit-playlist-mode-${channelId}`).checked;
  const autoAdd = document.getElementById(`edit-auto-add-${channelId}`).checked;
  const flatMode = document.getElementById(`edit-flat-mode-${channelId}`).checked;
  const ytDlpOptions = document.getElementById(`edit-yt-dlp-options-${channelId}`).value.trim();
  const rescrapeDays = parseInt(document.getElementById(`edit-rescrape-days-${channelId}`).value);
  const profileId = document.getElementById(`edit-profile-${channelId}`)?.value || null;
  
  // Enhanced yt-dlp options
  const downloadMetadata = document.getElementById(`edit-download-metadata-${channelId}`).checked;
  const embedMetadata = document.getElementById(`edit-embed-metadata-${channelId}`).checked;
  const downloadThumbnail = document.getElementById(`edit-download-thumbnail-${channelId}`).checked;
  const embedThumbnail = document.getElementById(`edit-embed-thumbnail-${channelId}`).checked;
  const downloadSubtitles = document.getElementById(`edit-download-subtitles-${channelId}`).checked;
  const embedSubtitles = document.getElementById(`edit-embed-subtitles-${channelId}`).checked;
  const subtitleLanguages = document.getElementById(`edit-subtitle-languages-${channelId}`).value.trim();
  const autoSubtitles = document.getElementById(`edit-auto-subtitles-${channelId}`).checked;
  
  // SponsorBlock options
  const sponsorblockEnabled = document.getElementById(`edit-sponsorblock-enabled-${channelId}`).checked;
  const sponsorblockMode = document.getElementById(`edit-sponsorblock-mode-${channelId}`).value;
  const categoryCheckboxes = document.querySelectorAll(`.edit-sponsorblock-category-${channelId}:checked`);
  const sponsorblockCategories = Array.from(categoryCheckboxes).map(cb => cb.value).join(',');
  
  try {
    await api.put(`/api/channels/${channelId}`, {
      playlist_mode: playlistMode ? 'enumerate' : 'flat',
      flat_mode: flatMode,
      auto_add_new_playlists: autoAdd,
      yt_dlp_options: ytDlpOptions || null,
      rescrape_interval_days: rescrapeDays,
      profile_id: profileId,
      download_metadata: downloadMetadata,
      embed_metadata: embedMetadata,
      download_thumbnail: downloadThumbnail,
      embed_thumbnail: embedThumbnail,
      download_subtitles: downloadSubtitles,
      embed_subtitles: embedSubtitles,
      subtitle_languages: subtitleLanguages || 'en',
      auto_subtitles: autoSubtitles,
      sponsorblock_enabled: sponsorblockEnabled,
      sponsorblock_mode: sponsorblockMode,
      sponsorblock_categories: sponsorblockCategories || null
    });
    
    showNotification('Channel settings saved!', 'success');
    loadChannelsPage(); // Refresh channels table
  } catch (err) {
    showNotification('Failed to save: ' + err.message, 'error');
  }
}

// Delete Channel Modal
let channelToDelete = null;

function openDeleteChannelModal(channelId) {
  channelToDelete = channelId;
  document.getElementById('delete-channel-modal').style.display = 'flex';
  document.getElementById('delete-files-toggle').checked = false;
}

function closeDeleteChannelModal() {
  document.getElementById('delete-channel-modal').style.display = 'none';
  channelToDelete = null;
}

async function confirmDeleteChannel() {
  if (!channelToDelete) return;
  
  const deleteFiles = document.getElementById('delete-files-toggle').checked;
  
  try {
    await api.delete(`/api/channels/${channelToDelete}?deleteFiles=${deleteFiles}`);
    showNotification('Channel deleted successfully', 'success');
    closeDeleteChannelModal();
    closeChannelModal();
    loadChannelsPage();
  } catch (err) {
    showNotification('Failed to delete channel: ' + err.message, 'error');
  }
}

function updateComputedOptions(channelId, channel) {
  try {
    // Get current field values
    const downloadMetadata = document.getElementById(`edit-download-metadata-${channelId}`)?.checked;
    const embedMetadata = document.getElementById(`edit-embed-metadata-${channelId}`)?.checked;
    const downloadThumbnail = document.getElementById(`edit-download-thumbnail-${channelId}`)?.checked;
    const embedThumbnail = document.getElementById(`edit-embed-thumbnail-${channelId}`)?.checked;
    const downloadSubtitles = document.getElementById(`edit-download-subtitles-${channelId}`)?.checked;
    const embedSubtitles = document.getElementById(`edit-embed-subtitles-${channelId}`)?.checked;
    const subtitleLanguages = document.getElementById(`edit-subtitle-languages-${channelId}`)?.value.trim();
    const autoSubtitles = document.getElementById(`edit-auto-subtitles-${channelId}`)?.checked;
    const sponsorblockEnabled = document.getElementById(`edit-sponsorblock-enabled-${channelId}`)?.checked;
    const sponsorblockMode = document.getElementById(`edit-sponsorblock-mode-${channelId}`)?.value;
    const customOptions = document.getElementById(`edit-yt-dlp-options-${channelId}`)?.value.trim();
    const profileId = document.getElementById(`edit-profile-${channelId}`)?.value;
    
    const computeFinal = (profileOpts = []) => {
      const allArgs = [];
      
      // 1. Add toggle-based options
      if (downloadMetadata) allArgs.push('--write-info-json');
      if (embedMetadata) allArgs.push('--embed-metadata');
      if (downloadThumbnail) allArgs.push('--write-thumbnail');
      if (embedThumbnail) allArgs.push('--embed-thumbnail');
      
      if (downloadSubtitles || embedSubtitles) {
        const langs = subtitleLanguages || 'en';
        allArgs.push(`--sub-langs ${langs}`);
        if (downloadSubtitles) allArgs.push('--write-subs');
        if (embedSubtitles) allArgs.push('--embed-subs');
        if (autoSubtitles) allArgs.push('--write-auto-subs');
      }
      
      // 2. Add SponsorBlock options
      if (sponsorblockEnabled) {
        const categories = Array.from(document.querySelectorAll(`.edit-sponsorblock-category-${channelId}:checked`))
          .map(cb => cb.value).join(',');
        if (categories) {
          const mode = sponsorblockMode || 'mark';
          allArgs.push(`--sponsorblock-${mode} ${categories}`);
        }
      }
      
      // 3. Add profile options (parsed)
      profileOpts.forEach(opt => allArgs.push(opt));
      
      // 4. Filter and add custom options
      const flagsToFilter = [];
      if (downloadMetadata) flagsToFilter.push('--write-info-json');
      if (embedMetadata) flagsToFilter.push('--embed-metadata');
      if (downloadThumbnail) flagsToFilter.push('--write-thumbnail');
      if (embedThumbnail) flagsToFilter.push('--embed-thumbnail');
      if (downloadSubtitles) flagsToFilter.push('--write-subs', '--write-subtitles');
      if (embedSubtitles) flagsToFilter.push('--embed-subs', '--embed-subtitles');
      if (autoSubtitles) flagsToFilter.push('--write-auto-subs', '--write-automatic-subs');
      if (downloadSubtitles || embedSubtitles) flagsToFilter.push('--sub-lang', '--sub-langs');
      
      if (customOptions) {
        const customArgsParsed = customOptions.split(/\s+/);
        customArgsParsed.forEach(arg => {
          const argWithoutValue = arg.split('=')[0];
          if (!flagsToFilter.includes(argWithoutValue)) {
            allArgs.push(arg);
          }
        });
      }
      
      // 5. Deduplicate: keep first occurrence of each flag
      const seen = new Set();
      const deduplicated = [];
      
      for (const arg of allArgs) {
        const key = arg.split('=')[0].split(' ')[0]; // Get flag without value
        if (!seen.has(key) && key.startsWith('-')) {
          seen.add(key);
          deduplicated.push(arg);
        } else if (!key.startsWith('-')) {
          // Not a flag (e.g., value part), keep it
          deduplicated.push(arg);
        }
      }
      
      return deduplicated.length > 0 ? deduplicated.join(' ') : '(no additional options)';
    };
    
    // Fetch profile if selected, otherwise compute immediately
    if (profileId) {
      api.get(`/api/profiles/${profileId}`).then(profile => {
        const profileOpts = [];
        if (profile.format_selection) profileOpts.push(`-f "${profile.format_selection}"`);
        if (profile.merge_output_format) profileOpts.push(`--merge-output-format ${profile.merge_output_format}`);
        if (profile.additional_args) {
          // Parse additional args instead of adding as single string
          profile.additional_args.split(/\s+/).forEach(arg => profileOpts.push(arg));
        }
        
        document.getElementById(`computed-options-${channelId}`).textContent = computeFinal(profileOpts);
      }).catch(() => {
        document.getElementById(`computed-options-${channelId}`).textContent = computeFinal();
      });
    } else {
      document.getElementById(`computed-options-${channelId}`).textContent = computeFinal();
    }
  } catch (err) {
    console.error('Failed to update computed options:', err);
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
  try {
    console.log(`Toggling channel ${channelId} to ${enabled}`);
    await api.put(`/api/channels/${channelId}`, { enabled });
    console.log(`Successfully toggled channel ${channelId}`);
    showNotification(`Channel ${enabled ? 'enabled' : 'disabled'} for automation`, 'success');
  } catch (err) {
    console.error(`Failed to toggle channel ${channelId}:`, err);
    showNotification(`Failed to toggle channel: ${err.message}`, 'error');
    // Revert the toggle on error
    const checkbox = document.querySelector(`input[onchange*="toggleChannel(${channelId}"]`);
    if (checkbox) checkbox.checked = !enabled;
  }
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

async function startDownloads() {
  try {
    await api.post('/api/download/start');
    showNotification('Downloads started', 'success');
    loadQueue();
  } catch (err) {
    showNotification('Failed to start downloads: ' + err.message, 'error');
  }
}

async function retryFailedDownloads() {
  if (!confirm('Retry all failed downloads?')) return;
  
  try {
    await api.post('/api/download/retry-failed');
    showNotification('Failed downloads queued for retry', 'success');
    loadQueue();
  } catch (err) {
    showNotification('Failed to retry downloads: ' + err.message, 'error');
  }
}

async function refreshPlaylist(playlistId, channelId) {
  try {
    const result = await api.post(`/api/playlists/${playlistId}/enumerate`);
    showNotification(`Updated: ${result.video_count} videos found`, 'success');
    // Refresh the channel modal to show updated count
    viewChannel(channelId);
  } catch (err) {
    showNotification('Failed to refresh playlist: ' + err.message, 'error');
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
    // Don't show notifications on initial load, only on explicit actions
  } catch (err) {
    console.error('Failed to load cookies:', err);
    // Only show notification if there's an actual error
    if (err.message && !err.message.includes('404')) {
      showNotification('Failed to load cookies: ' + err.message, 'error');
    }
  }
}

async function saveCookies() {
  const content = document.getElementById('cookies-content').value;
  try {
    const result = await api.post('/api/cookies', { content });
    
    let message = result.message;
    if (result.warnings && result.warnings.length > 0) {
      message += '\nWarnings: ' + result.warnings.join(', ');
    }
    
    showNotification(message, 'success');
  } catch (err) {
    // Handle validation errors
    const errorData = err.message;
    if (errorData.includes('Invalid cookie format')) {
      showNotification('Invalid cookie format. Check the format and try again.', 'error');
    } else {
      showNotification('Failed: ' + err.message, 'error');
    }
  }
}

async function testCookies() {
  try {
    showNotification('Testing cookies with YouTube...', 'info');
    const result = await api.post('/api/cookies/test');
    
    if (result.valid) {
      showNotification('✓ ' + result.message, 'success');
    } else {
      showNotification('✗ ' + result.error, 'error');
    }
  } catch (err) {
    showNotification('Test failed: ' + err.message, 'error');
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

// YouTube API Key Management
async function saveYouTubeApiKey() {
  const apiKey = document.getElementById('youtube-api-key').value.trim();
  if (!apiKey) {
    showNotification('Please enter an API key', 'error');
    return;
  }
  
  try {
    await api.post('/api/youtube-api/key', { apiKey });
    showNotification('YouTube API key saved successfully', 'success');
    document.getElementById('youtube-api-key').value = ''; // Clear input after save
    await loadConfigPage(); // Reload to show quota
  } catch (err) {
    showNotification('Failed to save API key: ' + err.message, 'error');
  }
}

async function testYouTubeApiKey() {
  // First, check if there's a key in the input field
  let apiKey = document.getElementById('youtube-api-key').value.trim();
  
  // If no key in input, check if there's a saved key
  if (!apiKey) {
    try {
      const keyStatus = await api.get('/api/youtube-api/key');
      if (!keyStatus.hasKey) {
        showNotification('Please enter an API key to test, or save one first', 'error');
        return;
      }
      // Test the saved key (server-side will use the saved key)
      showNotification('Testing saved API key...', 'info');
      apiKey = null; // Signal to server to use saved key
    } catch (err) {
      showNotification('No API key available to test', 'error');
      return;
    }
  }
  
  try {
    const result = await api.post('/api/youtube-api/test', { apiKey });
    if (result.valid) {
      showNotification('API key is valid! ✓', 'success');
      if (result.quota) {
        displayQuotaStatus(result.quota);
      }
    } else {
      showNotification('API key is invalid: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (err) {
    showNotification('API key test failed: ' + err.message, 'error');
  }
}

async function deleteYouTubeApiKey() {
  if (!confirm('Delete YouTube API key? Channel enumeration will use yt-dlp web scraping instead.')) {
    return;
  }
  
  try {
    await api.delete('/api/youtube-api/key');
    document.getElementById('youtube-api-key').value = '';
    document.getElementById('youtube-api-quota-status').innerHTML = '';
    showNotification('YouTube API key deleted', 'success');
  } catch (err) {
    showNotification('Failed to delete API key: ' + err.message, 'error');
  }
}

async function loadYouTubeApiQuota() {
  try {
    const quota = await api.get('/api/youtube-api/quota');
    displayQuotaStatus(quota);
  } catch (err) {
    console.error('Failed to load YouTube API quota:', err);
  }
}

function displayQuotaStatus(quota) {
  const statusDiv = document.getElementById('youtube-api-quota-status');
  const percentUsed = (quota.used / quota.limit * 100).toFixed(1);
  const resetTime = new Date(quota.resetTime).toLocaleString();
  
  let barColor = 'var(--success)';
  if (percentUsed > 80) barColor = 'var(--error)';
  else if (percentUsed > 50) barColor = 'var(--warning)';
  
  statusDiv.innerHTML = `
    <div style="padding: 1rem; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
      <p style="margin-bottom: 0.5rem;"><strong>API Quota:</strong> ${quota.used.toLocaleString()} / ${quota.limit.toLocaleString()} units (${percentUsed}%)</p>
      <div style="width: 100%; height: 8px; background: var(--background); border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem;">
        <div style="width: ${percentUsed}%; height: 100%; background: ${barColor}; transition: all 0.3s ease;"></div>
      </div>
      <small style="color: var(--text-muted);">
        Remaining: ${quota.remaining.toLocaleString()} units • Resets: ${resetTime}
      </small>
      ${quota.remaining < 100 ? '<br><small style="color: var(--error);">⚠️ Low quota - will fallback to yt-dlp soon</small>' : ''}
    </div>
  `;
}

async function loadConfigPage() {
  // Check for API key and load quota if present
  try {
    const keyStatus = await api.get('/api/youtube-api/key');
    const quotaStatusDiv = document.getElementById('youtube-api-quota-status');
    const apiKeyInput = document.getElementById('youtube-api-key');
    
    if (keyStatus.hasKey) {
      // Has key - show placeholder and load quota
      apiKeyInput.placeholder = `API key saved (${keyStatus.keyLength} characters)`;
      await loadYouTubeApiQuota();
    } else {
      // No key - show default placeholder and helper text
      apiKeyInput.placeholder = 'Enter your YouTube Data API v3 key';
      if (quotaStatusDiv) {
        quotaStatusDiv.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Add an API key above to see quota information</p>';
      }
    }
  } catch (err) {
    console.error('Failed to load API key status:', err);
    document.getElementById('youtube-api-key').placeholder = 'Enter your YouTube Data API v3 key';
  }
  
  // Auto-load cookies if they exist
  try {
    const cookies = await api.get('/api/cookies');
    if (cookies.content) {
      document.getElementById('cookies-content').value = cookies.content;
    }
  } catch (err) {
    // No cookies file exists yet, that's fine
    console.debug('No cookies file found (this is normal for new installs)');
  }
  
  loadCookies();
  loadSchedulerStatus();
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

async function viewPlaylist(playlistId) {
  const modal = document.getElementById('playlist-modal');
  const modalBody = document.getElementById('playlist-modal-body');
  
  modalBody.innerHTML = '<p class="loading">Loading playlist videos...</p>';
  modal.style.display = 'flex';
  
  try {
    const response = await api.get(`/api/playlists/${playlistId}/videos`);
    const playlist = response.playlist;
    const videos = response.videos;
    
    document.getElementById('modal-playlist-title').textContent = playlist.playlist_title || 'Playlist';
    
    if (videos.length === 0) {
      modalBody.innerHTML = '<p class="empty-state">No videos in this playlist</p>';
      return;
    }
    
    modalBody.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          ${videos.map(v => `
            <tr onclick="viewVideo('${v.video_id}')" style="cursor: pointer;">
              <td>${escapeHtml(v.video_title)}</td>
              <td>
                ${v.download_status === 'completed' ? '<span class="status-badge status-completed">✓ Downloaded</span>' : 
                  v.download_status === 'pending' ? '<span class="status-badge status-pending">Pending</span>' :
                  v.download_status === 'downloading' ? '<span class="status-badge status-downloading">Downloading</span>' :
                  v.download_status === 'failed' ? '<span class="status-badge status-failed">✗ Failed</span>' :
                  '<span style="color: var(--text-muted);">—</span>'}
              </td>
              <td>${v.file_size ? formatFileSize(v.file_size) : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="button-group" style="margin-top: 1rem; justify-content: flex-end;">
        <button class="btn btn-danger" onclick="deleteAllPlaylistVideos(${playlistId})">Delete All Videos</button>
      </div>
    `;
  } catch (err) {
    showNotification('Failed to load playlist: ' + err.message, 'error');
  }
}

async function deleteAllPlaylistVideos(playlistId) {
  if (!confirm('Delete ALL videos in this playlist? This will permanently delete all files from disk, remove them from the database, and delete the playlist folder.')) return;
  
  try {
    const result = await api.delete(`/api/playlists/${playlistId}/videos`);
    showNotification(result.message, 'success');
    closePlaylistModal();
    loadHistory();
    loadStats();
    // Refresh channel view if it's open
    const channelModal = document.getElementById('channel-modal');
    if (channelModal.style.display === 'flex') {
      const channelId = result.channel_id;
      if (channelId) viewChannel(channelId);
    }
  } catch (err) {
    showNotification('Failed to delete videos: ' + err.message, 'error');
  }
}

function closePlaylistModal() {
  document.getElementById('playlist-modal').style.display = 'none';
}

function showAddProfileModal() {
  document.getElementById('add-profile-modal').style.display = 'flex';
  document.getElementById('profile-name').focus();
}

function closeAddProfileModal() {
  document.getElementById('add-profile-modal').style.display = 'none';
  document.getElementById('add-profile-form').reset();
}

function applyPreset() {
  const preset = document.getElementById('preset-select').value;
  
  if (preset === 'plex-youtube') {
    document.getElementById('profile-name').value = 'Plex - YouTube-Agent';
    document.getElementById('profile-output-template').value = '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';
    document.getElementById('profile-format').value = 'bv*[height=1080][ext=mp4]+(258/256/140) / best[height=1080] / b';
    document.getElementById('profile-merge-format').value = 'mp4';
    document.getElementById('profile-additional-args').value = '-v --dateafter 20081004 --write-info-json --windows-filenames';
    showNotification('Plex preset applied', 'success');
  }
}

async function handleAddProfile(e) {
  e.preventDefault();
  
  const profileData = {
    name: document.getElementById('profile-name').value.trim(),
    output_template: document.getElementById('profile-output-template').value.trim(),
    format_selection: document.getElementById('profile-format').value.trim() || null,
    merge_output_format: document.getElementById('profile-merge-format').value.trim() || null,
    additional_args: document.getElementById('profile-additional-args').value.trim() || null
  };
  
  try {
    await api.post('/api/profiles', profileData);
    showNotification('Profile created successfully', 'success');
    closeAddProfileModal();
    loadProfilesPage();
  } catch (err) {
    showNotification('Failed to create profile: ' + err.message, 'error');
  }
}

async function deleteProfile(profileId) {
  if (!confirm('Delete this profile? Channels using this profile will revert to custom options.')) return;
  
  try {
    await api.delete(`/api/profiles/${profileId}`);
    showNotification('Profile deleted', 'success');
    loadProfilesPage();
  } catch (err) {
    showNotification('Failed to delete profile: ' + err.message, 'error');
  }
}

async function editProfile(profileId) {
  try {
    const profile = await api.get(`/api/profiles/${profileId}`);
    
    // Populate the edit form
    document.getElementById('edit-profile-id').value = profile.id;
    document.getElementById('edit-profile-name').value = profile.name;
    document.getElementById('edit-profile-output-template').value = profile.output_template;
    document.getElementById('edit-profile-format').value = profile.format_selection || '';
    document.getElementById('edit-profile-merge-format').value = profile.merge_output_format || '';
    document.getElementById('edit-profile-additional-args').value = profile.additional_args || '';
    
    // Show the modal
    document.getElementById('edit-profile-modal').style.display = 'flex';
  } catch (err) {
    showNotification('Failed to load profile: ' + err.message, 'error');
  }
}

function closeEditProfileModal() {
  document.getElementById('edit-profile-modal').style.display = 'none';
  document.getElementById('edit-profile-form').reset();
}

function applyEditPreset() {
  const preset = document.getElementById('edit-preset-select').value;
  if (preset === 'plex-youtube') {
    document.getElementById('edit-profile-name').value = 'Plex - YouTube-Agent';
    document.getElementById('edit-profile-output-template').value = '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';
    document.getElementById('edit-profile-format').value = 'bv*[height=1080][ext=mp4]+(258/256/140) / best[height=1080] / b';
    document.getElementById('edit-profile-merge-format').value = 'mp4';
    document.getElementById('edit-profile-additional-args').value = '-v --dateafter 20081004 --write-info-json --windows-filenames';
    showNotification('Plex preset applied', 'success');
  }
}

async function handleEditProfile(e) {
  e.preventDefault();
  
  const profileId = document.getElementById('edit-profile-id').value;
  const profileData = {
    name: document.getElementById('edit-profile-name').value.trim(),
    output_template: document.getElementById('edit-profile-output-template').value.trim(),
    format_selection: document.getElementById('edit-profile-format').value.trim() || null,
    merge_output_format: document.getElementById('edit-profile-merge-format').value.trim() || null,
    additional_args: document.getElementById('edit-profile-additional-args').value.trim() || null
  };
  
  try {
    await api.put(`/api/profiles/${profileId}`, profileData);
    showNotification('Profile updated successfully', 'success');
    closeEditProfileModal();
    loadProfilesPage();
    loadProfilesIntoDropdowns(); // Refresh dropdowns in case name changed
  } catch (err) {
    showNotification('Failed to update profile: ' + err.message, 'error');
  }
}

async function loadProfilesIntoDropdowns() {
  try {
    const profiles = await api.get('/api/profiles');
    
    // Update add channel profile dropdown
    const addChannelSelect = document.getElementById('profile-select');
    if (addChannelSelect) {
      const currentValue = addChannelSelect.value;
      addChannelSelect.innerHTML = '<option value="">None (use custom options below)</option>' +
        profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      if (currentValue) addChannelSelect.value = currentValue;
    }
    
    // Update all edit channel profile dropdowns (select elements in channel modals only)
    document.querySelectorAll('select[id^="edit-profile-"]').forEach(select => {
      // Skip the edit profile modal selects
      if (select.id === 'edit-preset-select') return;
      
      const currentValue = select.value;
      select.innerHTML = '<option value="">None (use custom options below)</option>' +
        profiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
      if (currentValue) select.value = currentValue;
    });
  } catch (err) {
    console.error('Failed to load profiles:', err);
  }
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

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

function formatDateTime(timestamp) {
  if (!timestamp) return 'Never';
  
  // If timestamp is a number (Unix timestamp in seconds), convert to milliseconds
  let date;
  if (typeof timestamp === 'number') {
    date = new Date(timestamp * 1000);
  } else {
    // If it's a string (ISO date), parse it directly
    date = new Date(timestamp);
  }
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Less than 1 minute ago
  if (diffMins < 1) return 'Just now';
  // Less than 1 hour ago
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  // Less than 24 hours ago
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  // Less than 7 days ago
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  // More than 7 days ago - show date
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatVideoCodec(codec) {
  if (!codec || codec === 'N/A') return 'N/A';
  
  const codecMap = {
    'avc1': 'H.264',
    'avc': 'H.264',
    'h264': 'H.264',
    'hev1': 'H.265/HEVC',
    'hvc1': 'H.265/HEVC',
    'hevc': 'H.265/HEVC',
    'vp9': 'VP9',
    'vp09': 'VP9',
    'vp8': 'VP8',
    'vp08': 'VP8',
    'av01': 'AV1',
    'av1': 'AV1',
    'none': 'None'
  };
  
  // Try to match the beginning of the codec string
  for (const [key, name] of Object.entries(codecMap)) {
    if (codec.toLowerCase().startsWith(key)) {
      return `${name} (${codec})`;
    }
  }
  
  return codec; // Return as-is if unknown
}

function formatAudioCodec(codec) {
  if (!codec || codec === 'N/A') return 'N/A';
  
  const codecMap = {
    'mp4a': 'AAC',
    'aac': 'AAC',
    'opus': 'Opus',
    'vorbis': 'Vorbis',
    'mp3': 'MP3',
    'ac3': 'AC-3',
    'eac3': 'E-AC-3',
    'dts': 'DTS',
    'flac': 'FLAC',
    'none': 'None'
  };
  
  // Try to match the beginning of the codec string
  for (const [key, name] of Object.entries(codecMap)) {
    if (codec.toLowerCase().startsWith(key)) {
      return `${name} (${codec})`;
    }
  }
  
  return codec; // Return as-is if unknown
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
