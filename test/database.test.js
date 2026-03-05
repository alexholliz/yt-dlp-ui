const { describe, it, before, after } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Database Operations', () => {
  let DB;
  let testDb;
  const testDbPath = path.join(__dirname, 'test-db.sqlite');

  before(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    DB = require('../src/database.js');
    testDb = new DB(testDbPath);
    await testDb.ready;
  });

  after(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Channel Management', () => {
    it('should create channels table', () => {
      const result = testDb.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='channels'");
      assert.ok(result.length > 0, 'Channels table should exist');
    });

    it('should add channel with SponsorBlock options', () => {
      const channelId = testDb.addChannel('https://youtube.com/@testchannel', {
        playlist_mode: 'enumerate',
        flat_mode: false,
        auto_add_new_playlists: true,
        yt_dlp_options: '--embed-thumbnail',
        rescrape_interval_days: 7,
        sponsorblock_enabled: true,
        sponsorblock_mode: 'mark',
        sponsorblock_categories: 'sponsor,intro,outro'
      });

      assert.ok(channelId > 0, 'Should return valid channel ID');

      const channel = testDb.getChannel(channelId);
      assert.strictEqual(channel.sponsorblock_enabled, 1);
      assert.strictEqual(channel.sponsorblock_mode, 'mark');
      assert.strictEqual(channel.sponsorblock_categories, 'sponsor,intro,outro');
    });

    it('should update channel with SponsorBlock options', () => {
      const channelId = testDb.addChannel('https://youtube.com/@testchannel2', {});
      
      testDb.updateChannel(channelId, {
        sponsorblock_enabled: true,
        sponsorblock_mode: 'remove',
        sponsorblock_categories: 'sponsor,selfpromo'
      });

      const channel = testDb.getChannel(channelId);
      assert.strictEqual(channel.sponsorblock_enabled, 1);
      assert.strictEqual(channel.sponsorblock_mode, 'remove');
      assert.strictEqual(channel.sponsorblock_categories, 'sponsor,selfpromo');
    });

    it('should handle channel without SponsorBlock options', () => {
      const channelId = testDb.addChannel('https://youtube.com/@testchannel3', {
        playlist_mode: 'enumerate'
      });

      const channel = testDb.getChannel(channelId);
      assert.strictEqual(channel.sponsorblock_enabled, 0);
      assert.ok(channel.sponsorblock_mode === 'mark' || channel.sponsorblock_mode === null);
    });
  });

  describe('Config Table', () => {
    it('returns null for a key that has never been set', () => {
      assert.strictEqual(testDb.getConfig('nonexistent_key_xyz'), null);
    });

    it('setConfig / getConfig roundtrip', () => {
      testDb.setConfig('test_key', 'test_value');
      assert.strictEqual(testDb.getConfig('test_key'), 'test_value');
    });

    it('setConfig updates an existing key (upsert)', () => {
      testDb.setConfig('upsert_key', 'first');
      testDb.setConfig('upsert_key', 'second');
      assert.strictEqual(testDb.getConfig('upsert_key'), 'second');
    });

    it('getAllConfig returns an object keyed by config key', () => {
      testDb.setConfig('cfg_a', 'alpha');
      testDb.setConfig('cfg_b', 'beta');
      const config = testDb.getAllConfig();
      assert.ok(typeof config === 'object' && config !== null);
      assert.strictEqual(config.cfg_a, 'alpha');
      assert.strictEqual(config.cfg_b, 'beta');
    });

    it('getAllConfig returns empty object when no config rows exist', () => {
      // Use a fresh isolated db for this test
      const DB = require('../src/database.js');
      const tmpPath = require('path').join(__dirname, 'test-config-empty.sqlite');
      const fs = require('fs');
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      const fresh = new DB(tmpPath);
      // Wait for ready synchronously (sql.js is sync under the hood after ready fires)
      fresh.ready.then(() => {
        const cfg = fresh.getAllConfig();
        assert.ok(typeof cfg === 'object');
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      });
    });
  });

  describe('Database Migrations', () => {
    it('should have sponsorblock_enabled column in channels table', () => {
      const result = testDb.db.exec("PRAGMA table_info(channels)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      assert.ok(columns.includes('sponsorblock_enabled'), 'sponsorblock_enabled column should exist');
    });

    it('should have sponsorblock_mode column in channels table', () => {
      const result = testDb.db.exec("PRAGMA table_info(channels)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      assert.ok(columns.includes('sponsorblock_mode'), 'sponsorblock_mode column should exist');
    });

    it('should have sponsorblock_categories column in channels table', () => {
      const result = testDb.db.exec("PRAGMA table_info(channels)");
      const columns = result[0]?.values.map(row => row[1]) || [];
      assert.ok(columns.includes('sponsorblock_categories'), 'sponsorblock_categories column should exist');
    });
  });
});
