# Shipwright

Turn dormant repos into live products in minutes.

## Overview

Shipwright is a deployment doctor for GitHub repositories. It analyzes what your app is, identifies the specific issues that can block a deployment, then opens a pull request with the generated files and a reviewable deployment plan.

- Deployment readiness summaries with blockers, warnings, and recommended fixes
- Production-ready deployment configurations (Vercel)
- Production-ready Dockerfiles (+ .dockerignore) for any container platform (Fly.io, Railway, Render, a VPS)
- `SHIPWRIGHT_DEPLOYMENT_PLAN.md` checklists for reviewers
- Professional README files
- Beautiful landing pages
- Environment variable templates
- Automated pull requests with all generated files

**Goal**: From "I found an old repo" to "I know exactly what blocks deployment" in minutes.

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Authentication**: NextAuth.js with GitHub OAuth
- **Backend**: Next.js API routes
- **GitHub Integration**: Octokit REST API
- **Validation**: Zod
- **Package Manager**: Bun
- **Code Quality**: Biome (linter + formatter)

## Getting Started

### Prerequisites

- Node.js 20+
- Bun (installed globally)
- GitHub account and OAuth app credentials

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd shipwright
```

2. Install dependencies with Bun:
```bash
bun install
```

3. Set up GitHub OAuth:
   - Go to https://github.com/settings/developers
   - Create a new OAuth App
   - Set Authorization callback URL to `http://localhost:3000/api/auth/callback/github`
   - Copy the Client ID and Client Secret

4. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add:
```
GITHUB_ID=your_client_id
GITHUB_SECRET=your_client_secret
NEXTAUTH_SECRET=run: `openssl rand -base64 32` to generate
NEXTAUTH_URL=http://localhost:3000
```

### Development

Start the development server:
```bash
bun run dev
```

Visit http://localhost:3000

### Build

```bash
bun run build
```

### Production

```bash
bun start
```

## Code Quality

### Formatting

```bash
bun run format
```

Biome will automatically format all code files according to the project's style guide.

### Linting

```bash
bun run lint
```

Biome will check for code issues and apply automatic fixes where possible.

### Type Checking

```bash
bun run type-check
```

## Project Structure

```
app/
├── (auth)/               # Auth pages
├── (dashboard)/          # Protected routes
│   ├── repos/           # Repository listing
│   └── repos/[...slug]/  # Individual repo analysis
├── api/
│   ├── auth/            # NextAuth configuration
│   ├── repos/           # Get user repositories
│   ├── analyze/         # Analyze repository
│   └── generate/        # Generate configs and content
├── globals.css          # Global styles
└── layout.tsx           # Root layout

lib/
├── auth.ts              # NextAuth configuration
├── github.ts            # GitHub API client
├── analyzer.ts          # Repository analysis engine
└── generators/
    ├── deployment-plan.ts # Deployment readiness plan generation
    ├── vercel-config.ts # Deployment config generation
    ├── readme.ts        # README generation
    ├── landing.ts       # Landing page generation
    └── env-template.ts  # Environment template generation

types/
└── index.ts             # Shared TypeScript types

components/
├── (UI components go here)
```

## Features

### Week 1 (MVP)
- [x] GitHub OAuth authentication
- [x] Repository listing and selection
- [x] Framework detection (Next.js, React, Vue, etc.)
- [x] Package manager detection
- [x] Environment variable detection
- [x] Deployment risk scoring
- [x] Deployment issue classification
- [x] Deployment plan generation

### Week 2
- [x] Vercel configuration generation
- [x] Pull request automation
- [ ] Deployment script generation

### Week 3
- [ ] README generation with LLM enhancement
- [ ] Landing page templates
- [ ] Environment variable documentation

### Week 4
- [ ] Deploy integration
- [ ] UI polish
- [ ] Beta user testing

## How It Works

1. **Sign in with GitHub**: Users authenticate using their GitHub account
2. **Select Repository**: Browse and select a repository to analyze
3. **Analysis**: Shipwright analyzes the repository:
   - Detects framework (Next.js, React, Vue, etc.)
   - Identifies package manager
   - Detects lockfiles and dependency install risk
   - Scans `.env` files and source code for environment variables
   - Checks for missing configurations
   - Classifies deployment blockers, warnings, and informational issues
   - Calculates deployment risk score
4. **Generate**: Generate deployment configs, deployment plan, README, and landing page
5. **Review**: Preview all generated content
6. **Deploy**: Create a pull request with all changes
7. **Ship**: Review and merge the PR, then deploy

## API Routes

### `POST /api/repos`
Get list of authenticated user's repositories.

**Response:**
```json
[
  {
    "id": 123,
    "name": "my-project",
    "full_name": "username/my-project",
    "description": "My awesome project",
    "url": "https://github.com/username/my-project",
    "language": "TypeScript",
    "stargazers_count": 42
  }
]
```

### `POST /api/analyze`
Analyze a repository.

**Request:**
```json
{
  "owner": "username",
  "repo": "my-project"
}
```

**Response:**
```json
{
  "framework": "Next.js",
  "packageManager": "npm",
  "backendType": "Node.js",
  "hasDocker": false,
  "hasReadme": true,
  "hasEnvExample": false,
  "lockfile": "package-lock.json",
  "envVarsDetected": ["DATABASE_URL", "API_KEY"],
  "buildScript": "npm run build",
  "startScript": "npm start",
  "testScript": "npm test",
  "missingConfigs": [],
  "deploymentIssues": [
    {
      "severity": "warning",
      "title": "Environment variables need documentation",
      "detail": "2 environment variable references detected, but no .env.example file was found.",
      "fix": "Add .env.example with placeholder values for every required variable.",
      "file": ".env.example"
    }
  ],
  "recommendedActions": ["Add .env.example with placeholder values for every required variable."],
  "readinessSummary": "Next.js app using npm; likely deployable after 1 warning is reviewed.",
  "deploymentRiskScore": 15,
  "description": "Next.js project with npm and Node.js"
}
```

### `POST /api/generate`
Generate deployment configs and content.

**Request:**
```json
{
  "owner": "username",
  "repo": "my-project",
  "description": "Optional repo description"
}
```

**Response:**
```json
{
  "vercelJson": "{ ... }",
  "packageJsonScripts": { ... },
  "packageJson": "{ ... }",
  "ciWorkflow": "name: Shipwright deployment checks\n...",
  "envTemplate": "# Environment variables\n...",
  "readme": "# my-project\n...",
  "landingPage": "<html>...</html>",
  "deploymentPlan": "# Shipwright Deployment Plan for username/my-project\n..."
}
```

## Security

- All API routes require GitHub authentication
- No secrets are stored beyond the session
- Repository read-only access only
- Transparent PR diffs for review
- Environment variables are never committed to the repository

## Roadmap

### V1 (MVP)
- Vercel deployment only
- Single template per generator
- Manual PR creation required

### V2
- Multiple cloud providers (Railway, Fly.io, etc.)
- Anthropic SDK integration for better content generation
- Project portfolio dashboard
- Automated PR merging for trusted users

### V3
- Launch marketing automation
- Analytics auto-wiring
- Monetization integration (Stripe)
- Repo health scoring

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this for your own projects

## Support

Questions or issues? Open an issue on GitHub.

---

**Built with ❤️ for solo builders and indie developers who want to ship fast.**
