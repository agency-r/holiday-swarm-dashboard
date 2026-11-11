# Holiday Revenue Swarm — 3D Office Dashboard

Interactive 3D office dashboard for the Autonomous Holiday Revenue Swarm.

This public repo contains **only the dashboard frontend**. The live site reads a public, aggregate-only `data/sales.json` snapshot (Gumroad totals, no buyer details) that a scheduled GitHub Action refreshes about every 15 minutes. Agent motion in the 3D office is still simulated and labeled as such.

Query flags:

- Default on the deployed site: live Gumroad numbers
- `?sim=1` or `?local=1` — full local simulator (fake revenue)
- `?warp=<hours>` — fast-forward the local simulator
- `?live=1` — force live Gumroad mode (useful in local dev if `data/sales.json` is present)
- `?ws=<url>` — connect a live swarm API

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:5173

## DigitalOcean App Platform (free static site)

Create a static-site-only app from this repo. Do not add a web service, worker, database, or functions component (those are paid).

The `git.repo_clone_url` form works for this public repository without installing the DigitalOcean GitHub app:

```yaml
name: holiday-revenue-swarm
static_sites:
  - name: dashboard
    git:
      branch: main
      repo_clone_url: https://github.com/agency-r/holiday-swarm-dashboard.git
    environment_slug: node-js
    build_command: npm ci && npm run build
    output_dir: dist
    index_document: index.html
    catchall_document: index.html
```
