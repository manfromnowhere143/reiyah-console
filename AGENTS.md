# Reiyah Console repository instructions

This is the Harbor Instrument UI/UX repository:
`/Users/danielwahnich/workspace/reiyah-console`, remote
`https://github.com/manfromnowhere143/reiyah-console.git`.
Read `HANDOFF.md` at the start of each task and preserve unrelated working changes.

## Operator-authorized routing

Daniel explicitly authorizes Console tasks from sessions started in
`/Users/danielwahnich/workspace/reiyah`. Use this repository's explicit working
directory, verify its Git root and remote, and proceed. A different session
startup directory is not a reason to demand a relaunch or repeated permission.
Engine Gate A/bootstrap/history restrictions govern the engine, not this UI repo.
Do not modify or bootstrap the engine as part of a Console task.

## Rule number one: human commit attribution

Never credit Claude, Claude Code, or an Anthropic model as author, committer,
contributor, or co-author in commits. Do not add generated-by notices or
Claude-Session trailers. Preserve the configured human identity and other humans'
legitimate attribution. Daniel is the existing author and committer for this repo.

Project Claude attribution is disabled in `.claude/settings.json`. The local
commit hook rejects prohibited credits; activate it in new checkouts with
`git config core.hooksPath .githooks`.

History changes require the operator's explicit scope, an external recovery copy,
and verification that only the intended metadata changed. Publish rewritten refs
with an explicit expected old SHA, and preserve unrelated remote changes.

For UI changes, follow the build, browser checks and production readback in
`HANDOFF.md`. A commit metadata/instructions change does not require resealing
evidence or rebuilding unchanged application code.
