# Release Guide

This repository uses GitHub Actions to automatically create releases when tags are pushed.

## Creating a Release

1. **Update version in package.json** (if needed):
   ```bash
   cd gmail-mcp-extension/mcp-server
   npm version patch|minor|major
   ```

2. **Create and push a git tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. **The GitHub Action will automatically**:
   - Run tests
   - Create a release package
   - Generate changelog from git commits
   - Create a GitHub release with the packaged extension

## Version Numbering

Use semantic versioning (semver):
- `v1.0.0` - Major version (breaking changes)
- `v1.0.1` - Patch version (bug fixes)
- `v1.1.0` - Minor version (new features, backward compatible)

## Manual Release

If you need to create a release manually:

```bash
# Create the package
mkdir -p release
cd gmail-mcp-extension
zip -r ../release/gmail-mcp-extension-v1.0.1.zip extension/ mcp-server/ *.md *.sh LICENSE

# Create release on GitHub
gh release create v1.0.1 ../release/gmail-mcp-extension-v1.0.1.zip --title "Gmail MCP Extension v1.0.1" --notes "Release notes here"
```

## Troubleshooting

- Make sure the tag follows the format `v*.*.*` (e.g., `v1.0.0`)
- Ensure all tests pass before creating a release
- Check that the package.json version matches the tag version