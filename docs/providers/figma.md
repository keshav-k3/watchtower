# Figma AI Credits — Feasibility Note

> Verdict: **not feasible** for a Watchtower provider today. No plugin was implemented. Revisit if Figma opens a user-level usage endpoint.

## The Question

Can Watchtower show Figma AI credit usage using only (a) an official, documented API with a personal access token, or (b) a local Figma desktop app cache — never cookie scraping or private/undocumented endpoints?

## Findings

1. **An official AI Usage API exists** — `GET /v1/ai_usage/daily` returns per-user, per-day AI credit consumption (seat-level and plan-level credits, by editor type, with metering period boundaries). It is documented and stable.
2. **But it is Enterprise-admin-only** — the endpoint requires a *plan access token*, which only organization administrators on an Enterprise plan can create. Plan access tokens are not personal access tokens and are not tied to a user account; a regular PAT cannot hold the required `org:ai_metering_usage_read` scope and gets a 403.
3. **It reports consumption, not remaining balance** — deriving "remaining" would require hardcoding the published per-plan seat allocations (e.g. 3,500 credits/month for Organization full seats, 4,250 for Enterprise) and daily caps, which can change.
4. **No documented local desktop cache** — the Figma desktop app's `~/Library/Application Support/Figma` holds Chromium caches, session data, and offline design files. Nothing documents a local file containing AI credit usage; credit state is server-side.
5. **Individuals see their own usage only in-product** — Figma's help docs point individual users to the file menu / admin dashboard; there is no user-level API equivalent.

## Conclusion

The only documented, sound route is the Enterprise AI Usage API with an org-admin-issued plan access token — a different audience and UX from Watchtower's individual-user providers, and it still would not show a remaining balance without hardcoding plan tables. There is no documented local cache to read instead. Per the project rule against private/undocumented endpoints and cookie scraping, no Figma plugin is shipped.

## Sources

- [Figma Developer Docs — AI Usage endpoints](https://developers.figma.com/docs/rest-api/ai-usage-endpoints/) — `GET /v1/ai_usage/daily`; Enterprise-only; requires a plan access token; 5–6 hour data lag.
- [Figma Developer Docs — Plan access tokens](https://developers.figma.com/docs/rest-api/plan-access-tokens/) — admin-managed, not tied to individual users, distinct from PATs/OAuth.
- [Figma Help — Manage AI credits](https://help.figma.com/hc/en-us/articles/35865276858647-Manage-AI-credits) — admin dashboard tracking; confirms the AI Usage API requires a plan access token on Enterprise.
- [Figma Help — How Figma AI credits work](https://help.figma.com/hc/en-us/articles/33459875669015-How-Figma-AI-credits-work) — per-plan seat allocations and daily limits.
- [Figma Help — Clear the Figma desktop app cache](https://help.figma.com/hc/en-us/articles/22380853110551-Clear-the-Figma-desktop-app-cache) — what the local desktop cache contains (rendering/UI/session), nothing about AI credit state.
