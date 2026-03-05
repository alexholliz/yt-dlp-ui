const { describe, it, before, after } = require('node:test');
const assert = require('assert');

/**
 * Tests for YouTubeApiService quota-related logic:
 *  - _nextMidnightPacific(): must return midnight America/Los_Angeles regardless of DST
 *  - getQuotaStatus(): must return safe defaults before setDb() is called
 *
 * No DB, no network required.
 */

describe('YouTubeApiService – quota', () => {
  let YouTubeApiService;

  before(() => {
    YouTubeApiService = require('../src/youtube-api-service');
  });

  // ---------------------------------------------------------------------------
  describe('getQuotaStatus() before setDb()', () => {
    it('returns safe defaults when quotaData is null', () => {
      const svc = new YouTubeApiService();
      const status = svc.getQuotaStatus();
      assert.strictEqual(status.used, 0);
      assert.strictEqual(status.limit, 10000);
      assert.strictEqual(status.remaining, 10000);
      assert.strictEqual(status.resetTime, null);
    });

    it('does not throw before setDb() is called', () => {
      const svc = new YouTubeApiService();
      assert.doesNotThrow(() => svc.getQuotaStatus());
    });
  });

  // ---------------------------------------------------------------------------
  describe('_nextMidnightPacific()', () => {
    let svc;
    before(() => { svc = new YouTubeApiService(); });

    it('returns a string', () => {
      assert.strictEqual(typeof svc._nextMidnightPacific(), 'string');
    });

    it('returns a valid ISO 8601 date string', () => {
      const result = svc._nextMidnightPacific();
      assert.ok(!isNaN(Date.parse(result)), `Not a valid date: ${result}`);
    });

    it('returns a time in the future', () => {
      const result = new Date(svc._nextMidnightPacific());
      assert.ok(result > new Date(), 'Reset time should be in the future');
    });

    it('returns a time no more than 48 hours away', () => {
      const result = new Date(svc._nextMidnightPacific());
      const maxFuture = new Date(Date.now() + 48 * 60 * 60 * 1000);
      assert.ok(result <= maxFuture, `Expected ≤48h away, got ${result.toISOString()}`);
    });

    it('resolves to exactly midnight (00:00:00) in America/Los_Angeles', () => {
      const result = svc._nextMidnightPacific();
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23',
      });
      const parts = fmt.formatToParts(new Date(result));
      const get = (type) => +parts.find(p => p.type === type).value;

      assert.strictEqual(get('hour'),   0, `hour should be 0, got ${get('hour')}`);
      assert.strictEqual(get('minute'), 0, `minute should be 0`);
      assert.strictEqual(get('second'), 0, `second should be 0`);
    });

    it('is stable within a single second (two calls close together return same date)', () => {
      const r1 = svc._nextMidnightPacific();
      const r2 = svc._nextMidnightPacific();
      // Both should resolve to the same midnight (same date in PT)
      const d1 = new Date(r1);
      const d2 = new Date(r2);
      assert.strictEqual(d1.getTime(), d2.getTime());
    });
  });
});
