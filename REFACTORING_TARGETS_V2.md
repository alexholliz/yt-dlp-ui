# Code Refactoring Targets V2 - yt-dlp-ui

## Overview

Second round analysis after completing initial refactoring efforts. This document identifies **8 new patterns** for refactoring with estimated **225 lines** of savings potential.

**Analysis Date:** 2026-02-02  
**Previous Refactoring Completed:** 246 lines + quality improvements  
**New Potential Savings:** ~225 lines (~8% of remaining codebase)

---

## Completed Refactorings (Phase 1)

✅ **Delete Modal Template** (139 lines)  
✅ **Database Migration Helper** (107 lines)  
✅ **API Error Handler Wrapper** (11 functions)  
✅ **Modal Control Utilities** (8 functions)

---

## Priority Rankings (Phase 2)

| Rank | Pattern | Instances | Lines Saved | Priority | Complexity |
|------|---------|-----------|-------------|----------|------------|
| 1 | Table Rendering with Empty State | 8 | **40 lines** | 🔴 HIGH | Low |
| 2 | API Route Error Handling | 15+ | **35 lines** | 🔴 HIGH | Medium |
| 3 | Modal Background Click Handlers | 6 | **30 lines** | 🔴 HIGH | Low |
| 4 | Edit Form Population | 4 | **30 lines** | 🟠 MEDIUM | Medium |
| 5 | Form Field Extraction | 15+ | **25 lines** | 🔴 HIGH | Medium |
| 6 | Pagination Button States | 6 | **20 lines** | 🔴 HIGH | Low |
| 7 | Notification Error Wrappers | 12+ | **20 lines** | 🟡 MEDIUM | Low |
| 8 | Database Batch Migrations | 8+ | **25 lines** | 🟢 LOW | High |

---

## 🔴 HIGH PRIORITY

### 1. Table Rendering with Empty State (40 lines potential)

**Pattern:** Identical empty state check + `.map()` + `.join('')` pattern repeated 8 times

**Current Code (lines 269-272, 333-336 in app.js):**
```javascript
// History table
tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No downloads yet</td></tr>';

// Profiles table
tbody.innerHTML = profiles.length === 0 ? 
  '<tr><td colspan="4" class="empty-state">No profiles created yet</td></tr>' :
  profiles.map(p => `<tr>...</tr>`).join('');

// Repeated for: history, queue, channels, playlists, profiles, videos, etc.
```

**Proposed Refactor:**
```javascript
// Generic table renderer with empty state handling
function renderTable(tbody, items, columnCount, emptyMsg, renderRow) {
  tbody.innerHTML = items.length === 0 
    ? `<tr><td colspan="${columnCount}" class="empty-state">${emptyMsg}</td></tr>`
    : items.map(renderRow).join('');
}

// Usage examples:
renderTable(tbody, profiles, 4, 'No profiles created yet', p => `
  <tr>
    <td>${p.name}</td>
    <td>${p.format_selection || 'Default'}</td>
    <td>
      <button onclick="editProfile(${p.id})">Edit</button>
      <button onclick="deleteProfile(${p.id})">Delete</button>
    </td>
  </tr>
`);

renderTable(historyTbody, history, 6, 'No downloads yet', h => `
  <tr>
    <td>${h.title}</td>
    <td>${h.channel_name}</td>
    <td>${h.status}</td>
    <td>${h.downloaded_at}</td>
  </tr>
`);
```

**Tables to Refactor:**
1. History table (loadHistory)
2. Queue table (loadQueue)
3. Channels table (loadChannelsPage)
4. Profiles table (loadProfilesPage)
5. Playlists in channel modal (viewChannel)
6. Videos in playlist modal (viewPlaylist)
7. Video list in queue
8. Stats tables

**Impact:** 
- 8 tables × 5 lines each = 40 lines saved
- Consistent rendering pattern across entire app
- Single place to update empty state styling

**Recommendation:** ⭐⭐⭐⭐⭐ **HIGHEST PRIORITY** - Easy win, high impact, touches core UI

