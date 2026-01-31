const { describe, it } = require('node:test');
const assert = require('assert');
const { spawn } = require('child_process');

// Integration test - requires yt-dlp installed and YouTube access
// These tests verify SponsorBlock actually works with real videos
// Skipped in CI because YouTube requires authentication (bot check)
describe('SponsorBlock Integration Tests', () => {
  const testVideoUrl = 'https://www.youtube.com/watch?v=aLXiLRuCqvE';
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  it('should mark sponsor segments as chapters', { skip: isCI }, async () => {
    const args = [
      '--dump-json',
      '--skip-download',
      '--sponsorblock-mark', 'sponsor',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should succeed: ${result.error}`);
    assert.ok(result.videoInfo, 'Should return video info');
    
    // Check if chapters exist and include SponsorBlock markers
    if (result.videoInfo.chapters && result.videoInfo.chapters.length > 0) {
      const sponsorChapters = result.videoInfo.chapters.filter(ch => 
        ch.title && ch.title.toLowerCase().includes('sponsor')
      );
      console.log(`Found ${result.videoInfo.chapters.length} chapters, ${sponsorChapters.length} sponsor chapters`);
      assert.ok(sponsorChapters.length > 0, 'Should have at least one sponsor chapter marked');
    } else {
      console.log('Warning: No chapters found - SponsorBlock data may not be available for this video');
    }
  });

  it('should process remove mode without errors', { skip: isCI }, async () => {
    const args = [
      '--dump-json',
      '--skip-download',
      '--sponsorblock-remove', 'sponsor',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should succeed with remove mode: ${result.error}`);
    assert.ok(result.videoInfo, 'Should return video info');
    assert.ok(result.videoInfo.id, 'Should have video ID');
  });

  it('should handle multiple categories', { skip: isCI }, async () => {
    const args = [
      '--dump-json',
      '--skip-download',
      '--sponsorblock-mark', 'sponsor,intro,outro,selfpromo',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should succeed with multiple categories: ${result.error}`);
    assert.ok(result.videoInfo, 'Should return video info');
  });
});

// Helper function to run yt-dlp and capture output
function runYtDlp(args) {
  return new Promise((resolve) => {
    const ytdlp = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      try {
        const videoInfo = JSON.parse(stdout);
        resolve({
          success: code === 0,
          videoInfo,
          stderr: stderr.trim(),
          error: code !== 0 ? stderr.trim() : null
        });
      } catch (err) {
        resolve({
          success: false,
          videoInfo: null,
          stderr: stderr.trim(),
          error: `Failed to parse JSON: ${err.message}\nSTDERR: ${stderr.substring(0, 1000)}`
        });
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlp.kill();
      resolve({
        success: false,
        videoInfo: null,
        stderr: stderr.trim(),
        error: 'Test timeout after 30 seconds'
      });
    }, 30000);
  });
}
