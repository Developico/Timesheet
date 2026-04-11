# Contributing to Developico Timesheet

First off, thank you for considering contributing to Developico Timesheet! 🎉

This project is an open-source time tracking and project management dashboard, developed by [Developico Sp. z o.o.](https://developico.com), and we welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Questions?](#questions)

## Code of Conduct

This project adheres to our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to contact@developico.com.

## How Can I Contribute?

### 🐛 Reporting Bugs

1. **Check existing issues** — Someone may have already reported it
2. **Use the bug report template** — Fill in all relevant information
3. **Provide reproduction steps** — Help us understand and fix the issue

### 💡 Suggesting Features

1. **Check the roadmap** in README.md first
2. **Open a Discussion** for larger feature ideas
3. **Be specific** about the use case and expected behavior

### 🔧 Contributing Code

1. Look for issues labeled `good first issue` or `help wanted`
2. Comment on the issue to let us know you're working on it
3. Follow the development setup and guidelines below

### 📝 Improving Documentation

Documentation improvements are always welcome! This includes:
- Fixing typos or clarifying existing docs
- Adding examples and use cases
- Translating documentation (PL ↔ EN)

## Development Setup

### Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **pnpm 10+** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Git** — [Download](https://git-scm.com/)

### Getting Started

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/developico-timesheet.git
cd developico-timesheet

# 3. Add upstream remote
git remote add upstream https://github.com/Developico/developico-timesheet.git

# 4. Install dependencies
pnpm install

# 5. Copy environment template
cp .env.example .env.local

# 6. Start development server (mock data mode)
pnpm dev
```

The app runs on `http://localhost:3000` with mock data by default (`NEXT_PUBLIC_USE_MOCK=true`).

### Running Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Type checking
pnpm typecheck

# Linting
pnpm lint

# E2E tests (Playwright)
pnpm test:e2e
```

## Project Structure

```
developico-timesheet/
├── app/                    # Next.js App Router
│   ├── api/                # REST API routes
│   │   ├── dataverse/      # Dataverse CRUD endpoints
│   │   ├── graph/          # Microsoft Graph endpoints
│   │   ├── health/         # Health check
│   │   ├── me/             # Current user profile
│   │   └── reports/        # Report generation
│   ├── calendar/           # Time entry calendar view
│   ├── dashboard/          # KPI dashboard
│   ├── projects/           # Project management
│   └── reports/            # Report builder
├── components/             # React components
│   ├── admin/              # Admin UI (impersonation)
│   ├── auth/               # Auth screens
│   ├── calendar/           # Calendar widgets
│   ├── dashboard/          # Dashboard KPI & charts
│   ├── layout/             # Navbar, filters, navigation
│   ├── projects/           # Project tables & panels
│   └── ui/                 # shadcn/ui primitives
├── data/                   # Data layer abstraction
│   ├── interfaces.ts       # IDataSource contract
│   ├── dataverse.ts        # Dataverse implementation
│   ├── mock.ts             # Mock data (dev/demo)
│   └── source.ts           # Factory (source selection)
├── hooks/                  # Custom React hooks
├── lib/                    # Core utilities & services
│   ├── auth-client.tsx     # AuthProvider + useAuth
│   ├── dataverse-*.ts      # Dataverse client, config, auth
│   ├── client-cache.ts     # Browser cache (TTL + SWR)
│   ├── rate-limiter.ts     # API rate limiting
│   ├── env.ts              # Env validation (Zod)
│   └── app-logger.ts       # Structured logging
├── types/                  # Shared TypeScript types
├── pages/api/auth/         # NextAuth handler
├── tests/                  # Unit tests (Vitest)
├── e2e/                    # E2E tests (Playwright)
├── docs/                   # Documentation
├── deployment/             # Deployment guides
└── scripts/                # Utility scripts
```

## Coding Guidelines

### TypeScript

- Use TypeScript for all code
- Strict mode is enabled — no `any` types
- Define types for all function parameters and return values
- Use `unknown` when the type is truly unknown

### Code Style

- Use **ESLint** for linting (Next.js + TypeScript rules)
- Maximum line length: 100 characters
- Use meaningful variable and function names

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `client-cache.ts` |
| Functions | camelCase | `getConsultants()` |
| Classes | PascalCase | `DataverseClient` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_HEADERS` |
| Types/Interfaces | PascalCase | `Consultant`, `TimeEntry` |
| React components | PascalCase | `DashboardCard` |

### UI Components

- Use **shadcn/ui** components for UI primitives
- Style with **Tailwind CSS** — avoid inline styles
- Follow dynamic CSS strategy (data attributes + aggregated styles)

### Documentation

- Add JSDoc comments for public functions
- Update README.md if adding user-facing features
- Keep documentation bilingual (PL primary, EN translation)

### Security

- Never log sensitive data (tokens, secrets, PII)
- Use parameterized queries (OData filters)
- Validate all input with Zod schemas
- Follow the principle of least privilege

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, semicolons) |
| `refactor` | Code refactoring |
| `test` | Adding or fixing tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvements |
| `security` | Security improvements |

### Examples

```
feat(calendar): add weekly time summary view

fix(reports): resolve date range filter timezone issue

docs(readme): update deployment instructions

security(middleware): tighten CSP headers
```

## Pull Request Process

### PR Size Policy

**Pull requests should be as small as logically possible.** Each PR should represent a single, coherent change — one feature, one bug fix, one refactor.

| Guideline | Threshold |
|---|---|
| **Ideal PR** | 1–5 files, < 200 lines changed |
| **Acceptable** | 6–15 files, < 500 lines changed |
| **Needs justification** | 16+ files or 500+ lines |
| **Will be rejected** | Sweeping changes across unrelated areas |

> ⚠️ **AI-generated bulk PRs**: Sweeping "improvements" across dozens of files generated by AI tools will be **closed without review**. Contribute focused, incremental PRs.

### Rebase Workflow (mandatory)

**We use a rebase workflow. Merge commits are not accepted.**

```bash
# Before creating your PR:
git fetch upstream
git rebase upstream/main

# If there are conflicts:
git add <resolved-file>
git rebase --continue
git push --force-with-lease origin feature/my-feature
```

### Before Submitting

1. Create a feature branch from `main`
2. Make your changes following the coding guidelines
3. Write or update tests
4. Run the full test suite: `pnpm typecheck && pnpm lint && pnpm test`
5. Update documentation if needed
6. Rebase on latest `main`

### Review Criteria

- ✅ Code quality and style
- ✅ Test coverage
- ✅ Documentation updates
- ✅ Security considerations
- ✅ Performance impact
- ✅ PR size and focus

### Automatic Rejection Criteria

- ❌ Merge conflicts with `main`
- ❌ Sweeping changes without prior discussion
- ❌ Bulk AI-generated refactoring without an approved issue
- ❌ Missing tests for new functionality
- ❌ PRs without a linked issue (for non-trivial changes)

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- **Clear title** describing the issue
- **Environment** (Node version, OS, browser)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots or logs** if helpful

## Suggesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

- **Use case** — Why is this feature needed?
- **Proposed solution** — How should it work?
- **Alternatives considered**

## Questions?

- Open a [GitHub Discussion](https://github.com/Developico/developico-timesheet/discussions)
- Check existing issues and discussions first

---

Thank you for contributing! 🙏

Maintained by **[Developico Sp. z o.o.](https://developico.com)** | 📧 contact@developico.com
