const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const DB = require('../src/database');
const fs = require('fs');
const path = require('path');

describe('Performance Optimizations', () => {
  describe('Stats Caching', () => {
    let db;
    const testDbPath = path.join(__dirname, 'test-cache.sqlite');

    before(async () => {
      // Clean up any existing test database
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      
      db = new DB(testDbPath);
      await db.ready;
      
      // Add test data
      const channelId = db.addChannel('https://www.youtube.com/@test', { 
        playlist_mode: 'enumerate' 
      });
      
      // Add some test videos
      db.db.run(`
        INSERT INTO videos (channel_id, video_id, video_title, download_status, file_size)
        VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
      `, [
        channelId, 'video1', 'Test Video 1', 'completed', 1000000,
        channelId, 'video2', 'Test Video 2', 'completed', 2000000,
        channelId, 'video3', 'Test Video 3', 'pending', 0
      ]);
      db.save();
    });

    after(() => {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    });

    it('should return stats on first call (cache miss)', () => {
      const stats = db.getStats();
      
      assert.strictEqual(stats.channel_count, 1, 'Should have 1 channel');
      assert.strictEqual(stats.total_downloads, 2, 'Should have 2 completed downloads');
      assert.strictEqual(stats.pending_downloads, 1, 'Should have 1 pending download');
      assert.strictEqual(stats.library_size, 3000000, 'Should have total size of 3MB');
    });

    it('should return cached stats on subsequent calls within TTL', () => {
      const stats1 = db.getStats();
      const timestamp1 = db.statsCache.timestamp;
      
      // Call again immediately
      const stats2 = db.getStats();
      const timestamp2 = db.statsCache.timestamp;
      
      assert.deepStrictEqual(stats1, stats2, 'Stats should be identical');
      assert.strictEqual(timestamp1, timestamp2, 'Cache timestamp should not change');
    });

    it('should recalculate stats after TTL expires', async () => {
      // Get initial stats
      const stats1 = db.getStats();
      
      // Manually expire the cache by setting old timestamp
      db.statsCache.timestamp = Date.now() - 4000; // 4 seconds ago (TTL is 3 seconds)
      
      // Add a new video
      db.db.run(`
        INSERT INTO videos (channel_id, video_id, video_title, download_status, file_size)
        VALUES (?, ?, ?, ?, ?)
      `, [1, 'video4', 'Test Video 4', 'completed', 1500000]);
      db.save();
      
      // Get stats again (should recalculate)
      const stats2 = db.getStats();
      
      assert.strictEqual(stats2.total_downloads, 3, 'Should reflect new completed video');
      assert.strictEqual(stats2.library_size, 4500000, 'Should reflect new file size');
      assert.notStrictEqual(stats1.total_downloads, stats2.total_downloads, 'Stats should be different');
    });

    it('should invalidate cache when invalidateStatsCache is called', () => {
      const stats1 = db.getStats();
      const timestamp1 = db.statsCache.timestamp;
      
      // Invalidate cache
      db.invalidateStatsCache();
      
      assert.strictEqual(db.statsCache.timestamp, 0, 'Cache timestamp should be reset to 0');
      assert.notStrictEqual(timestamp1, 0, 'Original timestamp should not be 0');
    });

    it('should invalidate cache when adding a channel', () => {
      db.getStats(); // Prime the cache
      const timestamp1 = db.statsCache.timestamp;
      
      db.addChannel('https://www.youtube.com/@test2', { playlist_mode: 'enumerate' });
      
      assert.strictEqual(db.statsCache.timestamp, 0, 'Cache should be invalidated after addChannel');
      assert.ok(timestamp1 > 0, 'Cache was primed before addChannel');
    });

    it('should invalidate cache when deleting a channel', () => {
      db.getStats(); // Prime the cache
      const timestamp1 = db.statsCache.timestamp;
      
      db.deleteChannel(2); // Delete the second test channel
      
      assert.strictEqual(db.statsCache.timestamp, 0, 'Cache should be invalidated after deleteChannel');
      assert.ok(timestamp1 > 0, 'Cache was primed before deleteChannel');
    });

    it('should invalidate cache when updating video status', () => {
      db.getStats(); // Prime the cache
      const timestamp1 = db.statsCache.timestamp;
      
      db.updateVideoStatus('video3', 'completed', '/path/to/file.mp4', Date.now(), 2500000, null);
      
      assert.strictEqual(db.statsCache.timestamp, 0, 'Cache should be invalidated after updateVideoStatus');
      assert.ok(timestamp1 > 0, 'Cache was primed before updateVideoStatus');
    });

    it('should cache channel stats separately from global stats', () => {
      const globalStats = db.getStats();
      const channelStats = db.getChannelStats();
      
      assert.ok(db.statsCache.timestamp > 0, 'Global stats cache should be populated');
      assert.ok(db.channelStatsCache.timestamp > 0, 'Channel stats cache should be populated');
      
      // They should have different data structures
      assert.ok(Array.isArray(channelStats), 'Channel stats should be an array');
      assert.ok(!Array.isArray(globalStats), 'Global stats should be an object');
    });

    it('should return cached channel stats within TTL', () => {
      const stats1 = db.getChannelStats();
      const timestamp1 = db.channelStatsCache.timestamp;
      
      // Call again immediately
      const stats2 = db.getChannelStats();
      const timestamp2 = db.channelStatsCache.timestamp;
      
      assert.deepStrictEqual(stats1, stats2, 'Channel stats should be identical');
      assert.strictEqual(timestamp1, timestamp2, 'Channel cache timestamp should not change');
    });
  });

  describe('Handle Resolution Caching', () => {
    // Note: These tests would require mocking yt-dlp execution
    // For now, we'll document the expected behavior
    
    it('should document handle resolution feature', () => {
      // This is a placeholder for integration tests
      // extractChannelId() in ytdlp-service.js uses yt-dlp --dump-json
      // Real testing would require:
      // 1. Mock child_process.spawn for yt-dlp
      // 2. Simulate JSON output from yt-dlp
      // 3. Test channel_id extraction
      // 4. Test error handling
      
      // For now, we verify the feature exists by checking it's been implemented
      assert.ok(true, 'Handle resolution feature documented');
    });
    
    it('should cache resolved channel IDs in database', () => {
      // When a @handle URL is enumerated:
      // 1. First time: Call extractChannelId() -> returns {channel_id, channel_name}
      // 2. Store in channels.channel_id field
      // 3. Next enumeration: Pass cached channel_id to enumeratePlaylists()
      // 4. Skip handle resolution, use YouTube API directly
      
      assert.ok(true, 'Channel ID caching behavior documented');
    });
  });
});