**Files Affected:** `public/js/app.js`

---

### 2. API Route Error Handling (35 lines potential)

**Pattern:** Identical try-catch-res.status(500) in 15+ server routes

**Current Code (lines 76-83, 97-104 in server.js):**
```javascript
app.get('/api/profiles', (req, res) => {
  try {
    const profiles = db.getAllProfiles();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/channels', (req, res) => {
  try {
    const channels = db.getAllChannels();
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Repeated 15+ times
```

**Proposed Refactor:**
```javascript
// Express route wrapper with automatic error handling
const asyncRoute = (handler) => async (req, res) => {
  try {
    const result = await handler(req, res);
    if (result !== undefined) res.json(result);
  } catch (err) {
    logger.error(`Route error [${req.method} ${req.path}]: ${err.message}`);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ error: err.message });
  }
};

// Usage:
app.get('/api/profiles', asyncRoute(async (req) => {
  return db.getAllProfiles();
}));

app.get('/api/channels', asyncRoute(async (req) => {
  return db.getAllChannels();
}));

app.post('/api/channels', asyncRoute(async (req) => {
  const channel = await db.addChannel(req.body);
  return { id: channel.id, message: 'Channel added' };
}));
```

**Routes to Refactor:**
- GET /api/profiles (2 endpoints)
- GET /api/channels (3 endpoints)
- POST /api/channels
- PUT /api/channels/:id
- DELETE /api/channels/:id
- POST /api/playlists/:id/download
- GET /api/stats
- GET /api/history
- GET /api/queue
- ... 15+ total

**Impact:**
- 15 routes × 2-3 lines each = ~35 lines saved
- Consistent error logging across all routes
- Single place to add custom error handling (status codes, sanitization)

**Recommendation:** ⭐⭐⭐⭐ **HIGH PRIORITY** - Backend consistency, easier testing

**Files Affected:** `src/server.js`

---

### 3. Modal Background Click Handlers (30 lines potential)

**Pattern:** Identical click-to-close logic repeated for 6 modals

**Current Code (lines 48-65 in app.js):**
```javascript
document.getElementById('channel-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeChannelModal();
});

document.getElementById('video-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeVideoModal();
});

document.getElementById('add-channel-modal')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeAddChannelModal();
});

// ... repeated 3 more times for playlist, add-profile, edit-profile modals
```

**Proposed Refactor:**
```javascript
// Modal background click setup utility
function setupModalBackgroundClose(modalId, closeFunction) {
  document.getElementById(modalId)?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeFunction();
  });
}

// Bulk setup at page load
const MODAL_CONFIGS = [
  { id: 'channel-modal', close: closeChannelModal },
  { id: 'video-modal', close: closeVideoModal },
  { id: 'add-channel-modal', close: closeAddChannelModal },
  { id: 'playlist-modal', close: closePlaylistModal },
  { id: 'add-profile-modal', close: closeAddProfileModal },
  { id: 'edit-profile-modal', close: closeEditProfileModal }
];

MODAL_CONFIGS.forEach(({ id, close }) => setupModalBackgroundClose(id, close));
```

**Impact:**
- 6 modals × 5 lines = 30 lines reduced to 3 utility lines + 7-line config
- Consistent UX behavior across all modals
- Easy to add new modals to the system

**Recommendation:** ⭐⭐⭐⭐ **HIGH PRIORITY** - Simple, immediate impact, improves UX consistency

**Files Affected:** `public/js/app.js`

---

### 4. Form Field Extraction (25 lines potential)

**Pattern:** Repetitive `.value`, `.checked`, `.trim()` in form handlers

**Current Code (lines 805-825 in app.js - handleAddChannel):**
```javascript
const url = document.getElementById('channel-url').value.trim();
const playlistMode = document.getElementById('playlist-mode').checked;
const flatMode = document.getElementById('flat-mode').checked;
const autoAddPlaylists = document.getElementById('auto-add-playlists').checked;
const ytDlpOptions = document.getElementById('yt-dlp-options').value.trim();
const rescrapeDays = parseInt(document.getElementById('rescrape-days').value);
const profileId = document.getElementById('profile-select').value || null;
const downloadMetadata = document.getElementById('download-metadata').checked;
const embedMetadata = document.getElementById('embed-metadata').checked;
const downloadThumbnail = document.getElementById('download-thumbnail').checked;
// ... 10+ more similar lines
```

