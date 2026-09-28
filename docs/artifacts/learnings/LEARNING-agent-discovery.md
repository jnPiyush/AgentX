---
title: Select One Frontier Agent Discovery Source
description: Avoid duplicate workspace and extension agents without deleting definitions or disabling other customizations.
---

## Root cause and correction

- A renamed workspace agent and the installed extension's older display name
  are separate identities. Loading both sources creates paired picker entries.
  This does not prove that two extension versions are active.
- Agent Host can discover workspace agents natively even when a local-host
  folder setting excludes that directory. Gate the extension's own `chatAgents`
  contributions with a supported `when` condition instead of editing installed
  assets or synchronized plugin caches.
- Keep bundled discovery enabled by default. A repository maintaining its own
  agents selects `frontier.useBundledAgents: false` and enables `.github/agents`.
  Do not disable skills, instructions, prompts, commands, sidebars or runtime.
- Names in `agents`, `handoffs[].agent`, and prompt `agent` metadata must resolve
  to the current definition names. Update those references when names change.
- Test the actual host's contributed-agent count with the preference enabled,
  disabled, and re-enabled. Static manifest checks alone do not prove filtering.
- Reload the window and start a new session after changing discovery sources;
  an existing session can retain its prior customization snapshot.
