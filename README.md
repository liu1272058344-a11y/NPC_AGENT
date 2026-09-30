# React + TypeScript + Vite

## Remote image asset storage

Generated images are persisted in Vercel Blob and indexed in Neon Postgres. Each anonymous browser workspace may keep up to 20 images or 100 MB. Images expire 30 days after saving and the daily Vercel Cron removes expired objects.

Configure `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, and `CRON_SECRET` from `.env.example`, then apply `db/migrations/001_remote_asset_library.sql` to Neon before deployment. The browser stores only `npc-forge-workspace-id`; image bytes and Base64 data are never stored in localStorage.

The production smoke check must cover save, refresh/list, archive tabs, zoom, download, delete, quota rejection, and one authorized cleanup request.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
