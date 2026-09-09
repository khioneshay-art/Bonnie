# BONNIE

Bonnie is a standalone, conversation-first intelligence layer over the existing PITCH data.

## Architecture

Browser → Supabase → secure `bonnie-ai` Edge Function → AI model

The browser contains only the Supabase publishable key. The AI secret belongs in the Edge Function environment.

## 1. Add Bonnie tables

Open Supabase SQL Editor and run `supabase/schema.sql`.

This SQL is additive. It creates only `bonnie_*` tables and does not drop, truncate, rename, migrate, or delete PITCH data.

## 2. Configure PITCH business mapping

`app.js` intentionally uses read-only candidate discovery for:
- `businesses`
- `pitch_businesses`
- `companies`

If PITCH uses another table, change the `candidates` array and the name fallbacks in `loadBusinesses()`.

Do not guess or alter the PITCH schema. If RLS blocks browser reads, grant the existing authenticated users appropriate SELECT access according to the PITCH security model.

## 3. Configure AI

Deploy the Edge Function:

```bash
supabase functions deploy bonnie-ai
supabase secrets set OPENAI_API_KEY="YOUR_PRIVATE_KEY"
supabase secrets set BONNIE_MODEL="gpt-5-mini"
```

Never put the OpenAI key in `index.html`, `app.js`, GitHub, or Cloudflare Pages.

The Edge Function is deliberately the only place that talks to the AI provider. The Settings → AI Configuration screen can test whether that secure reasoning layer is configured and reachable without revealing the secret.

## 4. Authentication

Bonnie intentionally does not contain its own sign-up/sign-in UI. It uses the authenticated Supabase session if one already exists. If your PITCH authentication/session is shared with the same Supabase project, Bonnie can use that session.

If the PITCH session is not shared across the standalone origin, configure the existing Supabase auth flow separately rather than creating a second identity system inside Bonnie.

## 5. Deploy

### GitHub

Create a repository and upload the project files.

### Cloudflare Pages

Create a Pages project from the repository:
- Framework preset: None
- Build command: leave blank
- Output directory: `/`

Deploy.

The Supabase Edge Function is deployed separately through Supabase.

## Safety

Bonnie does not perform destructive operations. The frontend never sends a service-role key. PITCH data is treated as read-only context.
