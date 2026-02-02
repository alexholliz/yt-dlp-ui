# Code Refactoring Targets - yt-dlp-ui

## Overview

This document identifies duplicate code patterns in the codebase and prioritizes refactoring opportunities. Organized by impact (instances × duplicate lines = total potential savings).

**Last Updated:** 2026-02-01  
**Total Potential Savings:** ~286 lines (~8-10% of codebase)  
**Completed Savings**: 246 lines + infrastructure improvements  
**Remaining Potential**: ~8 lines (table empty state helper)

---

## Priority Rankings

| Rank | Pattern | Instances | Dup Lines | Total Savings | Priority | Status |
|------|---------|-----------|-----------|---------------|----------|--------|
| 1 | Database Migrations | 13 | 7 | **91 lines** | 🔴 CRITICAL | ✅ **COMPLETED** |
| 2 | Modal HTML Structure | 7 | 18 | **126 lines** | 🟠 HIGH | ❌ Not Started |
| 3 | API Error Handling | 35 | 2 | **70 lines** | 🟠 HIGH | ✅ **COMPLETED** |
| 4 | Form Handlers | 3 | 25 | **75 lines** | 🟡 MEDIUM | ❌ Not Started |
| 5 | Modal Control Functions | 14 | 3 | **42 lines** | 🟡 MEDIUM | ✅ **COMPLETED** |
| 6 | Table Rendering | 4 | 2 | **8 lines** | 🟢 LOW | ❌ Not Started |
| 7 | Delete Modals | 3 | - | **139 lines** | - | ✅ **COMPLETED** |

---

## 🔴 CRITICAL PRIORITY

### 1. Database Migrations ✅ COMPLETED (107 lines saved)

**Status**: Completed 2026-02-01  
**Actual Savings**: 107 lines (149 deleted - 42 added)  

**Implementation**:
- Added `addColumnIfMissing(table, column, definition)` helper method to DB class
- Replaced all 22 migration blocks with single-line calls
- Reduced migration code from ~160 lines to 23 lines
- Tested and verified with fresh database (19 migrations ran successfully)
- Maintains backward compatibility and idempotency

**Original Pattern (was repeated 13 times in database.js):**
```javascript
try {
  const result = this.db.exec("PRAGMA table_info(profiles)");
  const columns = result[0]?.values.map(row => row[1]) || [];
  if (!columns.includes('verbose')) {
    this.db.run("ALTER TABLE profiles ADD COLUMN verbose INTEGER DEFAULT 0");
    this.save();
    console.log('Migration: Added verbose column to profiles table');
  }
} catch (err) {
  console.log('Migration check skipped or already applied');
}
```

**Proposed Refactor:**
```javascript
// New utility in database.js
addColumnIfMissing(table, column, definition) {
  try {
    const result = this.db.exec(`PRAGMA table_info(${table})`);
    const columns = result[0]?.values.map(row => row[1]) || [];
    if (!columns.includes(column)) {
      this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      this.save();
      console.log(`Migration: Added ${column} column to ${table} table`);
      return true;
    }
    return false;
  } catch (err) {
    console.log(`Migration check for ${table}.${column} skipped or already applied`);
    return false;
  }
}

// Usage - all 13 migrations become:
this.addColumnIfMissing('profiles', 'verbose', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('profiles', 'filename_format', 'TEXT DEFAULT \'--no-restrict-filenames\'');
this.addColumnIfMissing('videos', 'resolution', 'TEXT');
// ... etc
```

**Impact:** 
- 13 migrations × 7 lines = 91 lines reduced to 13 lines (1 line each)
- **Savings: 78 lines**
- Easier to add new migrations in the future
- Consistent error handling across all migrations

**Files Affected:** `src/database.js` (lines 136-250)

---

## 🟠 HIGH PRIORITY

### 2. Modal HTML Structure (126 lines potential savings)

**Current Pattern (7 modals in index.html):**
```html
<div id="channel-modal" class="modal" style="display: none;">
  <div class="modal-content">
    <div class="modal-header">
      <h2>Title</h2>
      <button class="close-btn" onclick="closeChannelModal()">&times;</button>
    </div>
    <div class="modal-body">
      <!-- Unique content here -->
    </div>
  </div>
</div>
```

**Modals:**
1. channel-modal (~120 lines)
2. video-modal (~50 lines)
3. playlist-modal (~40 lines)
4. add-channel-modal (~200 lines)
5. add-profile-modal (~80 lines)
6. edit-profile-modal (~80 lines)
7. delete-confirmation-modal (~30 lines) ✅ **Already generic**

