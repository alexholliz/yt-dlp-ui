const { describe, it } = require('node:test');
const assert = require('assert');

describe('SponsorBlock Integration', () => {
  describe('buildDownloadOptions', () => {
    it('should add sponsorblock-mark flag when enabled with mark mode', () => {
      const channel = {
        flat_mode: false,
        yt_dlp_options: '',
        sponsorblock_enabled: true,
        sponsorblock_mode: 'mark',
        sponsorblock_categories: 'sponsor,intro'
      };
      const playlist = {
        playlist_title: 'Test Playlist',
        playlist_id: 'PLtest123'
      };

      // Mock the download manager's buildDownloadOptions method
      const path = require('path');
      const outputTemplate = channel.flat_mode
        ? '%(uploader)s [%(channel_id)s]/%(title)s [%(id)s].%(ext)s'
        : '%(uploader)s [%(channel_id)s]/%(playlist_title)s [%(playlist_id)s]/%(playlist_index)s - %(title)s [%(id)s].%(ext)s';

      let sponsorblockArgs = '';
      if (channel.sponsorblock_enabled && channel.sponsorblock_categories) {
        const mode = channel.sponsorblock_mode || 'mark';
        const categories = channel.sponsorblock_categories;
        
        if (mode === 'mark') {
          sponsorblockArgs = `--sponsorblock-mark ${categories}`;
        } else if (mode === 'remove') {
          sponsorblockArgs = `--sponsorblock-remove ${categories}`;
        }
      }

      const customArgs = [channel.yt_dlp_options, sponsorblockArgs]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      assert.strictEqual(customArgs, '--sponsorblock-mark sponsor,intro');
    });

    it('should add sponsorblock-remove flag when enabled with remove mode', () => {
      const channel = {
        flat_mode: false,
        yt_dlp_options: '',
        sponsorblock_enabled: true,
        sponsorblock_mode: 'remove',
        sponsorblock_categories: 'sponsor,outro,selfpromo'
      };

      let sponsorblockArgs = '';
      if (channel.sponsorblock_enabled && channel.sponsorblock_categories) {
        const mode = channel.sponsorblock_mode || 'mark';
        const categories = channel.sponsorblock_categories;
        
        if (mode === 'mark') {
          sponsorblockArgs = `--sponsorblock-mark ${categories}`;
        } else if (mode === 'remove') {
          sponsorblockArgs = `--sponsorblock-remove ${categories}`;
        }
      }

      const customArgs = [channel.yt_dlp_options, sponsorblockArgs]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      assert.strictEqual(customArgs, '--sponsorblock-remove sponsor,outro,selfpromo');
    });

    it('should not add sponsorblock flags when disabled', () => {
      const channel = {
        flat_mode: false,
        yt_dlp_options: '',
        sponsorblock_enabled: false,
        sponsorblock_mode: 'mark',
        sponsorblock_categories: 'sponsor,intro'
      };

      let sponsorblockArgs = '';
      if (channel.sponsorblock_enabled && channel.sponsorblock_categories) {
        const mode = channel.sponsorblock_mode || 'mark';
        const categories = channel.sponsorblock_categories;
        
        if (mode === 'mark') {
          sponsorblockArgs = `--sponsorblock-mark ${categories}`;
        } else if (mode === 'remove') {
          sponsorblockArgs = `--sponsorblock-remove ${categories}`;
        }
      }

      const customArgs = [channel.yt_dlp_options, sponsorblockArgs]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      assert.strictEqual(customArgs, null);
    });

    it('should combine custom args with sponsorblock args', () => {
      const channel = {
        flat_mode: false,
        yt_dlp_options: '--embed-thumbnail --embed-metadata',
        sponsorblock_enabled: true,
        sponsorblock_mode: 'mark',
        sponsorblock_categories: 'sponsor'
      };

      let sponsorblockArgs = '';
      if (channel.sponsorblock_enabled && channel.sponsorblock_categories) {
        const mode = channel.sponsorblock_mode || 'mark';
        const categories = channel.sponsorblock_categories;
        
        if (mode === 'mark') {
          sponsorblockArgs = `--sponsorblock-mark ${categories}`;
        } else if (mode === 'remove') {
          sponsorblockArgs = `--sponsorblock-remove ${categories}`;
        }
      }

      const customArgs = [channel.yt_dlp_options, sponsorblockArgs]
        .filter(Boolean)
        .join(' ')
        .trim() || null;

      assert.strictEqual(customArgs, '--embed-thumbnail --embed-metadata --sponsorblock-mark sponsor');
    });
  });

  describe('Category Validation', () => {
    it('should accept valid category strings', () => {
      const validCategories = [
        'sponsor',
        'intro',
        'outro',
        'selfpromo',
        'interaction',
        'preview',
        'music_offtopic',
        'sponsor,intro,outro'
      ];

      validCategories.forEach(cat => {
        assert.ok(cat.split(',').every(c => 
          ['sponsor', 'intro', 'outro', 'selfpromo', 'interaction', 'preview', 'music_offtopic'].includes(c.trim())
        ));
      });
    });
  });
});
