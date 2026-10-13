# BREACH / INTEL

**Official website codebase — UI-only foundation, built from the interactive investor demo.**

A React + TypeScript + Vite project for an independent Rainbow Six Siege analytics platform. Includes the existing screens, fictional demo data, round explorer, match history, team and player analytics, map/operator intelligence, comparisons, live-feed simulation, manual annotations, and CSV/JSON demo exports.

> **Demo only.** No real Ubisoft connection, database, authentication, or backend exists yet. All match/player data is fictional. "Live" is simulated. Manual entries are browser-local.

## Start in VS Code (Windows)

1. Install [Node.js 22 LTS](https://nodejs.org/) and [Git for Windows](https://git-scm.com/download/win) if needed.
2. Extract the full ZIP, including the **hidden `.git` folder**. Open the outer `breach-intel-website` folder with **File → Open Folder** in VS Code.
3. Open **Terminal → New Terminal** and run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open **http://localhost:5173/#/overview**.
5. Edit `src/App.tsx` or `src/styles.css` and save: Vite reloads the site automatically.

**Easier launch:** On Windows, double-click `start-dev.bat` to install dependencies (if needed) and start Vite. You can also press `Ctrl+Shift+B` to run the production build, or, **after starting `npm run dev`**, open **Run and Debug** → **BREACH: Debug Website (Chrome)** to launch a debugger.

**If you are offline:** `standalone-demo/index.html` opens directly in a browser, with no setup. This is a **frozen snapshot** for presentations and does **not** reflect later edits to `src/` until you build the Vite site.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install React, Vite and development dependencies |
| `npm run dev` | Start VS Code-friendly development server with hot reload |
| `npm run dev:network` | Expose dev server on your LAN (only on networks you trust) |
| `npm run typecheck` | Type-check newer source files |
| `npm run build` | Type-check and produce deployable static website in `dist/` |
| `npm run preview` | Preview a production build at `http://localhost:4173` |

**Note on type checking:** The imported 81 KB prototype `src/App.tsx` uses `// @ts-nocheck` to preserve the working investor demo during this tooling migration. New files have normal strict TypeScript checking. Refactor screens and fixture logic into typed modules progressively; see `docs/ROADMAP.md`.

## Link your own GitHub and push changes

The downloaded ZIP includes an **initialized Git repository on the `main` branch with a first commit**. No GitHub account, URL, or credentials are embedded.

1. Create a new **empty** repository on [GitHub](https://github.com/new), e.g. `breach-intel-website`. **Do not** select "Add a README", a `.gitignore` template, or a license (they are already here).
2. In the VS Code terminal (replace `YOUR_USERNAME`):

   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/breach-intel-website.git
   git push -u origin main
   ```

   Or use the guided script:

   ```powershell
   .\scripts\connect-github.ps1 -RepoUrl "https://github.com/YOUR_USERNAME/breach-intel-website.git"
   ```

   You may be prompted to sign into GitHub by Git Credential Manager; don't paste passwords or access tokens into source files.

3. For every future update, use the VS Code **Source Control** tab: stage changes (`+`) → enter a commit message → **Commit** → **Sync Changes / Push**. Terminal equivalent:

   ```powershell
   git add .
   git commit -m "Describe what changed"
   git push
   ```

The repo includes `.gitignore`, `.gitattributes`, `.editorconfig`, VS Code tasks, a build-check GitHub Action, and basic hosting config. **Do not remove the hidden `.git` folder** if you want VS Code to recognize this local repository. If your target GitHub repo is not empty, see `docs/GIT_GITHUB_SETUP.md` before pushing.

## Source layout

```text
breach-intel-website/
├── .git/                      Local Git history (included in download)
├── .github/workflows/ci.yml   Build checks on pushes / pull requests
├── .vscode/                   VS Code tasks, debugger, editor settings
├── src/
│   ├── main.tsx               Modern React browser entry point
│   ├── App.tsx                Existing interactive prototype screens
│   ├── styles.css             Full UI design system and page styles
│   └── vite-env.d.ts          Vite types
├── public/                    Static assets
├── standalone-demo/           Frozen offline presentation backup
├── docs/                      Git, architecture, roadmap, demo guide
├── scripts/                   GitHub remote connection helpers
├── index.html                 Vite HTML entry
├── package.json               Dependencies and scripts
├── vite.config.ts             Dev/build configuration
├── tsconfig.json              Strict TS config for new modules
├── netlify.toml               Optional static site deployment
└── start-dev.bat              Quick Windows launcher
```

## Where we go from here

This repo is the source of truth for the **eventual official website**. Do new UI work under `src/`—not in the `standalone-demo/` backup. Priorities: move mock data to typed fixtures, split the large demo component into routes/screens and reusable components, add authentication and real data adapters **after** the UI is finalized. See `docs/ROADMAP.md` and `docs/ARCHITECTURE.md`.

For an investor presentation, follow `docs/INVESTOR_DEMO_GUIDE.md`.

## Intellectual property / disclaimer

Independent product concept, not affiliated with or endorsed by Ubisoft. Rainbow Six Siege names are used descriptively. Demo players and all match results are fictional. Confirm trademark, intellectual property and data-access requirements before the public launch.
