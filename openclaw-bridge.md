# OpenClaw ↔ SaturdAI (localhost bridge)

This repo exposes a localhost-only bridge on the backend so OpenClaw can call SaturdAI features as tools.

## Backend setup

In `/Users/jaehyeongpark/Programming/hackathons/qhacks2026/backend/.env`:

```bash
OPENCLAW_API_KEY=your-long-random-secret
OPENCLAW_USER_EMAIL=you@gmail.com
```

Notes:
- `OPENCLAW_API_KEY` is a shared secret you generate.
- `OPENCLAW_USER_EMAIL` must already exist in the DB (create it by signing in once via the app’s Google OAuth flow).
- The bridge only accepts requests from `127.0.0.1` / `::1`.

Health check:

```bash
curl -s -H "Authorization: Bearer $OPENCLAW_API_KEY" http://127.0.0.1:8000/openclaw/health
```

## OpenClaw plugin (workspace-local)

This repo includes an OpenClaw plugin at:
- `/Users/jaehyeongpark/Programming/hackathons/qhacks2026/.openclaw/extensions/saturdai-bridge`

It registers tools like:
- `saturdai_digest`, `saturdai_inbox_list`, `saturdai_tasks_list`
- Side-effect tools are registered as optional: `saturdai_reply_send`, `saturdai_calendar_create`, `saturdai_task_complete`

## OpenClaw config

Put the API key in OpenClaw’s env file:

```bash
mkdir -p ~/.openclaw
printf "OPENCLAW_API_KEY=%s\n" "$OPENCLAW_API_KEY" >> ~/.openclaw/.env
```

Then add the plugin config entry to `~/.openclaw/openclaw.json` (JSON5):

```js
{
  plugins: {
    entries: {
      "saturdai-bridge": {
        enabled: true,
        config: {
          baseUrl: "http://127.0.0.1:8000",
          apiKey: "${OPENCLAW_API_KEY}",
          timeoutMs: 15000,
        },
      },
    },
  },
}
```

Restart the OpenClaw gateway after changing config so it reloads plugins/config.
