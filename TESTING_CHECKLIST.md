# Testing Strategy & Checklist

> **⚠️ IMPORTANT FOR AI ASSISTANTS:**  
> This file contains testing strategy, test patterns, and guidelines for adding new tests.
> 
> **When to Update This File:**
> - After adding new test files or test cases
> - When changing testing strategy or approach
> - After discovering new testing patterns or best practices
> - When updating test infrastructure (Docker, CI, etc.)
> - After researching external testing methodologies
> - When test coverage goals change
> 
> **Related Files:**
> - `PROJECT_STATE.md` - Overall project state and feature history
> - `CI_CD_CHECKLIST.md` - CI/CD pipeline configuration
> - `test/` directory - All test files
> - `.github/workflows/build-and-test.yml` - Test execution in CI

---

## Overview

This project follows **yt-dlp's battle-tested two-tier testing approach**: comprehensive unit tests for logic validation, and optional integration tests for end-to-end verification.

**Key Principle**: Unit tests prove the logic works. Integration tests prove it integrates (when they can run).

---

## Testing Architecture

### ✅ Unit Tests (Always Run in CI)

**Location**: `test/database.test.js`, `test/sponsorblock.test.js`

**Purpose**: Test internal logic without external dependencies

**Characteristics**:
- No network calls to YouTube
- No yt-dlp execution
- Fast (< 1 second total)
- Reliable (never fail from bot detection)
- Run on every PR and commit

**Coverage**:
- Database operations (CRUD, migrations)
- SponsorBlock flag generation
- Configuration parsing
- Edge cases and error handling
- **API endpoint logic** (35 tests covering all endpoints)
- **Request validation and error responses**

**Test Files**:
- `test/database.test.js` - Database CRUD operations
- `test/sponsorblock.test.js` - SponsorBlock flag generation logic
- `test/api-endpoints.test.js` - **NEW:** All API endpoints (GET/POST/PUT/DELETE)

### 🔄 Integration Tests (Optional, Local Execution)

**Location**: `test/sponsorblock-integration.test.js`, `test/http-auth.test.js`

**Purpose**: Verify actual system behavior with real dependencies

**Characteristics**:
- Calls real yt-dlp with YouTube videos
- Requires authentication (cookies) to avoid bot detection
- Requires Docker for auth tests
- Slower (~4-30 seconds per test)
- Skipped in CI automatically (`skip: isCI`)
- Run locally by developers when needed

**Coverage**:
- Real yt-dlp command execution
- SponsorBlock mark/remove modes
- Actual video metadata parsing
- End-to-end workflow validation
- **HTTP Basic Auth security** (all endpoints protected)
- **Content leakage prevention** (no data exposed without auth)

---

## CI/CD Pipeline

### Test Stage (Docker Multi-Stage Build)

**Test Stage** (`--target test`):
```dockerfile
FROM base AS test
RUN npm ci  # Install ALL dependencies
COPY test/ ./test/
COPY src/ ./src/
CMD ["npm", "test"]
```

**What Runs**:
- All unit tests (database, sponsorblock logic)
- Integration tests **skipped automatically** via environment check

**Why This Works**:
- Full yt-dlp environment available (for local runs)
- CI environment triggers skip condition
- Tests prove logic without flakiness

### Production Stage

**Production Stage** (`--target production`):
```dockerfile
FROM base AS production
RUN npm ci --only=production  # Lean dependencies
COPY src/ ./src/
COPY public/ ./public/
# NO test/ directory = smaller image
```

---

## Running Tests Locally

### Quick Test Commands

```bash
# Unit tests only (fast, always pass in CI)
npm test

# Integration tests only (requires yt-dlp + cookies)
npm run test:integration

# HTTP Basic Auth tests (requires Docker)
npm run test:auth

# All tests (including integration)
npm run test:all
```

### With Docker (Recommended)

```bash
# Build and run test stage
docker build --target test -t yt-dlp-ui:test .
docker run --rm yt-dlp-ui:test

# Run specific test file
docker run --rm -v ${PWD}:/app -w /app node:20-alpine npm test test/api-endpoints.test.js
```

### Specific Test Suites

```bash
# Database + SponsorBlock + API endpoints (unit tests)
npm test

# Just API endpoint tests
node --test test/api-endpoints.test.js

# Just database tests
node --test test/database.test.js

# SponsorBlock integration (requires YouTube access)
node --test test/sponsorblock-integration.test.js

# HTTP auth security tests (requires Docker)
node --test test/http-auth.test.js
```

