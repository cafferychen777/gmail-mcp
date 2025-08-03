# Important Files Notice

## ⚠️ Critical Files - DO NOT DELETE

The following files are essential for the project and should **NEVER** be deleted during cleanup:

### `llms-full.txt`
- **Purpose**: Contains complete LLM model information and configurations
- **Importance**: Critical for AI model integration and compatibility
- **Status**: ❌ **ACCIDENTALLY DELETED** - needs to be restored
- **Action Required**: Restore from backup or regenerate

## File Restoration Instructions

If `llms-full.txt` was accidentally deleted:

1. **Check Git History**:
   ```bash
   git log --oneline --follow -- llms-full.txt
   ```

2. **Restore from Previous Commit** (if it was tracked):
   ```bash
   git checkout HEAD~1 -- llms-full.txt
   ```

3. **If Not in Git History**:
   - Check local backups
   - Regenerate from source data
   - Contact project maintainer for restoration

## Prevention Guidelines

To prevent accidental deletion of critical files:

1. **Always Review** files before bulk deletion
2. **Use .gitignore** for temporary files instead of manual deletion
3. **Check File Importance** before removing any file
4. **Create Backups** before major cleanup operations

## Critical File Patterns to Preserve

Always preserve files matching these patterns:
- `*.txt` files in root directory (may contain important data)
- Configuration files (`*.json`, `*.yaml`, `*.toml`)
- Documentation files (`README.md`, `SETUP.md`, etc.)
- License and legal files (`LICENSE`, `CONTRIBUTING.md`)
- Core implementation files (`*.js`, `*.py` in main directories)

## Recovery Checklist

If critical files are accidentally deleted:

- [ ] Stop any ongoing operations
- [ ] Check git status and history
- [ ] Attempt restoration from git
- [ ] Check local backups
- [ ] Document what was lost
- [ ] Update this notice with lessons learned

## Contact

If you need help restoring critical files, contact the project maintainer immediately.

---

**Remember**: When in doubt, don't delete. Ask first! 🚨
