# Generic Delete Modal Template

## Overview

The app uses a **single reusable delete modal** (`#delete-confirmation-modal`) for all file deletion operations. This eliminates code duplication and ensures consistent UX across all delete actions.

## How It Works

### HTML (Already in index.html)
One generic modal with dynamic content:
```html
<div id="delete-confirmation-modal" class="modal">
  <!-- Content updated dynamically via JavaScript -->
</div>
```

### JavaScript Pattern

Use the `openDeleteModal(config)` function with a configuration object:

```javascript
function openDeleteModal(config) {
  // config.type - Type of deletion (for tracking)
  // config.id - ID of item to delete
  // config.title - Modal title
  // config.message - Main confirmation message
  // config.description - Secondary description text
  // config.toggleLabel - Label for file deletion toggle
  // config.warning - Warning message text
  // config.confirmButtonText - Text for confirm button
  // config.onConfirm - Async function (receives deleteFiles boolean)
  // config.onClose - Optional cleanup function
}
```

## Adding a New Delete Button

### Example: Delete Download History Entry

**1. Add the button in your HTML/template:**
```javascript
<button class="btn btn-danger" onclick="openDeleteHistoryItemModal(${item.id})">
  Delete
</button>
```

**2. Create the modal opener function:**
```javascript
function openDeleteHistoryItemModal(itemId) {
  openDeleteModal({
    type: 'history-item',  // Identifier for this deletion type
    id: itemId,
    title: 'Delete History Entry',
    message: 'Are you sure you want to delete this history entry?',
    description: 'This will remove the entry from your download history.',
    toggleLabel: 'Also delete the downloaded file',
    warning: '⚠️ Warning: Deleting the file cannot be undone.',
    confirmButtonText: 'Delete Entry',
    onConfirm: async (deleteFiles) => {
      // Make API call with deleteFiles parameter
      await api.delete(`/api/history/${itemId}?deleteFiles=${deleteFiles}`);
      showNotification('History entry deleted', 'success');
    },
    onClose: () => {
      // Optional: Refresh UI, close parent modals, etc.
      loadHistory();
    }
  });
}
```

**3. Implement backend endpoint (if needed):**
```javascript
app.delete('/api/history/:id', (req, res) => {
  const deleteFiles = req.query.deleteFiles === 'true';
  
  // Get item info
  const item = db.getHistoryItem(req.params.id);
  
  // Delete files if requested
  if (deleteFiles && item.file_path && fs.existsSync(item.file_path)) {
    fs.unlinkSync(item.file_path);
    // Delete metadata, thumbnails, etc.
  }
  
  // Always delete from database
  db.db.run('DELETE FROM history WHERE id = ?', [req.params.id]);
  db.save();
  
  res.json({ success: true });
});
```

## Current Implementations

### Delete Channel
```javascript
openDeleteChannelModal(channelId) → 
  API: DELETE /api/channels/:id?deleteFiles=true/false
```

### Delete Video
```javascript
openDeleteVideoModal(videoId) → 
  API: DELETE /api/videos/:id?deleteFiles=true/false
```

### Delete Playlist Videos
```javascript
openDeletePlaylistVideosModal(playlistId) → 
  API: DELETE /api/playlists/:id/videos?deleteFiles=true/false
```

## Benefits

✅ **Single Source of Truth** - One modal, one set of functions  
✅ **Consistent UX** - All delete actions look and behave the same  
✅ **Easy to Extend** - Just call `openDeleteModal()` with config  
✅ **Maintainable** - Changes to modal UI update all delete buttons  
✅ **Type Safe** - JSDoc comments provide intellisense  
✅ **Flexible** - Custom onConfirm/onClose for any deletion logic

## Design Principles

1. **Toggle Default: OFF** - Preserve files by default for safety
2. **Clear Warnings** - Always explain consequences of file deletion
3. **Two Actions** - Database removal (always) + File deletion (optional)
4. **Consistent Messages** - Use "Also delete X from disk" pattern
5. **Archive Sync** - Always update .downloaded archive when deleting videos

## Testing Checklist

When adding a new delete button:
- [ ] Modal opens with correct content
- [ ] Toggle starts unchecked (OFF)
- [ ] Cancel button closes modal without action
- [ ] Confirm with toggle OFF: Removes from DB, preserves files
- [ ] Confirm with toggle ON: Removes from DB + deletes files
- [ ] Success notification shows
- [ ] UI refreshes to show deletion
- [ ] Related data updated (stats, lists, etc.)
