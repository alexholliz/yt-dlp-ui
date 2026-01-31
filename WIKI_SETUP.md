# Wiki Setup Instructions

## Overview

This repository's documentation has been migrated to the GitHub Wiki for better organization and discoverability. The wiki is accessible at:

https://github.com/alexholliz/yt-dlp-ui/wiki

## Files to Move

The following markdown files should be copied to the wiki:

| Repository File | Wiki Page Name | Description |
|----------------|----------------|-------------|
| `QUICKSTART.md` | `Quickstart` | 5-minute getting started guide |
| `DEVELOPMENT.md` | `Development` | Architecture, API, and contributing |
| `FEATURES_COMPLETE.md` | `Features-Complete` | Comprehensive feature list |
| `CI_CD_GUIDE.md` | `CI-CD-Guide` | Pipeline setup and deployment |
| `CI_CD_CHECKLIST.md` | `CI-CD-Checklist` | Post-deployment verification |
| `PIPELINE_SETUP.md` | `Pipeline-Setup` | Quick GitHub Actions reference |
| `SECURITY_CONFIG.md` | `Security-Config` | Authentication and security |
| `MVP_COMPLETE.md` | `MVP-Complete` | Initial release notes |

**Note**: `PROJECT_STATE.md` and `TESTING_CHECKLIST.md` remain in the main repository as they are actively used by AI assistants and developers.

## How to Set Up the Wiki

### Option 1: Manual Copy (Simplest)

1. Go to https://github.com/alexholliz/yt-dlp-ui/wiki
2. Click "Create the first page" (if wiki is new)
3. For each file above:
   - Click "New Page"
   - Set the page title (e.g., "Quickstart")
   - Copy content from the .md file
   - Click "Save Page"

### Option 2: Using Git (Advanced)

The GitHub wiki is actually a Git repository. You can clone and push to it:

```bash
# Clone the wiki repository
git clone https://github.com/alexholliz/yt-dlp-ui.wiki.git

# Copy files
cd yt-dlp-ui.wiki
cp ../yt-dlp-ui/QUICKSTART.md Quickstart.md
cp ../yt-dlp-ui/DEVELOPMENT.md Development.md
cp ../yt-dlp-ui/FEATURES_COMPLETE.md Features-Complete.md
cp ../yt-dlp-ui/CI_CD_GUIDE.md CI-CD-Guide.md
cp ../yt-dlp-ui/CI_CD_CHECKLIST.md CI-CD-Checklist.md
cp ../yt-dlp-ui/PIPELINE_SETUP.md Pipeline-Setup.md
cp ../yt-dlp-ui/SECURITY_CONFIG.md Security-Config.md
cp ../yt-dlp-ui/MVP_COMPLETE.md MVP-Complete.md

# Create Home page
cat > Home.md << 'EOF'
# yt-dlp-ui Documentation

Welcome to the yt-dlp-ui documentation wiki!

## Getting Started

- **[Quick Start Guide](Quickstart)** - Get up and running in 5 minutes
- **[Development Guide](Development)** - Architecture, API, and contributing

## Features & Capabilities

- **[Features Complete](Features-Complete)** - Comprehensive feature list
- **[SponsorBlock Integration](Features-Complete#sponsorblock-integration)** - Skip or remove sponsored segments

## Operations

- **[CI/CD Guide](CI-CD-Guide)** - Pipeline setup and deployment
- **[CI/CD Checklist](CI-CD-Checklist)** - Post-deployment verification
- **[Pipeline Setup](Pipeline-Setup)** - Quick reference for GitHub Actions
- **[Testing Strategy](Testing-Checklist)** - How we test and maintain quality
- **[Security Configuration](Security-Config)** - Authentication and security settings

## Project Information

- **[MVP Complete](MVP-Complete)** - Initial release notes

**In Main Repository:**
- [Project State](https://github.com/alexholliz/yt-dlp-ui/blob/main/PROJECT_STATE.md) - Current status, history, and roadmap (AI assistant reference)
- [Testing Checklist](https://github.com/alexholliz/yt-dlp-ui/blob/main/TESTING_CHECKLIST.md) - Test architecture and best practices

## External Links

- [GitHub Repository](https://github.com/alexholliz/yt-dlp-ui)
- [Container Registry](https://github.com/alexholliz/yt-dlp-ui/pkgs/container/yt-dlp-ui)
- [Issue Tracker](https://github.com/alexholliz/yt-dlp-ui/issues)
EOF

# Commit and push
git add .
git commit -m "Initialize wiki with documentation from main repository"
git push origin master
```

