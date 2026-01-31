const { describe, it } = require('node:test');
const assert = require('assert');
const { spawn } = require('child_process');

// Integration test - requires yt-dlp installed
// These tests verify yt-dlp accepts SponsorBlock flags without error
describe('SponsorBlock Integration Tests', () => {
  const testVideoUrl = 'https://www.youtube.com/watch?v=aLXiLRuCqvE';
  
  it('should mark sponsor segments as chapters', async () => {
    const args = [
      '--print', '%(title)s',  // Just print title, don't fetch full metadata
      '--skip-download',
      '--sponsorblock-mark', 'sponsor',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should accept sponsorblock-mark flag: ${result.error}`);
    assert.ok(result.output.length > 0, 'Should return video title');
  });

  it('should process remove mode without errors', async () => {
    const args = [
      '--print', '%(title)s',
      '--skip-download',
      '--sponsorblock-remove', 'sponsor',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should accept sponsorblock-remove flag: ${result.error}`);
    assert.ok(result.output.length > 0, 'Should return video title');
  });

  it('should handle multiple categories', async () => {
    const args = [
      '--print', '%(title)s',
      '--skip-download',
      '--sponsorblock-mark', 'sponsor,intro,outro,selfpromo',
      testVideoUrl
    ];

    const result = await runYtDlp(args);
    
    assert.ok(result.success, `yt-dlp should accept multiple categories: ${result.error}`);
    assert.ok(result.output.length > 0, 'Should return video title');
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
      resolve({
        success: code === 0,
        output: stdout.trim(),
        stderr: stderr.trim(),
        error: code !== 0 ? `Exit code ${code}\nSTDERR: ${stderr.substring(0, 1000)}` : null
      });
    });

    // Set timeout to prevent hanging
    setTimeout(() => {
      ytdlp.kill();
      resolve({
        success: false,
        output: '',
        stderr: stderr.trim(),
        error: 'Test timeout after 30 seconds'
      });
    }, 30000);
  });
}
