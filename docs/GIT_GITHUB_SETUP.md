# Git, GitHub and VS Code workflow

## First time only

1. Install Git for Windows and Node.js 22 LTS; restart VS Code.
2. Open `breach-intel-website` (the folder containing `package.json`) in VS Code.
3. Check the Source Control icon on the left. You should see **main** because the ZIP contains `.git/`.
4. Before your first new commit, if Git asks you to set an author identity, run `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`.
5. Make an empty GitHub repository (do not pre-create a README/license/.gitignore).
6. Copy the **HTTPS clone URL** and use either:

   ```powershell
   .\scripts\connect-github.ps1 -RepoUrl "https://github.com/YOUR_USERNAME/breach-intel-website.git"
   ```

   or:

   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/breach-intel-website.git
   git push -u origin main
   ```

The script only adds your `origin` remote if not present and then executes the first push. If push fails due to permissions, sign in to GitHub from VS Code or Git Credential Manager and retry. A GitHub login is still required; none is bundled with the project.

If the GitHub repo already has a commit, pushing may fail with "fetch first". For a brand-new app, the simplest safe option is to create a new *empty* repository and connect to that. If you need an existing repo, fetch its history and plan a merge; do not force-push over someone else's work.

## Everyday workflow

1. `npm run dev`; leave that terminal running.
2. Edit `src/App.tsx` or `src/styles.css`, save, and confirm the browser updates.
3. In Source Control, review the diff and stage relevant files.
4. Commit with a descriptive message, e.g. `Add improved operator filters`.
5. Click **Sync Changes** or run `git push`.

For bigger changes, use feature branches:

```powershell
git switch -c feature/match-detail
# edit and test
git add .
git commit -m "Improve match detail UI"
git push -u origin feature/match-detail
```

Open a pull request to `main`; GitHub Actions runs a typecheck and website build. Protect `main` once working with collaborators.

## First npm install creates the lockfile

The starter uses pinned version ranges, but does not ship `package-lock.json` because this build environment cannot reach npm. After your first `npm install`, **commit the generated `package-lock.json`** to make future installations reproducible. Then change the CI workflow install step from `npm install` to `npm ci` (optional improvement).

## Security

- Never commit `.env`, credentials, cookies, access tokens, or user data. `.gitignore` excludes `.env` files.
- `VITE_` variables are built into browser-facing JS; they are never secret.
- Before making the site public, replace demo placeholder information and check rights to product/game assets.