**Proposed Refactor:**
```javascript
// Generic form field extractor with type handling
const getFormValues = (fieldMap) => {
  return Object.entries(fieldMap).reduce((acc, [key, config]) => {
    const id = typeof config === 'string' ? config : config.id;
    const el = document.getElementById(id);
    
    if (!el) return acc;
    
    if (el.type === 'checkbox') {
      acc[key] = el.checked;
    } else if (el.type === 'number') {
      acc[key] = parseInt(el.value) || 0;
    } else {
      const value = el.value.trim();
      acc[key] = config.nullable && !value ? null : value;
    }
    
    return acc;
  }, {});
};

// Usage in handleAddChannel:
const formData = getFormValues({
  url: 'channel-url',
  playlistMode: 'playlist-mode',
  flatMode: 'flat-mode',
  autoAddPlaylists: 'auto-add-playlists',
  ytDlpOptions: { id: 'yt-dlp-options', nullable: true },
  rescrapeDays: 'rescrape-days',
  profileId: { id: 'profile-select', nullable: true },
  downloadMetadata: 'download-metadata',
  embedMetadata: 'embed-metadata',
  downloadThumbnail: 'download-thumbnail',
  // ... etc
});

await api.post('/api/channels', {
  url: formData.url,
  playlist_mode: formData.playlistMode ? 'enumerate' : 'flat',
  ...formData
});
```

**Impact:**
- 20+ field extractions → single getFormValues() call
- ~25 lines saved per form handler
- Type-safe extraction with proper null handling
- Applies to: handleAddChannel, handleAddProfile, handleEditProfile, saveChannelSettings

**Recommendation:** ⭐⭐⭐⭐ **HIGH PRIORITY** - Reduces boilerplate, improves maintainability

**Files Affected:** `public/js/app.js`

---

### 5. Pagination Button States (20 lines potential)

**Pattern:** Repetitive `.disabled` assignments for pagination buttons

**Current Code (lines 181-182, 234-235 in app.js):**
```javascript
// History pagination
document.getElementById('history-next').disabled = history.length < pageSize;
document.getElementById('history-prev').disabled = historyPage === 0;

// Queue pagination
document.getElementById('queue-next').disabled = start + pageSize >= allItems.length;
document.getElementById('queue-prev').disabled = queuePage === 0;

// Repeated for multiple paginated views
```

**Proposed Refactor:**
```javascript
// Generic pagination button state updater
function updatePaginationButtons(config) {
  const { prevId, nextId, currentPage, totalItems, pageSize } = config;
  
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  
  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = (currentPage + 1) * pageSize >= totalItems;
}

// Usage:
updatePaginationButtons({
  prevId: 'history-prev',
  nextId: 'history-next',
  currentPage: historyPage,
  totalItems: totalHistoryCount,
  pageSize: 10
});

updatePaginationButtons({
  prevId: 'queue-prev',
  nextId: 'queue-next',
  currentPage: queuePage,
  totalItems: queueItems.length,
  pageSize: 5
});
```

**Impact:**
- 6 pagination controls × 3-4 lines = ~20 lines saved
- Consistent pagination behavior
- Less error-prone (centralized logic)

**Recommendation:** ⭐⭐⭐⭐ **HIGH PRIORITY** - Simple, prevents bugs

**Files Affected:** `public/js/app.js`

---

## 🟠 MEDIUM PRIORITY

### 6. Edit Form Population (30 lines potential)

**Pattern:** Repetitive `.value`, `.checked` assignments when loading edit forms

