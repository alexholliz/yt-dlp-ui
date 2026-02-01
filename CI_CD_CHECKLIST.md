# CI/CD Pipeline - Post-Push Checklist

> **⚠️ IMPORTANT FOR AI ASSISTANTS:**  
> This file contains CI/CD pipeline status, deployment checklist, and workflow configuration.
> 
> **When to Update This File:**
> - After modifying `.github/workflows/*.yml` files
> - When changing Docker build process or Dockerfile
> - After updating deployment steps or procedures
> - When adding/removing CI checks or test requirements
> - After troubleshooting pipeline issues
> - When updating container registry settings
> 
> **Related Files:**
> - `PROJECT_STATE.md` - Overall project state and feature history
> - `TESTING_CHECKLIST.md` - Testing strategy and test development  
> - [CI/CD Guide (Wiki)](https://github.com/alexholliz/yt-dlp-ui/wiki/CI-CD-Guide) - Detailed setup instructions
> - [Pipeline Setup (Wiki)](https://github.com/alexholliz/yt-dlp-ui/wiki/Pipeline-Setup) - Quick reference

---

After you push the pipeline to GitHub, complete these steps:

## Immediate (First 30 minutes)

- [ ] **Push to GitHub**
  ```bash
  git add .
  git commit -m "Add CI/CD pipeline with GitHub Actions"
  git push origin main
  ```

- [ ] **Watch First Build**
  - Go to: https://github.com/<username>/yt-dlp-ui/actions
  - Click on the "Build and Test" workflow run
  - Wait for completion (~5-10 minutes first time)
  - Verify all steps pass with green checkmarks

- [ ] **Make Package Public**
  1. Go to: https://github.com/<username>/yt-dlp-ui
  2. Click **Packages** (right sidebar)
  3. Click `yt-dlp-ui` package
  4. Click **Package settings** (bottom right)
  5. Scroll to **Danger Zone**
  6. Click **Change visibility** → **Public**
  7. Confirm the change

- [ ] **Test Pulling Image**
  ```bash
  docker pull ghcr.io/<username>/yt-dlp-ui:latest
  docker run --rm ghcr.io/<username>/yt-dlp-ui:latest node --version
  ```

## Optional (Within a week)

- [ ] **Configure Branch Protection**
  1. Go to: https://github.com/<username>/yt-dlp-ui/settings/branches
  2. Click **Add branch protection rule**
  3. Branch pattern: `main`
  4. Enable:
     - ✅ Require pull request before merging (1 approval)
     - ✅ Require status checks: `test`
     - ✅ Require branches to be up to date
  5. **Leave unchecked**: "Do not allow bypassing" (so you can push directly)
  6. Save changes

- [ ] **Update docker-compose.yml to Use Published Image**
  ```yaml
  services:
    yt-dlp-ui:
      image: ghcr.io/<username>/yt-dlp-ui:latest
      # Remove: build: .
  ```

- [ ] **Update Unraid Template** (if applicable)
  - Change `Repository` to: `ghcr.io/<username>/yt-dlp-ui:latest`

## Known Issues & Workarounds

### ARM64 Build Issue - Resolved (2026-02-01)

**Issue**: Multi-architecture builds were failing on ARM64 with QEMU emulation error after adding test dependencies.

**Root Cause**: `jsdom` package (a devDependency) has native bindings that fail under QEMU emulation used by Docker Buildx for cross-platform builds.

**Solution**: Removed jsdom from devDependencies since it wasn't being used yet
- jsdom was added for future UI JavaScript tests but never actually used
- supertest (the other test dependency) has no native bindings and works fine
- Removed jsdom, regenerated package-lock.json
- Re-enabled ARM64 builds: `platforms: linux/amd64,linux/arm64`

**Lesson Learned**: 
- Heavy dependencies with native bindings (like jsdom, puppeteer, sharp) can cause QEMU issues
- Only add dependencies when actually needed
- Test multi-arch builds after adding new dependencies
- Production builds were unaffected (only dev dependencies had the issue)

**If Future UI Tests Need jsdom**:
1. Try alternatives first: happy-dom (lighter, no native deps)
2. If jsdom is required, consider debian-based Node image
3. Or use native ARM64 runners (GitHub hosted or self-hosted)
4. Or test UI functionality through API tests instead

---

## Future Enhancements

- [ ] Add real unit tests (replace placeholders)
- [ ] Add ESLint for code linting
- [ ] Add code coverage reporting
- [ ] Set up automated releases with tags
- [ ] Add security scanning (Dependabot, Trivy)
- [ ] Add automated changelog generation

## Verify Everything Works

### Test 1: Direct Push (You)
```bash
echo "# Test" >> README.md
git add README.md
git commit -m "Test CI/CD"
git push origin main
# Check Actions tab - should build and push
```

### Test 2: Pull Request (Contributors)
```bash
git checkout -b test-branch
echo "# Test PR" >> README.md
git add README.md
git commit -m "Test PR"
git push origin test-branch
# Create PR on GitHub
# Check Actions tab - should run tests only (no build)
```

## Troubleshooting

### Build fails with "permission denied"
- Ensure package visibility is set to **Public**
- Check repository → Settings → Actions → General → Workflow permissions
- Should be: "Read and write permissions"

### Can't pull published image
- Verify package is public
- Check package name matches: `ghcr.io/<username>/yt-dlp-ui`
- Try: `docker logout ghcr.io && docker pull ghcr.io/<username>/yt-dlp-ui:latest`

### Tests failing
- Currently tests are placeholders with `continue-on-error: true`
- They won't block builds
- Check Actions logs for details

## Success Criteria

✅ Workflow runs successfully on push to main
✅ Docker image available at ghcr.io
✅ Can pull and run published image
✅ Badge shows "passing" in README
✅ (Optional) Branch protection configured
✅ (Optional) Contributors can create PRs

## Resources

- [CI_CD_GUIDE.md](CI_CD_GUIDE.md) - Full documentation
- [PIPELINE_SETUP.md](PIPELINE_SETUP.md) - Quick setup
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [GHCR Docs](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)

---

**Note**: Replace `<username>` with your actual GitHub username in all commands above.
