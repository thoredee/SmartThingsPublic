# SmartThings Public Repo — Claude Context

This is Thore's personal repo. It contains legacy SmartThings device handlers/smartapps plus new standalone projects added over time.

## Projects in this repo

| Folder | What it is | Status |
|--------|-----------|--------|
| `space-nk-agent/` | Monthly Space NK review agent for Immy | Active — see `space-nk-agent/CLAUDE.md` |
| `devicetypes/` | Legacy SmartThings device type handlers | Old — not actively worked on |
| `smartapps/` | Legacy SmartThings smart apps | Old — not actively worked on |

## Repo details

- **GitHub:** `thoredee/smartthingspublic`
- **Active branch for Space NK work:** `claude/space-nk-review-agent-4Xjyn`
- Platform: Windows (Thore's laptop), Python 3.14

## Session startup

When picking up work in this repo:
1. Check which project/folder the user is referring to
2. Read the relevant `CLAUDE.md` inside that project folder
3. Run `git status` to see current branch and any uncommitted changes

## Working rules

- Always `cd` into the right project subfolder before running commands
- Push changes to the active branch, not main
- `review_history.json` in `space-nk-agent/` must never be deleted — it's Immy's review history
