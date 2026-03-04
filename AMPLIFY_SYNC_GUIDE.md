# Amplify Build Sync Guide

This guide ensures your local builds match Amplify's cloud builds exactly.

## ✅ One-time Setup (Already Done)

### 1. Amplify uses `npm ci`
- **File**: `amplify.yml` 
- **Setting**: `preBuild.commands: npm ci`
- This makes Amplify install exactly what's in `package-lock.json`

### 2. Node version pinned in both places
- **Local**: `.nvmrc` contains `18.20.8`
- **Amplify**: `amplify.yml` installs and uses Node 18.20.8
- Both environments now use the exact same Node version automatically
- No manual Amplify Console configuration needed!

## 📋 Day-to-Day Workflow

### When you add/update a dependency:

1. **Switch to the repo's Node version**
   ```bash
   nvm use
   ```

2. **Add the dependency with npm install**
   ```bash
   npm install <pkg>
   # or
   npm install -D <pkg>
   ```
   This updates **both** `package.json` and `package-lock.json`

3. **Commit both files**
   ```bash
   git add package.json package-lock.json
   git commit -m "Add <pkg>"
   ```

4. **Sanity check (before pushing)**
   ```bash
   rm -rf node_modules
   npm ci
   npm run build
   ```
   If this passes locally, Amplify should behave the same.

## 🔍 Why This Works

- **`.nvmrc`**: Pins Node version locally (run `nvm use` to activate)
- **`amplify.yml`**: Pins Node version in Amplify (runs `nvm install` and `nvm use`)
- **`npm ci`**: Installs exact versions from `package-lock.json` (no surprises)
- **`package-lock.json`**: Committed to git, so Amplify sees the same dependency tree
- **Sanity check**: Simulates exactly what Amplify will do

## 🚨 Troubleshooting

If Amplify builds fail but local builds work:

1. Check that `amplify.yml` has the correct Node version commands
2. Verify `amplify.yml` uses `npm ci` (not `npm install`)
3. Ensure `package-lock.json` is committed
4. Run the sanity check locally to reproduce the issue
5. Check Amplify build logs to see the Node version being used (`node -v` output)

## 📁 Files Created

- `.nvmrc` - Node version for local development (18.20.8)
- `amplify.yml` - Amplify build configuration with Node version pinning
- `AMPLIFY_SYNC_GUIDE.md` - This guide

## 🎯 What the amplify.yml does

```yaml
preBuild:
  commands:
    - nvm install 18.20.8  # Install the exact Node version
    - nvm use 18.20.8      # Activate it
    - node -v              # Verify version (shows in build logs)
    - npm ci               # Clean install from package-lock.json
```

This ensures Amplify uses Node 18.20.8, matching your local `.nvmrc` file.
