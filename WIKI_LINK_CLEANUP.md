# Wiki Link Cleanup Guide

This document provides instructions for cleaning up internal links in the GitHub Wiki pages to ensure all cross-references work correctly.

## Wiki Pages Structure

The wiki contains the following pages (from files migrated from main repo):

- **Home** - Landing page with navigation
- **Quickstart** - Quick start guide
- **Development** - Development guide
- **Features-Complete** - Complete feature list
- **CI-CD-Guide** - CI/CD guide
- **Pipeline-Setup** - Pipeline quick reference
- **Security-Config** - Security configuration
- **MVP-Complete** - MVP release notes

**Remaining in Main Repo:**
- **PROJECT_STATE.md** - Project history (AI assistant reference)
- **TESTING_CHECKLIST.md** - Testing checklist (AI assistant reference)
- **CI_CD_CHECKLIST.md** - CI/CD checklist (AI assistant reference)

## Link Replacement Patterns

### Links to Wiki Pages

Replace old file references with wiki page names:

| Old Link (File) | New Link (Wiki) | Example |
|----------------|-----------------|---------|
| `QUICKSTART.md` | `Quickstart` | `[Quick Start](Quickstart)` |
| `DEVELOPMENT.md` | `Development` | `[Development Guide](Development)` |
| `FEATURES_COMPLETE.md` | `Features-Complete` | `[Features](Features-Complete)` |
| `CI_CD_GUIDE.md` | `CI-CD-Guide` | `[CI/CD](CI-CD-Guide)` |
| `PIPELINE_SETUP.md` | `Pipeline-Setup` | `[Pipeline](Pipeline-Setup)` |
| `SECURITY_CONFIG.md` | `Security-Config` | `[Security](Security-Config)` |
| `MVP_COMPLETE.md` | `MVP-Complete` | `[MVP](MVP-Complete)` |

### Links to Main Repo Files

For files that stayed in the main repository, use full GitHub URLs:

| File | Full GitHub URL |
|------|-----------------|
| `PROJECT_STATE.md` | `https://github.com/alexholliz/yt-dlp-ui/blob/main/PROJECT_STATE.md` |
| `TESTING_CHECKLIST.md` | `https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md` |
| `CI_CD_CHECKLIST.md` | `https://github.com/alexholliz/yt-dlp-ui/blob/main/CI_CD_CHECKLIST.md` |
| `README.md` | `https://github.com/alexholliz/yt-dlp-ui/blob/main/README.md` |

## Common Link Patterns to Fix

### In CI-CD-Guide Page

Look for and update:
```markdown
# Old
See [PIPELINE_SETUP.md](PIPELINE_SETUP.md)
See [CI_CD_CHECKLIST.md](CI_CD_CHECKLIST.md)

# New
See [Pipeline Setup](Pipeline-Setup)
See [CI/CD Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/CI_CD_CHECKLIST.md)
```

### In Development Page

Look for and update:
```markdown
# Old
See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
See [PROJECT_STATE.md](PROJECT_STATE.md)

# New
See [Testing Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md)
See [Project State](https://github.com/alexholliz/yt-dlp-ui/blob/main/PROJECT_STATE.md)
```

### In Features-Complete Page

Look for and update:
```markdown
# Old
For implementation details, see [DEVELOPMENT.md](DEVELOPMENT.md)

# New
For implementation details, see [Development Guide](Development)
```

### In Quickstart Page

Look for and update:
```markdown
# Old
For more details, see [FEATURES_COMPLETE.md](FEATURES_COMPLETE.md)

# New
For more details, see [Features](Features-Complete)
```

## Step-by-Step Cleanup Process

### For Each Wiki Page:

1. **Open the page for editing** (click "Edit" button)

2. **Search for markdown links** - Look for patterns like:
   - `[text](*.md)`
   - `[text](*.MD)`
   - References to documentation files

3. **Replace based on destination:**
   - **Wiki pages**: Use short name (e.g., `Quickstart`, `Development`)
   - **Main repo files**: Use full GitHub URL