**Note**: Integration tests require YouTube cookies for authentication. Export cookies from your browser using an extension like "Get cookies.txt LOCALLY".

---

## Adding New Tests

### ✅ Checklist for New Features

When adding a new feature, follow this checklist:

#### 1. **Database Changes**
- [ ] Add migration test to `test/database.test.js`
- [ ] Test column exists after migration
- [ ] Test default values are correct
- [ ] Test data integrity with new schema

#### 2. **Business Logic**
- [ ] Create unit tests for pure logic functions
- [ ] Mock external dependencies (database, yt-dlp)
- [ ] Test edge cases and error conditions
- [ ] Test data transformations and validations

#### 3. **API Endpoints**
- [ ] Test request validation
- [ ] Test response format
- [ ] Test error responses (400, 404, 500)
- [ ] Test authentication (if applicable)

#### 4. **yt-dlp Integration**
- [ ] Add unit tests for flag/argument generation
- [ ] Verify command structure without execution
- [ ] **Consider** adding integration test (optional)

#### 5. **Integration Tests** (Optional)
- [ ] Only add if feature requires YouTube API verification
- [ ] Use `{ skip: isCI }` to skip in CI
- [ ] Document required authentication
- [ ] Add 30-second timeout protection

### 📝 Test Template

**Unit Test Template**:
```javascript
const { describe, it } = require('node:test');
const assert = require('assert');
const { yourFunction } = require('../src/your-module');

describe('Your Feature', () => {
  it('should handle normal case', () => {
    const result = yourFunction(input);
    assert.strictEqual(result, expected);
  });

  it('should handle edge case', () => {
    const result = yourFunction(edgeInput);
    assert.strictEqual(result, edgeExpected);
  });

  it('should throw on invalid input', () => {
    assert.throws(() => yourFunction(invalidInput), /Expected error/);
  });
});
```

**Integration Test Template**:
```javascript
const { describe, it } = require('node:test');
const assert = require('assert');
const { spawn } = require('child_process');

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

describe('Feature Integration Tests', () => {
  it('should work end-to-end', { skip: isCI }, async () => {
    // Actual external calls here
    const result = await callExternalService();
    assert.ok(result.success);
  });
});
```

---

## Test Organization

### Current Test Files

| File | Type | Lines | Coverage |
|------|------|-------|----------|
| `test/database.test.js` | Unit | 6 tests | Database operations, migrations |
| `test/sponsorblock.test.js` | Unit | 6 tests | Flag generation, validation |
| `test/api-endpoints.test.js` | Unit | 23 tests | All API endpoints (profiles, channels, stats, downloads) |
| `test/sponsorblock-integration.test.js` | Integration | 3 tests | Real yt-dlp execution |
| `test/http-auth.test.js` | Integration | ~30 tests | HTTP Basic Auth security (skipped in CI) |

**Total**: 68+ tests (35 unit, 33+ integration)

### Test Naming Convention

- **Unit tests**: `test/[module-name].test.js`
- **Integration tests**: `test/[feature-name]-integration.test.js`

### Test Structure

```
test/
├── database.test.js                     # Database unit tests
├── sponsorblock.test.js                 # SponsorBlock logic unit tests
├── api-endpoints.test.js                # API endpoint unit tests (NEW)
├── sponsorblock-integration.test.js     # SponsorBlock integration tests
└── http-auth.test.js                    # HTTP Basic Auth security tests (NEW)
```

---

## Testing Patterns & Best Practices

### API Endpoint Testing Pattern

**File**: `test/api-endpoints.test.js`

**Approach**: Create minimal Express app with routes, mock external services

**Why This Works**:
- Tests endpoint logic in isolation
- No need to start full server
- Fast and reliable
- Can test error conditions easily

**Pattern**:
```javascript
const request = require('supertest');
const express = require('express');

// Create test app
const app = express();
app.use(express.json());

// Mock services
const mockDb = { /* methods */ };
const mockYtDlp = { /* methods */ };

// Define routes (matching server.js)
app.get('/api/channels', (req, res) => {
  const channels = mockDb.getAllChannels();
  res.json(channels);
});

// Test
describe('GET /api/channels', () => {
  it('should return all channels', async () => {
    const res = await request(app).get('/api/channels');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
```

**Coverage** (35 tests):
- ✅ All profile endpoints (GET, POST, PUT, DELETE)
- ✅ All channel endpoints (GET, POST, PUT, DELETE)
- ✅ All playlist endpoints (GET, PUT, DELETE videos)
- ✅ All video endpoints (GET, DELETE single/bulk)
- ✅ All stats endpoints (global, per-channel, recent downloads)
- ✅ All download control endpoints (start, retry, status, queue)
- ✅ Error cases (404, 400, 500)
- ✅ Request validation

