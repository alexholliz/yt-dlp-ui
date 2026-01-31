# CI/CD Pipeline - Quick Setup

## What Was Created

✅ **GitHub Actions Workflow**: `.github/workflows/build-and-test.yml`
- Runs tests on every push and PR
- Builds and publishes Docker images to ghcr.io (only on `main` pushes)
- Supports multi-architecture builds (amd64, arm64)

✅ **Documentation**: `CI_CD_GUIDE.md`
- Complete setup instructions
- Branch protection configuration
- Troubleshooting guide

✅ **Updated Files**:
- `package.json` - Added test and lint scripts
- `README.md` - Added CI/CD badge and contributing section

## Next Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Add CI/CD pipeline with GitHub Actions"
git push origin main
```

### 2. Watch the Build

1. Go to **Actions** tab in GitHub
2. You'll see the "Build and Test" workflow running
3. First run will take 5-10 minutes (multi-arch build)
4. Subsequent builds use cache and are faster (~2-3 minutes)

### 3. Make Package Public

After first successful build:

1. Go to your repository on GitHub
2. Click **Packages** on the right sidebar
3. Click on `yt-dlp-ui` package
4. Click **Package settings** (bottom left)
5. Scroll to **Danger Zone**
6. Click **Change visibility** → **Public**

### 4. Configure Branch Protection (Optional but Recommended)

Go to **Settings** → **Branches** → **Add branch protection rule**:

**For Contributors (Require PR Reviews):**
- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - Required approvals: 1
- ✅ Require status checks to pass before merging
  - Add status check: `test`
- ⚠️ **IMPORTANT**: Leave "Do not allow bypassing" **UNCHECKED** so you (admin) can push directly

**Result:**
- You can push directly to `main` (tests run but don't block)
- Others must create PRs that require your approval
- All tests must pass before PRs can be merged

### 5. Update docker-compose.yml

Replace `build: .` with the published image:

```yaml
services:
  yt-dlp-ui:
    image: ghcr.io/<your-username>/yt-dlp-ui:latest
    # Remove 'build: .' line
```

## Usage

### For You (Admin/Owner)

```bash
# Push directly to main - builds automatically
git push origin main
```

### For Contributors

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and push
git push origin feature/new-feature

# Create PR on GitHub
# Tests will run automatically
# PR requires your approval to merge
```

## Image Tags

After successful build, images are available at:

```bash
# Latest from main
ghcr.io/<username>/yt-dlp-ui:latest

# Branch-specific
ghcr.io/<username>/yt-dlp-ui:main

# Commit-specific
ghcr.io/<username>/yt-dlp-ui:main-abc1234
```

## Current Test Status

⚠️ **MVP Status**: Tests are currently placeholders:
- Basic server startup check
- Tests marked as `continue-on-error: true`
- Won't block builds yet

**To Add Real Tests Later:**
1. Add test files in `test/` directory
2. Update `package.json` scripts
3. Remove `continue-on-error: true` from workflow
4. Enable branch protection status checks

## Troubleshooting

### Build Fails on First Run

- Normal! May need to set package visibility to public first
- Check Actions tab for detailed logs

### Can't Find Published Image

- Ensure package is public (see step 3 above)
- Check Packages tab in your GitHub profile/repo

### Tests Fail

- Currently tests are placeholders and won't block
- Check Actions → Failed workflow → Expand steps to see error

## What Happens on Each Push

### Push to `main`:
1. ✅ Checkout code
2. ✅ Run tests (currently pass by default)
3. ✅ Build multi-arch Docker image
4. ✅ Push to ghcr.io with tags
5. ✅ Cache layers for faster builds

### Pull Request:
1. ✅ Checkout code
2. ✅ Run tests
3. ❌ **NO BUILD** (only builds on main)
4. ✅ Show test results in PR

## Files Created

```
.github/
  workflows/
    build-and-test.yml    # Main workflow file
CI_CD_GUIDE.md            # Detailed documentation  
PIPELINE_SETUP.md         # This file - quick reference
```

## Need Help?

See the full [CI_CD_GUIDE.md](CI_CD_GUIDE.md) for:
- Detailed workflow explanation
- Branch protection setup
- Adding real tests
- Manual build commands
- Advanced configuration