**Proposed Refactor:**
```javascript
// Option 1: JavaScript-based modal rendering
function createModal(id, title, bodyContent, options = {}) {
  const modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content" style="${options.maxWidth ? 'max-width: ' + options.maxWidth : ''}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="close-btn" onclick="closeModal('${id}')">&times;</button>
      </div>
      <div class="modal-body">${bodyContent}</div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Option 2: Template literal factory
const createModalHTML = (id, title, closeFunc, bodyHTML, maxWidth = '800px') => `
  <div id="${id}" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: ${maxWidth};">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="close-btn" onclick="${closeFunc}()">&times;</button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
    </div>
  </div>
`;
```

**Challenges:**
- Large forms (Add Channel = 200 lines) make JavaScript rendering verbose
- Static HTML is easier to maintain than JavaScript strings
- Current approach is readable and doesn't cause performance issues

**Recommendation:** 
- **Defer this refactor** - HTML duplication is acceptable for readability
- Focus on JavaScript function duplication instead
- Consider only if modal count exceeds 10-12

**Impact:** ⭐⭐ MEDIUM (readability gain vs. complexity trade-off)

---

### 3. API Error Handling (70 lines potential savings)

**Current Pattern (~35 instances in app.js):**
```javascript
async function someAction() {
  try {
    await api.delete('/api/endpoint');
    showNotification('Success message', 'success');
    // Refresh UI
    loadSomething();
  } catch (err) {
    showNotification('Failed to do thing: ' + err.message, 'error');
  }
}
```

**Proposed Refactor:**
```javascript
// Add to api object (lines 1-22)
const api = {
  // ... existing methods ...
  
  async withNotification(apiCall, successMsg, errorPrefix = 'Operation failed') {
    try {
      const result = await apiCall();
      showNotification(successMsg, 'success');
      return result;
    } catch (err) {
      showNotification(`${errorPrefix}: ${err.message}`, 'error');
      throw err; // Re-throw for caller to handle if needed
    }
  }
};

// Usage:
async function deleteChannel(id) {
  await api.withNotification(
    () => api.delete(`/api/channels/${id}`),
    'Channel deleted successfully',
    'Failed to delete channel'
  );
  closeChannelModal();
  loadChannelsPage();
}
```

**Impact:** 
- 11 functions refactored to cleaner pattern
- More concise function bodies (try-catch eliminated)
- Consistent error message format
- **Code quality**: Improved maintainability and readability
- Net line change: -1 line (but significant structural improvement)

**Note**: Not all 35 instances were suitable for refactoring. Functions with complex error handling (finally blocks, conditional logic) retained original pattern for clarity.

**Files Affected:** `public/js/app.js` (throughout)

---

## 🟡 MEDIUM PRIORITY

### 4. Form Handlers (75 lines potential savings)

**Current Pattern (3 main handlers):**
```javascript
async function handleAddChannel() {
  const url = document.getElementById('channel-url').value.trim();
  if (!url) { showNotification('URL required', 'error'); return; }
  
  const playlistMode = document.querySelector('input[name="playlist-mode"]:checked').value;
  const flatMode = document.getElementById('flat-mode').checked;
  // ... 20+ more fields ...
  
  try {
    await api.post('/api/channels', { url, playlistMode, ... });
    showNotification('Channel added', 'success');
    closeAddChannelModal();
    loadChannelsPage();
  } catch (err) {
    showNotification('Failed: ' + err.message, 'error');
  }
}
```

**Handlers:**
1. handleAddChannel() - ~60 lines (collects 20+ fields)
2. handleAddProfile() - ~25 lines (collects 6 fields)
3. handleEditProfile() - ~30 lines (collects 6 fields)

**Common Elements:**
- Get form field values
- Validate required fields
- Make API call (POST or PUT)
- Show success notification
- Close modal
- Refresh UI

**Proposed Refactor:**
```javascript
class FormHandler {
  constructor(formId, apiEndpoint, options = {}) {
    this.formId = formId;
    this.endpoint = apiEndpoint;
    this.method = options.method || 'POST';
    this.successMsg = options.successMsg;
    this.onSuccess = options.onSuccess;
  }
  
  async submit() {
    const formData = this.collectFormData();
    if (!this.validate(formData)) return;
    
    try {
      await api[this.method.toLowerCase()](this.endpoint, formData);
      showNotification(this.successMsg, 'success');
      if (this.onSuccess) this.onSuccess();
    } catch (err) {
      showNotification(`Failed: ${err.message}`, 'error');
    }
  }
}
```

