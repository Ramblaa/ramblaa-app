# 🚀 Ramble Git Workflow Guide

This guide outlines the robust version control and deployment workflow for the Ramble project.

## 📋 Branch Strategy

```
main (production)     ← Railway Production Environment
├── develop (staging) ← Railway Staging Environment  
    ├── feature/new-feature
    ├── feature/bug-fix
    └── hotfix/urgent-fix
```

## 🔄 Daily Workflow

### Starting New Work
```bash
# Always start from develop
git checkout develop
git pull origin develop

# Create feature branch
git checkout -b feature/your-feature-name
git push -u origin feature/your-feature-name
```

### Regular Development
```bash
# Commit frequently with conventional commits
git add .
git commit -m "feat: add new functionality"
git push

# Or use shortcuts
git commit -m "fix: resolve sandbox styling issue"
git commit -m "docs: update API documentation" 
git commit -m "style: improve button spacing"
```

### Before Merging
```bash
# Rebase to keep history clean
git checkout develop
git pull origin develop
git checkout feature/your-feature-name
git rebase develop
git push --force-with-lease origin feature/your-feature-name
```

## 🚢 Deployment Pipeline

### Staging Deployment (Railway)
```bash
# Deploy to staging
git deploy-staging

# Or manually:
git checkout develop
git pull origin develop
git push origin develop
# → Railway auto-deploys to staging
```

### Production Deployment (Railway)
```bash
# Deploy to production  
git deploy-production

# Or manually:
git checkout main
git pull origin main
git push origin main
# → Railway auto-deploys to production
```

## 🛡️ Backup System

### Automated Backups
- **Daily**: GitHub Actions runs automated backups at 2 AM UTC
- **Push Events**: Backup triggers on pushes to main/develop
- **Retention**: 30 days of backup artifacts

### Manual Backup
```bash
# Run complete backup
git backup

# Or run the script directly
./backup-git.sh
```

### Backup Contents
- 📦 **Bundle backup**: Complete repository with all history
- 🪞 **Local mirror**: Bare repository clone  
- 📄 **Patch files**: Individual commit patches
- 🏥 **Health report**: Repository status and metrics

## 🔧 Useful Git Aliases

```bash
# Already configured for you:
git backup           # Run backup script
git deploy-staging   # Deploy to staging
git deploy-production # Deploy to production

# Additional useful commands:
git log --oneline --graph --all  # Visual commit graph
git status -s                    # Short status
git diff --staged                # Preview staged changes
```

## 🆘 Emergency Procedures

### Quick Rollback Production
```bash
git checkout main
git revert HEAD
git push origin main
```

### Force Rollback to Specific Commit
```bash
git checkout main
git reset --hard <commit-hash>
git push --force-with-lease origin main
```

### Recover from Backup
```bash
# From bundle backup
git clone ../rambley-backups/rambley-admin-YYYYMMDD.bundle recovered-repo

# From mirror backup  
git clone ../rambley-backups/rambley-admin-mirror.git recovered-repo
```

## 📊 Repository Health Checks

### Daily Health Check
```bash
# Check repository integrity
git fsck --full

# Verify remote sync
git remote -v
git branch -vv

# Check for uncommitted changes
git status --porcelain
```

### Performance Optimization
```bash
# Clean up repository
git gc --aggressive --prune=now

# Remove untracked files
git clean -fdx
```

## 🔒 Security Best Practices

### Branch Protection (GitHub)
- ✅ Require pull request reviews
- ✅ Require status checks  
- ✅ Require branches to be up to date
- ✅ Restrict pushes to main/develop

### Commit Signing (Optional)
```bash
# Set up GPG signing
git config --global user.signingkey <your-gpg-key>
git config --global commit.gpgsign true
```

## 🌍 Multiple Remote Setup (Optional)

### Add Backup Remote
```bash
# Add GitLab as backup remote
git remote add backup https://gitlab.com/harrisonbudd/rambley-admin.git

# Push to both remotes
git push origin main
git push backup main
```

### Push to All Remotes
```bash
# Configure to push to multiple remotes
git remote set-url --add --push origin https://github.com/harrisonbudd/rambley-admin.git
git remote set-url --add --push origin https://gitlab.com/harrisonbudd/rambley-admin.git
```

## 📈 Monitoring & Alerts

### Railway Dashboard
- Monitor deployment status
- Check application logs: `railway logs`
- View metrics and performance

### GitHub Actions
- Check backup job status
- Download backup artifacts
- Monitor workflow health

## 🎯 Best Practices

1. **Commit Often**: Small, focused commits are easier to review and revert
2. **Write Good Messages**: Use conventional commit format
3. **Test Before Push**: Run local tests before pushing
4. **Keep Branches Updated**: Regularly rebase feature branches
5. **Clean History**: Use rebase instead of merge for feature branches
6. **Backup Regularly**: Run manual backups before major changes

## 🆘 Support

For questions or issues with the Git workflow:
1. Check this guide first
2. Review backup health reports
3. Contact the development team
4. Create an issue in the repository

---

**Last Updated**: $(date)  
**Repository**: https://github.com/harrisonbudd/rambley-admin 