### HTTP Basic Auth Testing Pattern

**File**: `test/http-auth.test.js`

**Approach**: Start Docker container with auth env vars, test all endpoints

**Why This Works**:
- Tests real authentication middleware
- Verifies no content leakage
- Tests all endpoints systematically
- Confirms 401 responses include WWW-Authenticate header

**Pattern**:
```javascript
const isCI = process.env.CI === 'true';

describe('HTTP Basic Auth', { skip: isCI }, () => {
  before(async () => {
    // Start container with BASIC_AUTH_USERNAME and PASSWORD
    execSync('docker run -d -p 18190:8189 -e BASIC_AUTH_USERNAME=test -e BASIC_AUTH_PASSWORD=pass ...');
    await waitForServer('http://localhost:18190', 30000);
  });
  
  after(() => {
    // Clean up container
    execSync('docker stop ...');
  });
  
  it('should return 401 without credentials', async () => {
    const res = await fetch('http://localhost:18190/api/channels');
    assert.strictEqual(res.status, 401);
    assert.ok(res.headers.get('www-authenticate').includes('Basic'));
  });
  
  it('should allow access with valid credentials', async () => {
    const auth = Buffer.from('test:pass').toString('base64');
    const res = await fetch('http://localhost:18190/api/channels', {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    assert.strictEqual(res.status, 200);
  });
});
```

**Coverage** (~30 tests):
- ✅ All endpoints return 401 without auth
- ✅ All endpoints return success with valid auth
- ✅ Invalid credentials rejected
- ✅ No content leakage in 401 responses
- ✅ Static files protected (HTML, CSS, JS)
- ✅ WWW-Authenticate header present

### Integration Test Pattern (yt-dlp)

### Unit Test Failures
1. Run test locally: `npm test test/[failing-test].test.js`
2. Check test output for assertion failures
3. Add debug logging to function under test
4. Fix logic, rerun test

### Integration Test Failures (Local)
1. Verify yt-dlp is installed: `yt-dlp --version`
2. Check YouTube cookies are valid
3. Test yt-dlp directly: `yt-dlp --dump-json [test-url]`
4. Check for YouTube bot detection errors
5. Export fresh cookies if needed

### CI Test Failures
1. Check GitHub Actions logs
2. Identify which unit test failed
3. Reproduce locally: `npm test`
4. Fix and push

**Note**: Integration tests should never fail in CI because they're skipped automatically.

---

## Research & References

### yt-dlp Testing Strategy Analysis

Our approach is based on **yt-dlp's proven testing methodology**:

**Key Findings**:
1. yt-dlp uses **95% unit tests, 5% integration tests**
2. Unit tests mock all external calls (no YouTube API)
3. Download tests have **retry logic** (3 attempts) for bot detection
4. Integration tests use **local authentication files** (gitignored)
5. CI runs **core tests only**, download tests are optional
6. **No magic solution** for YouTube bot detection exists

**What They Test**:
- **Unit**: Chapter manipulation, segment overlap, title generation, ffmpeg concat
- **Integration**: Real video extraction with retry logic and local auth

**Their Philosophy**:
> "Unit tests prove the logic works. Download tests prove integration (when they can run). Bot detection is YouTube's problem, not a test problem."

**Reference**: See `files/yt-dlp-testing-research.md` for full analysis

---

## Maintenance

### Regular Tasks

**Weekly**:
- [ ] Run full test suite locally (including integration)
- [ ] Verify integration tests still work with current cookies

**Per Release**:
- [ ] All unit tests pass in CI ✅
- [ ] Integration tests pass locally ✅
- [ ] No skipped tests due to bugs ✅

**When YouTube Changes**:
- [ ] Integration tests may fail (expected)
- [ ] Update test video URLs if needed
- [ ] Verify unit tests still cover logic

### Updating Test Videos

If a test video becomes unavailable:

1. Find replacement video with similar characteristics
2. Update URL in test file
3. Run integration test locally to verify
4. Update test expectations if needed
5. Document change in commit message

---

## Philosophy

> **"Tests should give you confidence, not maintenance burden."**

- ✅ Write unit tests for everything you can mock
- ✅ Write integration tests for critical workflows
- ✅ Accept that external services are unreliable
- ✅ Never let flaky tests block deployments
- ❌ Don't test external APIs you don't control
- ❌ Don't fight YouTube bot detection in CI

**Result**: Fast, reliable CI with comprehensive coverage.
