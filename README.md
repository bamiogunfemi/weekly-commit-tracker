# Weekly Commit Tracker

<p align="center">
  <img src="https://via.placeholder.com/200x200?text=weekly-commit-tracker" alt="weekly-commit-tracker Logo" width="200" height="200">
</p>

<p align="center">
  <b>Automate your weekly work updates from GitHub commits</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/weekly-commit-tracker"><img src="https://img.shields.io/npm/v/weekly-commit-tracker" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/weekly-commit-tracker"><img src="https://img.shields.io/npm/dm/weekly-commit-tracker" alt="npm downloads"></a>
  <a href="https://github.com/yourusername/weekly-commit-tracker/blob/main/LICENSE"><img src="https://img.shields.io/github/license/bamiogunfemi/weekly-commit-tracker" alt="license"></a>
</p>

---

## 🚀 Features

- **Smart Weekly Reports**: Automatically generate reports of your GitHub activity organized by week
- **Intelligent Categorization**: Groups your work into categories like "Bug Fixes", "Features", and "Improvements"
- **Repository Selection**: Focus only on repositories that matter to you
- **Multiple Output Formats**: Export as Markdown, plain text, or JSON
- **Organization Support**: Works with your GitHub organization repositories
- **Command Line Friendly**: Simple CLI interface with interactive prompts
- **Configurable**: Saves your preferences for future use

## 🔧 Installation

```bash
# Install globally
npm install -g weekly-commit-tracker

# or run with npx without installing
npx weekly-commit-tracker
```

## 🏁 Quick Start

Run the command and follow the interactive prompts:

```bash
commit-tracker
```

The tool will:
1. Ask for your GitHub token on first run
2. Help you select an organization
3. Let you choose which repositories to track
4. Generate a weekly report of your contributions

## 📖 Usage Examples

### Basic Usage

```bash
# Generate report for the last week
commit-tracker
```

### Specify Organization

```bash
# Generate report for a specific organization
commit-tracker --org your-organization
```

### Focus on Specific Repositories

```bash
# Only include commits from specific repositories
commit-tracker --repos project-api,frontend,mobile-app
```

### Look Back Multiple Weeks

```bash
# Generate a report covering the last 4 weeks
commit-tracker --weeks 4
```

### Change Output Format

```bash
# Generate report in markdown format (default)
commit-tracker --format markdown

# Generate report in plain text format
commit-tracker --format text

# Generate report as JSON for further processing
commit-tracker --format json
```

### Save to File

```bash
# Save the report to a file
commit-tracker --output weekly-report.md
```

## 🧩 Advanced Options

```
Options:
  --org, -o     GitHub organization name
  --user, -u    GitHub username
  --weeks, -w   Number of weeks to look back [default: 1]
  --repos, -r   Specific repositories to check (comma-separated)
  --format, -f  Output format [choices: "text", "markdown", "json"] [default: "markdown"]
  --output, -o  Output file path
  --config, -c  Path to config file [default: ~/.commit-tracker-config.json]
  --help        Show help
```

## 💡 Use Cases

- **Weekly Stand-ups**: Generate reports for your weekly team meetings
- **Performance Reviews**: Track your contributions over time
- **Project Management**: Keep stakeholders updated on your progress
- **Documentation**: Automatically document changes to your codebase
- **Personal Tracking**: Keep a record of what you've accomplished

## 🔨 How It Works

weekly-commit-tracker analyzes your commit messages to understand what kind of work you've done. It categorizes your commits into:

- **Bug Fixes**: Commits containing "fix", "bug", or "issue"
- **New Features**: Commits containing "add", "implement", or "create"
- **Improvements**: Commits containing "update", "improve", or "enhance"
- **Maintenance**: Commits containing "refactor", "cleanup", or "chore"
- **Documentation**: Commits containing "doc" or "readme"

This helps create meaningful summaries of your work without manual effort.

## 🔐 Security

weekly-commit-tracker stores your GitHub token securely in your home directory. You can also provide it via:
- Environment variable: `GITHUB_TOKEN`
- Through the interactive prompt on first run

Your token is only used to access repositories you have permission to view.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Octokit](https://github.com/octokit/rest.js/) for GitHub API access
- Interactive prompts powered by [Inquirer.js](https://github.com/SBoudrias/Inquirer.js/)
- Command line arguments parsed with [Yargs](https://github.com/yargs/yargs)
