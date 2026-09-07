# Extra Accounts

Watchtower can track more than one Claude or Codex login on the same machine.

This is for people who keep personal and work accounts in separate folders, then launch them with aliases such as `p-claude` / `w-claude` or `p-codex` / `w-codex`.

## How to add one

1. Open Settings.
2. Under Extra Accounts, choose Claude or Codex.
3. Give it a name, such as Claude Work.
4. Enter the config folder that alias already uses, such as `~/.claude-work` or `~/.codex-work`.
5. Add Account.

Watchtower shows that login as its own card, next to the default Claude or Codex card. You can hide either one from Provider Settings.

The default Claude and Codex cards still follow the usual folders (`~/.claude`, `~/.codex`) unless those environment variables are set in your login shell.

## What to enter

Use the folder the CLI already uses, not the alias name.

Claude aliases usually set `CLAUDE_CONFIG_DIR`. Codex aliases usually set `CODEX_HOME`. Paste the same value your alias sets. Watchtower does not expand `~` on its own, because Claude hashes that value as written.

## Codex keychain note

If two Codex logins both store auth in the macOS keychain instead of files, they can overwrite each other. Separate `CODEX_HOME` folders with `auth.json` files stay isolated.