**Current Code (lines 692-710 in app.js):**
```javascript
// Populate edit form for channel
document.getElementById(`edit-profile-${channelId}`).value = channel.profile_id || '';
document.getElementById(`edit-playlist-mode-${channelId}`).checked = channel.playlist_mode === 'enumerate';
document.getElementById(`edit-flat-mode-${channelId}`).checked = channel.flat_mode === 1;
document.getElementById(`edit-auto-add-${channelId}`).checked = channel.auto_add_new_playlists === 1;
document.getElementById(`edit-yt-dlp-options-${channelId}`).value = channel.yt_dlp_options || '';
document.getElementById(`edit-rescrape-days-${channelId}`).value = channel.rescrape_interval_days;
// ... 15+ more assignments
```

**Proposed Refactor:**
```javascript
// Generic form populator from data object
function populateForm(data, fieldMap, suffix = '') {
  Object.entries(fieldMap).forEach(([dataKey, config]) => {
    const id = typeof config === 'string' ? config : config.id;
    const el = document.getElementById(id + suffix);
    
    if (!el) return;
    
    const value = data[dataKey];
    if (el.type === 'checkbox') {
      el.checked = Boolean(value === 1 || value === true || value === 'enumerate');
    } else {
      el.value = value ?? '';
    }
  });
}

// Usage:
populateForm(channel, {
  profile_id: 'edit-profile',
  playlist_mode: 'edit-playlist-mode',
  flat_mode: 'edit-flat-mode',
  auto_add_new_playlists: 'edit-auto-add',
  yt_dlp_options: 'edit-yt-dlp-options',
  rescrape_interval_days: 'edit-rescrape-days',
  // ... etc
}, `-${channelId}`);
```

**Impact:**
- 4 edit forms × 7-8 lines each = ~30 lines saved
- Type-safe population
- Applies to: editProfile, saveChannelSettings

**Recommendation:** ⭐⭐⭐ **MEDIUM PRIORITY** - Moderate impact, pairs well with form extraction

**Files Affected:** `public/js/app.js`

---

### 7. Notification + Error Logging (20 lines potential)

**Pattern:** Data loading functions with paired error logging and notifications

**Current Code (lines 322-324, 348-350 in app.js):**
```javascript
async function loadChannelsPage() {
  try {
    const channels = await api.get('/api/channels');
    // ... render logic
  } catch (err) {
    console.error('Failed to load channels:', err);
    showNotification('Failed to load channels: ' + err.message, 'error');
  }
}

async function loadProfilesPage() {
  try {
    const profiles = await api.get('/api/profiles');
    // ... render logic
  } catch (err) {
    console.error('Failed to load profiles:', err);
    showNotification('Failed to load profiles: ' + err.message, 'error');
  }
}

// Repeated 12+ times for different data loading functions
```

**Proposed Refactor:**
Extend existing `api.withNotification()` to handle data loading patterns:

```javascript
// Enhanced version of existing api.withNotification()
api.loadData = async function(url, renderCallback, errorPrefix = 'Failed to load data') {
  try {
    const data = await this.get(url);
    await renderCallback(data);
    return data;
  } catch (err) {
    console.error(`${errorPrefix}:`, err);
    showNotification(`${errorPrefix}: ${err.message}`, 'error');
    throw err;
  }
};

// Usage:
async function loadChannelsPage() {
  await api.loadData('/api/channels', (channels) => {
    // render logic
  }, 'Failed to load channels');
}

async function loadProfilesPage() {
  await api.loadData('/api/profiles', (profiles) => {
    // render logic
  }, 'Failed to load profiles');
}
```

**Impact:**
- 12 data loaders × 1-2 lines = ~20 lines saved
- Consistent error handling pattern
- Already partially implemented - just needs extension

**Recommendation:** ⭐⭐⭐ **MEDIUM PRIORITY** - Extends existing refactor, good ROI

**Files Affected:** `public/js/app.js`

---

## 🟢 LOW PRIORITY

### 8. Database Batch Migrations (25 lines potential)

**Pattern:** Multiple `addColumnIfMissing()` calls could be batched