4. **Test anchors/sections:**
   - Wiki: `[SponsorBlock](Features-Complete#sponsorblock)`
   - Repo: `[Testing](https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md#running-tests)`

5. **Save the page** and verify links work

## Special Cases

### Home Page

The Home page should link to:
- Other wiki pages using short names
- Main repo files using full URLs
- External resources using full URLs

Example Home page structure:
```markdown
## Getting Started
- [Quick Start](Quickstart)
- [Development Guide](Development)

## Reference
- [Testing Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md)
- [Project State](https://github.com/alexholliz/yt-dlp-ui/blob/main/PROJECT_STATE.md)
- [CI/CD Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/CI_CD_CHECKLIST.md)
```

### Cross-References

When pages reference each other:
```markdown
# Within wiki - use short names
See also [Development Guide](Development) and [Features](Features-Complete).

# To main repo - use full URLs
Refer to [Testing Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md).
```

## Verification Checklist

After updating links:

- [ ] All wiki-to-wiki links work (no 404s)
- [ ] All wiki-to-repo links work
- [ ] Section anchors work correctly
- [ ] No broken links in navigation
- [ ] Home page links all work
- [ ] External links (yt-dlp docs, etc.) still work

## Common Patterns by Page

### CI-CD-Guide
- References to `CI_CD_CHECKLIST.md` → Use full GitHub URL
- References to `PIPELINE_SETUP.md` → Use `Pipeline-Setup`
- References to `.github/workflows/*` → Keep as code references

### Development  
- References to `TESTING_CHECKLIST.md` → Use full GitHub URL
- References to `PROJECT_STATE.md` → Use full GitHub URL
- References to `FEATURES_COMPLETE.md` → Use `Features-Complete`

### Features-Complete
- References to other features → Use `#section-anchors`
- References to implementation → Link to `Development`
- References to testing → Use full GitHub URL to `TESTING_CHECKLIST.md`

### Quickstart
- References to detailed guides → Link to wiki pages
- References to troubleshooting → Link to relevant sections

## Automated Search & Replace

If you have access to the wiki Git repo, you can use these commands:

```bash
cd yt-dlp-ui.wiki

# Replace wiki page references
sed -i 's/QUICKSTART\.md/Quickstart/g' *.md
sed -i 's/DEVELOPMENT\.md/Development/g' *.md
sed -i 's/FEATURES_COMPLETE\.md/Features-Complete/g' *.md
sed -i 's/CI_CD_GUIDE\.md/CI-CD-Guide/g' *.md
sed -i 's/PIPELINE_SETUP\.md/Pipeline-Setup/g' *.md
sed -i 's/SECURITY_CONFIG\.md/Security-Config/g' *.md
sed -i 's/MVP_COMPLETE\.md/MVP-Complete/g' *.md

# Replace repo file references (more complex, review before applying)
sed -i 's|\(PROJECT_STATE\.md\)|https://github.com/alexholliz/yt-dlp-ui/blob/main/\1|g' *.md
sed -i 's|\(TESTING_CHECKLIST\.md\)|https://github.com/alexholliz/yt-dlp-ui/blob/main/\1|g' *.md
sed -i 's|\(CI_CD_CHECKLIST\.md\)|https://github.com/alexholliz/yt-dlp-ui/blob/main/\1|g' *.md

# Review changes
git diff

# Commit if everything looks good
git add .
git commit -m "Fix internal documentation links"
git push origin master
```

**Note**: Review the automated changes carefully before committing!

## Maintenance

When adding new documentation:

1. **New wiki page** → Update Home page with link
2. **New main repo .md** → Update README.md and relevant wiki pages with full GitHub URL
3. **Moving page** → Update all referencing pages
4. **Renaming page** → GitHub will handle redirects, but update links for clarity

## Questions?

If you're unsure about a link:
- Does it need to be updated frequently? → Keep in main repo
- Is it reference documentation? → Can go in wiki
- Is it for AI assistants? → Must stay in main repo
