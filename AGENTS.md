# Repository automation policy

These instructions apply to every task in this repository.

- When a task changes repository files, complete the release workflow before the final response unless the user explicitly says not to: validate the change, update relevant documentation and code comments, commit the intended files, and push the current branch to its configured remote.
- Report the commit, push, deployment, migration, and verification results in the final response. If the repository uses a pull request or review thread, leave an appropriate concise implementation/status comment there when access is available.
- Automatically perform required Vercel work for application or infrastructure changes, including project linking, environment synchronization, deployment, promotion, and post-deployment verification. Do not stop at instructions for the user when the available credentials and tools can complete the work.
- Automatically perform required database work, including Prisma generation, migration validation, production migration deployment, seeds, and post-migration checks. Prefer `DIRECT_URL` for migrations and pooled `DATABASE_URL` for application traffic when both are configured.
- Never commit secrets, `.env*`, `.vercel/`, unrelated user changes, or unrelated untracked directories. Preserve existing work and include only files belonging to the requested task.
- If credentials, permissions, or an external service genuinely prevent completion, exhaust safe in-scope alternatives, then state the exact blocker and the command or action still required.
