# ReleaseLens API

ReleaseLens turns a GitHub comparison for a TypeScript/JavaScript repository into customer-ready release notes and an engineering-facing migration and rollout brief.

## Architecture

GitHub webhook or Action → authenticated report request → Redis job → short-lived GitHub App installation token → deterministic evidence extraction → structured LLM synthesis → PostgreSQL report metadata.

Raw repository content and diffs are processed in memory only. The database retains generated reports and an audit event when a report is deleted.

## Setup

1. Copy `.env.example` to `.env.local` and configure Vercel, Neon/Postgres, Upstash Redis, a GitHub App, and an LLM provider.
2. Apply [`db/migrations/001_initial.sql`](db/migrations/001_initial.sql) to Postgres.
3. Register `https://<host>/api/github/webhook` as the GitHub App webhook. Request read-only **Contents**, **Pull requests**, and **Metadata** permissions.
4. Deploy to Vercel. Configure a cron or authenticated scheduler to call `/api/jobs/process` with `Authorization: Bearer $INTERNAL_JOB_TOKEN`.

`TENANT_API_KEYS` holds comma-separated `tenantId:sha256(api-key)` pairs. Generate the hash with `node -e "console.log(require('crypto').createHash('sha256').update('your-key').digest('hex'))"`.

## API

`POST /v1/reports` accepts a Bearer tenant key and `{ repository, base, head, installationId, audience }`; it returns `202` and a report ID. `GET /v1/reports/:id` returns its current state and Markdown when complete. `POST /v1/reports/:id/delete` permanently deletes retained metadata and records a deletion audit event. Vercel also exposes the underlying `/api/v1/*` paths.

## GitHub Action

Use the local [`action`](action) directory as an Action until it is published:

```yaml
- uses: ./action
  with:
    api-url: ${{ vars.RELEASELENS_URL }}
    api-key: ${{ secrets.RELEASELENS_API_KEY }}
    installation-id: ${{ vars.RELEASELENS_INSTALLATION_ID }}
    base: ${{ github.event.before }}
    head: ${{ github.sha }}
```

## Commands

`npm test` runs the focused security, analysis, and service tests. `npm run build` type-checks the project.
