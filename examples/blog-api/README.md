# Blog API Example

A simple blog API demonstrating Yama's content-addressable migration system.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server (auto-creates snapshots and transitions)
pnpm dev
```

## Schema Management

Yama uses a **content-addressable migration system** based on:

- **Snapshots**: Point-in-time captures of your schema, identified by content hash
- **Transitions**: Migration paths between snapshots containing migration steps
- **Environment State**: Tracks current snapshot per environment

### Common Commands

```bash
# Check schema status
pnpm status           # or: yama status

# View migration history
pnpm history          # or: yama history --graph

# Create snapshot manually
yama snapshot create

# Deploy to staging
pnpm deploy:staging   # or: yama deploy --env staging

# Deploy to production (shows plan first)
pnpm deploy:prod      # or: yama deploy --env production
```

### Development Workflow

1. Edit `yama.yaml` to change your schema
2. Run `pnpm dev` - automatically creates snapshots and transitions
3. Review changes with `yama status`
4. Deploy to environments with `yama deploy --env <name>`

### Understanding the .yama Folder

```
.yama/
├── snapshots/        # Schema snapshots (content-hashed)
│   └── abc123...json
├── transitions/      # Migration steps between snapshots
│   └── def456...json
├── state/           # Environment state tracking
│   ├── development.json
│   └── production.json
└── graph.json       # DAG of all snapshots and transitions
```

### Rollback

```bash
# View available snapshots
yama snapshot list

# Rollback to specific snapshot
yama rollback --env production --to <snapshot-hash>
```

### Safety Features

- **Shadow Columns**: Dropped columns are renamed (not deleted) for 30 days
- **Data Snapshots**: Tables are backed up before destructive operations
- **Auto-rollback**: Use `--auto-rollback` flag on deploy

## Project Structure

```
blog-api/
├── yama.yaml          # Configuration
├── src/
│   └── handlers/      # Custom operation handlers
└── .yama/            # Generated snapshots, transitions, state
```

## Schemas

The example defines three database entities:

- **Author**: Blog authors with name, email, bio
- **Post**: Blog posts with title, content, published status
- **Comment**: Comments on posts

And view schemas for API responses:

- **PostSummary**: Compact post representation
- **PostDetail**: Full post with author
- **AuthorWithPosts**: Author with their posts

## APIs

Two REST APIs are exposed:

- `/api/v1/*` - Public API with role-based access
- `/api/admin/*` - Admin-only API
