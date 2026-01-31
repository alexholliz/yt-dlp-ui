# Testing Strategy & Checklist

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

### 🔄 Integration Tests (Optional, Local Execution)

**Location**: `test/sponsorblock-integration.test.js`

**Purpose**: Verify actual yt-dlp execution with SponsorBlock

**Characteristics**:
- Calls real yt-dlp with YouTube videos
- Requires authentication (cookies) to avoid bot detection
- Slower (~4 seconds per test)
- Skipped in CI automatically (`skip: isCI`)
- Run locally by developers when needed

**Coverage**:
- Real yt-dlp command execution
- SponsorBlock mark/remove modes
- Actual video metadata parsing
- End-to-end workflow validation

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

### All Tests (Including Integration)
```bash
# With Docker (recommended)
docker build --target test -t yt-dlp-ui:test .
docker run --rm yt-dlp-ui:test

# Without Docker (requires yt-dlp, ffmpeg, node)
npm test
```

### Unit Tests Only
```bash
npm test test/database.test.js test/sponsorblock.test.js
```

### Integration Tests Only
```bash
npm test test/sponsorblock-integration.test.js
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
| `test/sponsorblock-integration.test.js` | Integration | 3 tests | Real yt-dlp execution |

**Total**: 15 tests (12 unit, 3 integration)

### Test Naming Convention

- **Unit tests**: `test/[module-name].test.js`
- **Integration tests**: `test/[feature-name]-integration.test.js`

### Test Structure

```
test/
├── database.test.js              # Database unit tests
├── sponsorblock.test.js          # SponsorBlock logic unit tests
└── sponsorblock-integration.test.js  # SponsorBlock integration tests
```

---

## Debugging Failed Tests

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
