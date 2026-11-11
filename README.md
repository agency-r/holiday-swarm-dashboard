# Holiday Revenue Swarm — 3D Office Dashboard

Interactive 3D office dashboard for the Autonomous Holiday Revenue Swarm.

This public repo contains **only the dashboard frontend**. Production builds run in the built-in local simulator (no backend). Pass `?ws=<url>` to connect a live swarm API later.

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