### Option 3: GitHub Web Interface (Recommended)

1. Navigate to https://github.com/alexholliz/yt-dlp-ui/wiki
2. Click "+ New Page" button
3. Create each page with the proper title
4. Copy/paste content from the markdown files
5. Click "Save Page"

**Tip**: Start with the Home page first, then create the other pages in order.

## After Wiki is Set Up

### In Main Repository

Once wiki pages are live, you can optionally remove the old markdown files:

```bash
# In main repository
git rm QUICKSTART.md DEVELOPMENT.md FEATURES_COMPLETE.md \
       CI_CD_GUIDE.md CI_CD_CHECKLIST.md PIPELINE_SETUP.md \
       SECURITY_CONFIG.md MVP_COMPLETE.md

git commit -m "Remove documentation files (moved to wiki)"
git push origin main
```

**Keep these files in main repo:**
- ✅ `README.md` - Main project readme
- ✅ `PROJECT_STATE.md` - Project history and AI assistant context
- ✅ `TESTING_CHECKLIST.md` - Testing reference (actively used)
- ✅ `WIKI_SETUP.md` - Wiki setup instructions
- ✅ `LICENSE` - Project license
- ✅ `docker-compose.yml` - Deployment config
- ✅ `.github/` - CI/CD workflows

## Wiki Maintenance

### Updating Documentation

To update wiki pages:

1. Go to the wiki page you want to edit
2. Click "Edit" button (top right)
3. Make your changes
4. Click "Save Page"

### Linking Between Pages

Use relative links in markdown:
```markdown
[Quick Start](Quickstart)
[Development Guide](Development)
[Testing Strategy](Testing-Checklist)
```

### Keeping Sync with Main Repo

If you make changes to documentation in the main repo before migrating:

```bash
# In wiki repo
git pull origin master
cp ../yt-dlp-ui/QUICKSTART.md Quickstart.md  # Update specific file
git commit -am "Update Quickstart guide"
git push origin master
```

## Verification

After setup, verify all links work:

1. Check README.md links point to wiki
2. Test each wiki page loads
3. Verify internal wiki links work
4. Test external links (GitHub repo, etc.)
5. Check formatting is preserved

## Troubleshooting

**Wiki not accessible?**
- Enable wiki in repository settings: Settings → Features → Wikis

**Can't push to wiki repo?**
- Ensure you have write access to the repository
- Wiki must be initialized (create first page via web UI)

**Formatting looks wrong?**
- GitHub wiki uses GitHub Flavored Markdown
- Some extensions may not be supported
- Check for unsupported syntax

## Benefits of Wiki

✅ **Better Organization** - Hierarchical structure  
✅ **Easier Discovery** - Searchable, categorized  
✅ **Cleaner Repo** - Less clutter in main directory  
✅ **Version Controlled** - Full Git history  
✅ **Easy Contributions** - Web-based editing  
✅ **Professional** - Standard for open source projects

## Current Status

- ✅ README.md updated with wiki links
- ✅ UI footer added with "Docs" link
- ✅ TESTING_CHECKLIST.md created
- ⏳ Wiki pages need to be created (manual step)
- ⏳ Old .md files can be removed after wiki is populated

## Next Steps

1. Follow Option 1, 2, or 3 above to create wiki pages
2. Verify all pages are accessible
3. Test links from README.md
4. (Optional) Remove old .md files from main repo
5. Update PROJECT_STATE.md to mark wiki as complete