**Current Code (lines 172-196 in database.js):**
```javascript
this.addColumnIfMissing('profiles', 'verbose', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('profiles', 'filename_format', "TEXT DEFAULT '--no-restrict-filenames'");
this.addColumnIfMissing('playlists', 'video_count', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('videos', 'file_size', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('videos', 'error_message', 'TEXT');
// ... 20+ more calls
```

**Proposed Refactor:**
```javascript
// Batch column additions to reduce function call overhead
addColumnsIfMissing(table, columns) {
  const result = this.db.exec(`PRAGMA table_info(${table})`);
  const existingColumns = result[0]?.values.map(row => row[1]) || [];
  
  let modified = false;
  columns.forEach(({ name, definition }) => {
    if (!existingColumns.includes(name)) {
      this.db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      console.log(`Migration: Added ${name} column to ${table} table`);
      modified = true;
    }
  });
  
  if (modified) this.save();
}

// Usage:
this.addColumnsIfMissing('videos', [
  { name: 'file_size', definition: 'INTEGER DEFAULT 0' },
  { name: 'error_message', definition: 'TEXT' },
  { name: 'resolution', definition: 'TEXT' },
  { name: 'fps', definition: 'INTEGER' },
  { name: 'vcodec', definition: 'TEXT' },
  { name: 'acodec', definition: 'TEXT' }
]);
```

**Impact:**
- ~25 lines saved through batching
- Fewer PRAGMA calls (performance improvement)
- More complex than current approach

**Recommendation:** ⭐⭐ **LOW PRIORITY** - Current solution works well, marginal benefit

**Files Affected:** `src/database.js`

---

## Implementation Recommendations

### **Phase 2A: Quick Wins** (Est: 2-3 hours)
1. ⬜ Table Rendering with Empty State - 1 hour, 40 lines, highest impact
2. ⬜ Modal Background Click Handlers - 20 min, 30 lines
3. ⬜ Pagination Button States - 20 min, 20 lines
4. ⬜ Form Field Extraction - 45 min, 25 lines

**Total: ~2 hours, 115 lines saved**

### **Phase 2B: Backend Improvements** (Est: 1-2 hours)
5. ⬜ API Route Error Handling - 1-1.5 hours, 35 lines
6. ⬜ Notification + Error Logging - 30 min, 20 lines

**Total: ~1.5 hours, 55 lines saved**

### **Phase 2C: Form Handling** (Est: 1 hour)
7. ⬜ Edit Form Population - 1 hour, 30 lines

**Total: ~1 hour, 30 lines saved**

### **Phase 2D: Nice-to-Have** (Est: TBD)
8. ⬜ Database Batch Migrations - Defer, current solution adequate

---

## Grand Total Across Both Phases

**Phase 1 (Completed):**
- Delete Modal Template: 139 lines
- Database Migration Helper: 107 lines
- API Error Handler: 11 functions (quality improvement)
- Modal Control Utilities: 8 functions (infrastructure)
- **Total: 246 lines + quality improvements**

**Phase 2 (Planned):**
- Table Rendering: 40 lines
- API Route Errors: 35 lines
- Modal Background Clicks: 30 lines
- Edit Form Population: 30 lines
- Form Field Extraction: 25 lines
- Pagination Buttons: 20 lines
- Notification Logging: 20 lines
- **Total: 200-225 lines**

**Combined Total: 446-471 lines saved (~15-16% of codebase)**

---

## When to Refactor

**DO refactor when:**
- Adding 4th+ instance of same pattern
- Bug occurs due to inconsistent implementation
- Maintenance becomes difficult due to repetition
- Pattern spans multiple files/components

**DON'T refactor when:**
- Pattern occurs only 2-3 times
- Abstraction would be more complex than duplication
- Pattern is rapidly changing (wait for stabilization)
- Team is unfamiliar with abstraction patterns

---

## Notes for Future Sessions

- Table rendering is the single biggest opportunity (40 lines)
- Backend route handling would improve testability significantly
- Form handling refactors pair well together (extraction + population)
- Consider creating a utils.js file for shared utilities if this grows further
- Modal patterns are now very consistent - good foundation established
