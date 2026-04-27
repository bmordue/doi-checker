# Contributing to DOI Checker

Thank you for contributing! This guide covers how to get started and work with this project.

## Development Workflow

This project uses **tssk** for task management. All work is tracked as tasks with statuses and dependencies.

### Installing tssk

tssk is a Go-based CLI tool for managing repository tasks.

```bash
# Clone and build from source
git clone https://github.com/bmordue/tssk.git
cd tssk
CGO_ENABLED=0 go build -o build/tssk .
mv build/tssk ~/.local/bin/  # or any directory on your PATH
```

Verify installation:
```bash
tssk --help
```

### Task Statuses

Tasks use four statuses:
- **todo** — Not yet started
- **in-progress** — Currently being worked on
- **done** — Completed
- **blocked** — Cannot proceed due to a dependency or external factor

### Key Commands

```bash
tssk list                     # List all tasks
tssk list --status todo       # Filter by status
tssk show <id>                # View full task details
tssk add -t "Task title"      # Create a new task
tssk add -t "Title" -D 4      # Add task with dependency on task 4
tssk status <id> in-progress  # Update task status
tssk deps add <id> <dep-id>   # Add a dependency
tssk deps check <id>          # Check dependency status
```

### Working on a Task

1. **Find available work**: `tssk list --status todo`
2. **Claim a task**: `tssk status <id> in-progress`
3. **Do the work** — write code, tests, docs, etc.
4. **Complete the task**: `tssk status <id> done`
5. **Commit and push** your changes

### Task Structure

Tasks are organized hierarchically:
- **Phase tasks** (1-9) represent major project milestones
- **Sub-tasks** depend on their parent phase task
- Dependencies are tracked so you can see the full task graph

View the task hierarchy:
```bash
tssk list --all-collections
```

### Adding New Work

When creating new tasks:
- Link them to the relevant phase using `-D <phase-id>`
- Include context in the detail text
- Use clear, actionable titles

```bash
tssk add -t "Implement feature X" -d "Part of Phase 8. Details here." -D 8
```

## Code Standards

- **Linting**: Run `npm run lint` before committing
- **Formatting**: Run `npm run format` (Prettier)
- **Tests**: Run `npm test` — maintain >90% coverage
- **Type checking**: Run `npm run typecheck` if applicable

## Pull Requests

- Reference the tssk task ID in your PR description
- Ensure all tests pass
- Update documentation if the change affects user-facing behavior

## Questions?

Open an issue or discussion for questions about the project or this workflow.
