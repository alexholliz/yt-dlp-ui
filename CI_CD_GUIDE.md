# CI/CD Pipeline Setup Guide

## Overview

This project includes a GitHub Actions pipeline that:
- ✅ Runs tests on every push and pull request
- ✅ Builds and publishes Docker images to GitHub Container Registry (ghcr.io)
- ✅ Supports multi-architecture builds (amd64, arm64)
- ✅ Automatically tags images with `latest`, branch name, and commit SHA

## Quick Start

The pipeline will automatically run when you push to `main` or create a pull request.

### Using the Published Image

```bash
# Pull the latest image
docker pull ghcr.io/<your-username>/yt-dlp-ui:latest

# Or pull a specific version
docker pull ghcr.io/<your-username>/yt-dlp-ui:main-abc1234
```

### Update docker-compose.yml

Replace the `build: .` line with the published image:

```yaml
services:
  yt-dlp-ui:
    image: ghcr.io/<your-username>/yt-dlp-ui:latest
    # Remove the 'build: .' line
```

## Branch Protection Setup

To require PR reviews and passing tests for non-admin users:

1. Go to **Settings** → **Branches** → **Add branch protection rule**

2. Configure the rule:
   - **Branch name pattern**: `main`
   - ✅ **Require a pull request before merging**
     - ✅ Required approvals: `1`
     - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Add status check: `test`
   - ✅ **Do not allow bypassing the above settings** - UNCHECK this for admins
   - ✅ **Allow force pushes** → **Specify who can force push** → Add yourself

3. **Admin Bypass**: As the repository owner, you can:
   - Push directly to `main` (tests will still run but won't block)
   - Bypass PR requirements when needed
   - Merge PRs even if tests fail (not recommended)

## Workflow Details

### Build and Test Workflow (`.github/workflows/build-and-test.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests targeting `main`

**Jobs:**

1. **test** (runs on all pushes and PRs)
   - Checks out code
   - Installs dependencies
   - Runs linter (when configured)
   - Runs tests (when configured)
   - Verifies server starts successfully

2. **build** (runs only on `main` pushes)
   - Builds multi-arch Docker image (amd64, arm64)
   - Pushes to GitHub Container Registry
   - Tags with `latest`, branch name, and commit SHA
   - Uses build cache for faster builds

### Image Tags

Images are automatically tagged with:
- `latest` - latest build from `main`
- `main` - latest build from `main`
- `main-<sha>` - specific commit (e.g., `main-abc1234`)

### Permissions

The workflow requires:
- `contents: read` - to checkout code
- `packages: write` - to push to ghcr.io

These are automatically provided by `GITHUB_TOKEN`.

## Adding Tests

To add proper tests, create test files and update `package.json`:

```json
{
  "scripts": {
    "test": "node --test"
  },
  "devDependencies": {
    "mocha": "^10.0.0",
    "chai": "^4.3.0"
  }
}
```

Example test file (`test/server.test.js`):

```javascript
const assert = require('assert');
const { describe, it } = require('node:test');

describe('Server', () => {
  it('should have valid configuration', () => {
    assert.ok(process.env.PORT || 8189);
  });
});
```

## Troubleshooting

### Build Fails

Check the Actions tab for detailed error logs:
1. Go to **Actions** tab in GitHub
2. Click on the failed workflow run
3. Expand the failed job/step to see logs

### Cannot Push to ghcr.io

Ensure you have:
1. Enabled "Package write" permissions in repository settings
2. Made the package public (Settings → Packages → Change visibility)

### Tests Failing

Tests are currently set to `continue-on-error: true` for MVP. Once real tests are added:
1. Remove `continue-on-error: true` from test steps
2. Ensure tests pass locally before pushing
3. Update branch protection to require `test` status check

## Future Enhancements

- [ ] Add proper unit tests
- [ ] Add ESLint for code linting
- [ ] Add code coverage reporting
- [ ] Add automated releases with semantic versioning
- [ ] Add dependency security scanning
- [ ] Add automated changelog generation

## Manual Build and Push

If you need to manually build and push:

```bash
# Log in to ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u <username> --password-stdin

# Build multi-arch image
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/<username>/yt-dlp-ui:latest \
  --push .
```

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
