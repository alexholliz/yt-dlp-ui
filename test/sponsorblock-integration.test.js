const { describe, it } = require('node:test');
const assert = require('assert');
const { spawn } = require('child_process');

// Integration test - requires yt-dlp installed
describe('SponsorBlock Integration Tests', () => {
  const testVideoUrl = 'https://www.youtube.com/watch?v=aLXiLRuCqvE';
  
  it('should mark sponsor segments as chapters', async () => {
    const args = [
      '--dump-json',
      '--skip-download',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
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
      assert.ok(sponsorChapters.length > 0, 'Should have at least one sponsor chapter marked');
    } else {
      console.log('Warning: No chapters found - SponsorBlock data may not be available for this video');
      // Don't fail the test - SponsorBlock data is community-contributed and may not always be present
    }
  });

  it('should process remove mode without errors', async () => {
    // For remove mode, we can't easily verify segments were removed without downloading
    // But we can verify the command runs without errors
    const args = [
      '--dump-json',
      '--skip-download',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '--sponsorblock-remove', 'sponsor',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should succeed with remove mode: ${result.error}`);
    assert.ok(result.videoInfo, 'Should return video info');
    assert.ok(result.videoInfo.id, 'Should have video ID');
  });

  it('should handle multiple categories', async () => {
    const args = [
      '--dump-json',
      '--skip-download',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
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
          stderr,
          error: code !== 0 ? stderr : null
        });
      } catch (err) {
        resolve({
          success: false,
          videoInfo: null,
          stderr,
          error: `Failed to parse JSON: ${err.message}`
        });
      }
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlp.kill();
      resolve({
        success: false,
        videoInfo: null,
        stderr,
        error: 'Test timeout after 30 seconds'
      });
    }, 30000);
  });
}