**Challenges:**
- Forms have very different field structures
- Complex validation rules (SponsorBlock categories, custom args parsing)
- Field collection is custom per form

**Recommendation:** ⭐⭐ MEDIUM - Benefit exists but significant refactor complexity

---

### 5. Modal Control Functions ✅ COMPLETED (Infrastructure improvement)

**Status**: Completed 2026-02-02  
**Actual Result**: Added reusable utilities, refactored 6 modal functions

**Implementation**:
- Created generic `openModal(modalId, onOpen)` and `closeModal(modalId, onClose)` utilities
- Refactored 6 modal control functions to use utilities:
  - showAddChannelModal → openModal with focus callback
  - closeAddChannelModal → closeModal with form reset callback
  - closeChannelModal → closeModal
  - closeVideoModal → closeModal
  - closePlaylistModal → closeModal
  - showAddProfileModal → openModal with focus callback
  - closeAddProfileModal → closeModal with form reset callback
  - closeEditProfileModal → closeModal with form reset callback
- Utilities support optional callbacks for custom behavior (focus, reset, etc.)
- Infrastructure in place for future modals

**Already partially addressed by Delete Modal refactor**, but 6 other modals still use individual functions.

**Original Pattern:**
```javascript
function closeChannelModal() {
  document.getElementById('channel-modal').style.display = 'none';
}

function showVideoModal(videoId) {
  loadVideoDetails(videoId);
  document.getElementById('video-modal').style.display = 'flex';
}

// × 6 modals = 12 functions
```

**Proposed Refactor:**
```javascript
// Generic modal utilities
function openModal(modalId, onOpen = null) {
  if (onOpen) onOpen();
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId, onClose = null) {
  document.getElementById(modalId).style.display = 'none';
  if (onClose) onClose();
}

// Usage:
function showVideoModal(videoId) {
  openModal('video-modal', () => loadVideoDetails(videoId));
}
```

**Impact:** 
- 8 modal functions refactored to use 2 generic utilities
- Consistent modal open/close pattern across codebase
- Infrastructure for future modals (no need to write custom functions)
- **Code quality**: Improved maintainability and extensibility
- Net line change: +11 lines (utilities add value for future use)

**Note**: Functions like viewChannel() and viewPlaylist() with complex opening logic kept original pattern.

---

## 🟢 LOW PRIORITY

### 6. Table Rendering (8 lines potential savings)

**Current Pattern (4 instances):**
```javascript
tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No items found</td></tr>';
// Repeated with different colspan values: 4, 5, 6, 7
```

