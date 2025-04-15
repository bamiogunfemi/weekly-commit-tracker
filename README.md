# Weekly GitHub Commit Tracker

This command-line tool analyzes your GitHub commits within an organization and generates weekly reports of your work. Perfect for creating weekly updates and tracking your contributions.

## Features

- Selectively retrieves commits from repositories you care about
- Saves favorite repositories for future use
- Categorizes work based on commit messages (bug fixes, new features, etc.)
- Groups commits by week
- Generates reports in text, markdown, or JSON format
- Saves configuration for easy reuse
- Supports looking back multiple weeks

## Setup Instructions

### Prerequisites

- Node.js 14+ installed
- GitHub personal access token with `repo` permissions

### Installation

1. Clone this repository or create the two files shown in the artifacts
2. Install dependencies:

```bash
npm install
```

3. Make the script executable:

```bash
chmod +x index.js
```

4. Optionally, link the package globally to use it from anywhere:

```bash
npm link
```

### Configuration

You'll need a GitHub personal access token with `repo` scope. You can create one at [GitHub Developer Settings](https://github.com/settings/tokens).

You can either:

- Let the tool prompt you for the token when you first run it
- Create a `.env` file with the token:
  ```
  GITHUB_TOKEN=your_github_token_here
  ```
- Pass the token via command line (not recommended for security reasons)

## Usage

### Basic Usage

```bash
# Using the local script
./index.js

# If globally linked
commit-tracker
```

The tool will prompt you for any required information not provided as arguments.

### Command Line Options

```bash
# Specify the organization
./index.js --org your-organization-name

# Specify specific repositories to check (avoid checking all repos)
./index.js --repos project-one,project-two,api-service

# Look back multiple weeks
./index.js --weeks 4

# Output in a specific format
./index.js --format markdown

# Save the output to a file
./index.js --output weekly-report.md

# Get help
./index.js --help
```

## Report Formats

### Markdown (default)

- Creates sections by week
- Organizes tasks by category
- Includes clickable links to commits
- Perfect for team updates in GitHub/GitLab wikis or documentation

### Text

- Plain text format
- Good for copy-pasting into emails or text docs

### JSON

- Structured data format
- Useful for further processing or integration with other tools

## Task Categorization

The tool automatically categorizes your commits based on keywords in commit messages:

1. **Bug Fixes**: Commits containing "fix", "bug", or "issue"
2. **New Features**: Commits containing "add", "implement", or "create"
3. **Improvements**: Commits containing "update", "improve", or "enhance"
4. **Maintenance**: Commits containing "refactor", "cleanup", or "chore"
5. **Documentation**: Commits containing "doc" or "readme"
6. **Other**: All other commits

## Tips for Better Reports

- Write descriptive commit messages that start with a verb (e.g., "Add user authentication", "Fix login redirect bug")
- Use consistent commit message patterns
- Consider using conventional commits (e.g., `feat:`, `fix:`, `docs:`)
- Break down large changes into smaller, more focused commits