**Proposed Refactor:**
```javascript
function renderEmptyState(tbody, colspan, message = 'No items found') {
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${message}</td></tr>`;
}
```

**Impact:** Minimal savings but improves consistency

**Recommendation:** ⭐ LOW - Nice-to-have, low ROI

---

## ✅ ALREADY COMPLETED

### 7. Delete Modals (139 lines saved)

**Before:** 3 separate modals with duplicate HTML and functions  
**After:** 1 generic modal with configuration-based system  
**Implementation:** See `DELETE_MODAL_TEMPLATE.md`  
**Status:** ✅ Completed 2026-02-01

---

## Implementation Recommendations

### **Phase 1: Quick Wins** (Est: 1-2 hours)
1. ✅ Delete Modal Template - DONE (139 lines saved)
2. ✅ Database Migration Helper - DONE (107 lines saved)
3. ✅ API Error Handler - DONE (quality improvement, 11 functions refactored)
4. ✅ Modal Control Utilities - DONE (infrastructure improvement, 8 functions refactored)
5. ⬜ Table Empty State Utility - 10 min, low impact

### **Phase 2: Structural Improvements** (Est: 2-4 hours)
5. ⬜ API Error Handling Wrapper - 1 hour, high impact but touches many files
6. ⬜ Form Handler Abstraction - 2-3 hours, complex but valuable

### **Phase 3: Nice-to-Have** (Est: TBD)
7. ⬜ Modal HTML Template System - Defer until modal count >10

---

## When to Refactor

**DO refactor when:**
- Adding 4th+ instance of the same pattern
- Pattern causes bugs (inconsistent behavior)
- Maintenance burden is high (change requires updating N places)
- Clear abstraction exists that doesn't add complexity

**DON'T refactor when:**
- Only 2-3 instances exist
- Instances are genuinely different (not actually duplicate)
- Abstraction would be more complex than duplication
- Current code is readable and maintainable

---

## Code Patterns Analysis

### 1. Database Migrations (13 instances)

**Location:** `src/database.js` lines 136-250

**Instances:**
1. profiles.verbose
2. profiles.filename_format
3. videos.resolution
4. videos.fps
5. videos.vcodec
6. videos.acodec
7. channels.profile_id
8. channels.sponsorblock_enabled
9. channels.sponsorblock_mode
10. channels.sponsorblock_categories
11. channels.enabled
12. channels.download_metadata
13. channels.embed_metadata
14. channels.download_thumbnail
15. channels.embed_thumbnail
16. channels.download_subtitles
17. channels.embed_subtitles
18. channels.subtitle_languages
19. channels.auto_subtitles

**Each Migration:**
```javascript
try {
  const result = this.db.exec("PRAGMA table_info(TABLE)");
  const columns = result[0]?.values.map(row => row[1]) || [];
  if (!columns.includes('COLUMN')) {
    this.db.run("ALTER TABLE TABLE ADD COLUMN COLUMN DEFINITION");
    this.save();
    console.log('Migration: Added COLUMN column to TABLE table');
  }
} catch (err) {
  console.log('Migration check for COLUMN skipped or already applied');
}
```

**Proposed Helper:**
```javascript
addColumnIfMissing(table, column, definition) {
  try {
    const result = this.db.exec(`PRAGMA table_info(${table})`);
    const columns = result[0]?.values.map(row => row[1]) || [];
    if (!columns.includes(column)) {
      this.db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      this.save();
      console.log(`Migration: Added ${column} column to ${table} table`);
      return true;
    }
    return false;
  } catch (err) {
    console.log(`Migration check for ${table}.${column} skipped or already applied`);
    return false;
  }
}
```

**Refactored Usage:**
```javascript
// All migrations in initTables()
this.addColumnIfMissing('profiles', 'verbose', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('profiles', 'filename_format', 'TEXT DEFAULT \'--no-restrict-filenames\'');
this.addColumnIfMissing('videos', 'resolution', 'TEXT');
this.addColumnIfMissing('videos', 'fps', 'INTEGER');
this.addColumnIfMissing('videos', 'vcodec', 'TEXT');
this.addColumnIfMissing('videos', 'acodec', 'TEXT');
this.addColumnIfMissing('channels', 'profile_id', 'INTEGER');
this.addColumnIfMissing('channels', 'sponsorblock_enabled', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('channels', 'sponsorblock_mode', 'TEXT DEFAULT \'mark\'');
this.addColumnIfMissing('channels', 'sponsorblock_categories', 'TEXT');
this.addColumnIfMissing('channels', 'enabled', 'INTEGER DEFAULT 1');
this.addColumnIfMissing('channels', 'download_metadata', 'INTEGER DEFAULT 1');
this.addColumnIfMissing('channels', 'embed_metadata', 'INTEGER DEFAULT 1');
this.addColumnIfMissing('channels', 'download_thumbnail', 'INTEGER DEFAULT 1');
this.addColumnIfMissing('channels', 'embed_thumbnail', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('channels', 'download_subtitles', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('channels', 'embed_subtitles', 'INTEGER DEFAULT 0');
this.addColumnIfMissing('channels', 'subtitle_languages', 'TEXT DEFAULT \'en\'');
this.addColumnIfMissing('channels', 'auto_subtitles', 'INTEGER DEFAULT 0');
```

**Benefits:**
- 133 lines → 19 lines (114 line reduction)
- Easier to scan migrations
- Consistent error handling
- Single source of truth for migration logic

**Risks:**
- None - purely mechanical refactor
- Maintains exact same behavior

---

### 3. API Error Handling (70 lines potential savings)

**Current Pattern (~35 instances in app.js):**
```javascript
async function deleteProfile(profileId) {
  if (!confirm('Delete this profile?')) return;
  try {
    await api.delete(`/api/profiles/${profileId}`);
    showNotification('Profile deleted', 'success');
    loadProfiles();
  } catch (err) {
    showNotification('Failed to delete profile: ' + err.message, 'error');
  }
}
```

**Proposed Refactor:**
```javascript
// Extend api object
const api = {
  // ... existing get/post/put/delete ...
  
  async withNotification(apiCall, successMsg, options = {}) {
    try {
      const result = await apiCall();
      if (successMsg) showNotification(successMsg, 'success');
      if (options.onSuccess) options.onSuccess(result);
      return result;
    } catch (err) {
      const errorMsg = options.errorPrefix 
        ? `${options.errorPrefix}: ${err.message}`
        : err.message;
      showNotification(errorMsg, 'error');
      if (options.onError) options.onError(err);
      throw err;
    }
  }
};

// Usage:
async function deleteProfile(profileId) {
  if (!confirm('Delete this profile?')) return;
  await api.withNotification(
    () => api.delete(`/api/profiles/${profileId}`),
    'Profile deleted',
    { 
      errorPrefix: 'Failed to delete profile',
      onSuccess: loadProfiles
    }
  );
}
```

**Impact:**
- Reduces 5-6 lines per function to 2-3 lines
- ~35 instances × 2 lines = 70 line reduction
- Consistent error message format
- Optional callbacks for custom behavior

**Benefits:**
- Cleaner function bodies
- Easier to add new actions
- Centralized notification logic

**Risks:**
- Slightly less explicit (callback-based)
- Need to ensure all callers handle thrown errors correctly

---

## 🟡 MEDIUM-LOW PRIORITY

### 5. Modal Control Functions (42 lines)

**Current Pattern (12 functions):**
```javascript
function closeChannelModal() {
  document.getElementById('channel-modal').style.display = 'none';
}

function showAddChannelModal() {
  document.getElementById('add-channel-modal').style.display = 'flex';
  document.getElementById('channel-url').focus();
}
```

**Proposed Refactor:**
```javascript
function openModal(modalId, onOpen = null) {
  if (onOpen) onOpen();
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId, onClose = null) {
  document.getElementById(modalId).style.display = 'none';
  if (onClose) onClose();
}

// Usage:
function showAddChannelModal() {
  openModal('add-channel-modal', () => {
    document.getElementById('channel-url').focus();
  });
}

function closeChannelModal() {
  closeModal('channel-modal');
}
```

**Impact:** 12 functions × 3-4 lines = 42 lines → 2 utility functions + minimal inline logic

---

### 6. Form Handlers (75 lines)

Complex refactor due to:
- Different field structures per form
- Custom validation rules
- SponsorBlock logic
- Profile preset logic

**Recommendation:** Defer until form count >5

---

## 🟢 LOW PRIORITY

### 6. Table Rendering (8 lines)

**Current Pattern:**
```javascript
tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No items</td></tr>';
```

**Proposed Helper:**
```javascript
function renderEmptyState(tbody, colspan, message = 'No items found') {
  tbody.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${message}</td></tr>`;
}
```

**Impact:** Minimal, but improves consistency

---

## Implementation Strategy

### Recommended Sequence:

1. **Database Migration Helper** (30 min)
   - High impact (91 line savings)
   - Zero risk (mechanical refactor)
   - Makes future migrations easier
   
2. **API Error Handling Wrapper** (1 hour)
   - High impact (70 line savings)
   - Improves consistency
   - Moderate complexity (touches many functions)

3. **Modal Control Utilities** (20 min)
   - Moderate impact (42 line savings)
   - Low complexity
   - Already have delete modal pattern

4. **Table Empty State Helper** (10 min)
   - Low impact (8 line savings)
   - Trivial complexity
   - Quick polish

**Total Est. Time:** 2 hours  
**Total Planned:** ~211 lines  
**Actual Completed:** 246 lines + quality/infrastructure improvements (Delete Modal: 139 + Migration Helper: 107 + API Error Handler: quality + Modal Utilities: infrastructure)  
**Remaining Quick Wins:** Table Empty State (8 lines, 10 min)

---

## Future Considerations

**When codebase grows:**
- Monitor modal count (refactor HTML templates if >10 modals)
- Watch for new repetitive patterns
- Re-evaluate form handler abstraction if >5 forms
- Consider component library if complexity increases significantly

**Signs refactoring is needed:**
- Bug fixed in one place but not others (indicates duplication)
- Adding new feature requires updating 5+ places
- Code reviews frequently mention "this is duplicated"

---

## Notes for Future Sessions

- Keep this document updated as refactoring progresses
- Check off completed items and add new patterns discovered
- Re-evaluate priorities as codebase evolves
- Document lessons learned from refactoring attempts

**Last Analysis:** 2026-02-01 (after delete modal refactor)
