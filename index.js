#!/usr/bin/env node

const { Octokit } = require('@octokit/rest');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const inquirer = require('inquirer');
const ora = require('ora');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('org', {
    alias: 'o',
    type: 'string',
    description: 'GitHub organization name'
  })
  .option('user', {
    alias: 'u',
    type: 'string',
    description: 'GitHub username'
  })
  .option('weeks', {
    alias: 'w',
    type: 'number',
    description: 'Number of weeks to look back',
    default: 1
  })
  .option('repos', {
    alias: 'r',
    type: 'array',
    description: 'Specific repositories to check (comma-separated)'
  })
  .option('format', {
    alias: 'f',
    type: 'string',
    choices: ['text', 'markdown', 'json'],
    description: 'Output format',
    default: 'markdown'
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file path'
  })
  .option('config', {
    alias: 'c',
    type: 'string',
    description: 'Path to config file',
    default: `${process.env.HOME}/.commit-tracker-config.json`
  })
  .help()
  .argv;

// Configuration management
class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      console.error(`Error loading config: ${error.message}`);
    }
    return { organizations: [], favoriteRepos: {}, token: null };
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error(`Error saving config: ${error.message}`);
    }
  }

  getToken() {
    return this.config.token || process.env.GITHUB_TOKEN;
  }

  getOrganizations() {
    return this.config.organizations || [];
  }

  getFavoriteRepos(org) {
    return this.config.favoriteRepos?.[org] || [];
  }

  addOrganization(org) {
    if (!this.config.organizations.includes(org)) {
      this.config.organizations.push(org);
      this.saveConfig();
    }
  }

  addFavoriteRepos(org, repos) {
    if (!this.config.favoriteRepos) {
      this.config.favoriteRepos = {};
    }
    
    if (!this.config.favoriteRepos[org]) {
      this.config.favoriteRepos[org] = [];
    }
    
    repos.forEach(repo => {
      if (!this.config.favoriteRepos[org].includes(repo)) {
        this.config.favoriteRepos[org].push(repo);
      }
    });
    
    this.saveConfig();
  }

  setToken(token) {
    this.config.token = token;
    this.saveConfig();
  }
}

// GitHub service
class GitHubService {
  constructor(token) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  async getUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return data;
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error.message}`);
    }
  }

  async getOrganizationRepos(org) {
    try {
      const repos = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.repos.listForOrg({
          org,
          per_page: 100,
          page,
        });

        repos.push(...data);
        hasMore = data.length === 100;
        page++;
      }

      return repos;
    } catch (error) {
      throw new Error(`Failed to fetch repositories for ${org}: ${error.message}`);
    }
  }

  async getCommitsForRepo(owner, repo, author, since, until) {
    try {
      const commits = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const { data } = await this.octokit.repos.listCommits({
          owner,
          repo,
          author,
          since,
          until,
          per_page: 100,
          page,
        });

        commits.push(...data);
        hasMore = data.length === 100;
        page++;
      }

      return commits;
    } catch (error) {
      if (error.status === 409) {
        // Repository is empty or in an invalid state
        return [];
      }
      throw new Error(`Failed to fetch commits for ${owner}/${repo}: ${error.message}`);
    }
  }
}

// Report generator
class ReportGenerator {
  constructor(format) {
    this.format = format;
  }

  groupCommitsByWeek(commits) {
    const weeks = {};
    
    commits.forEach(commit => {
      const date = new Date(commit.commit.author.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          startDate: weekStart,
          endDate: new Date(weekStart),
          commits: []
        };
        weeks[weekKey].endDate.setDate(weekStart.getDate() + 6);
        weeks[weekKey].endDate.setHours(23, 59, 59, 999);
      }
      
      weeks[weekKey].commits.push(commit);
    });
    
    return Object.values(weeks).sort((a, b) => b.startDate - a.startDate);
  }

  extractTasksFromCommits(commits) {
    const taskMap = new Map();
    
    commits.forEach(commit => {
      const message = commit.commit.message;
      const repo = commit.repository;
      
      // Skip merge commits
      if (message.startsWith('Merge ')) return;
      
      // Extract first line of commit message
      const title = message.split('\n')[0].trim();
      
      // Skip if empty
      if (!title) return;
      
      // Create a unique identifier for deduplication
      const key = `${title}-${repo}`;
      
      if (!taskMap.has(key)) {
        taskMap.set(key, {
          title,
          repo,
          date: new Date(commit.commit.author.date),
          url: commit.html_url
        });
      }
    });
    
    return Array.from(taskMap.values());
  }

  categorizeTask(task) {
    const lowerTitle = task.title.toLowerCase();
    
    if (lowerTitle.includes('fix') || lowerTitle.includes('bug') || lowerTitle.includes('issue')) {
      return 'Bug Fixes';
    } else if (lowerTitle.includes('add') || lowerTitle.includes('implement') || lowerTitle.includes('create')) {
      return 'New Features';
    } else if (lowerTitle.includes('update') || lowerTitle.includes('improve') || lowerTitle.includes('enhance')) {
      return 'Improvements';
    } else if (lowerTitle.includes('refactor') || lowerTitle.includes('cleanup') || lowerTitle.includes('chore')) {
      return 'Maintenance';
    } else if (lowerTitle.includes('doc') || lowerTitle.includes('readme')) {
      return 'Documentation';
    } else {
      return 'Other';
    }
  }

  generateTextReport(weeklyGroups) {
    let report = '';
    
    weeklyGroups.forEach(week => {
      const startDateStr = moment(week.startDate).format('MMMM D, YYYY');
      const endDateStr = moment(week.endDate).format('MMMM D, YYYY');
      report += `Weekly Report: ${startDateStr} - ${endDateStr}\n`;
      report += '='.repeat(60) + '\n\n';
      
      const tasks = this.extractTasksFromCommits(week.commits);
      
      // Group tasks by category
      const categorizedTasks = {};
      tasks.forEach(task => {
        const category = this.categorizeTask(task);
        if (!categorizedTasks[category]) {
          categorizedTasks[category] = [];
        }
        categorizedTasks[category].push(task);
      });
      
      // Output tasks by category
      Object.keys(categorizedTasks).forEach(category => {
        report += `${category}:\n`;
        report += '-'.repeat(category.length + 1) + '\n';
        
        categorizedTasks[category].forEach(task => {
          report += `* ${task.title} (${task.repo})\n`;
        });
        
        report += '\n';
      });
      
      report += '\n\n';
    });
    
    return report;
  }

  generateMarkdownReport(weeklyGroups) {
    let report = '';
    
    weeklyGroups.forEach(week => {
      const startDateStr = moment(week.startDate).format('MMMM D, YYYY');
      const endDateStr = moment(week.endDate).format('MMMM D, YYYY');
      report += `# Weekly Report: ${startDateStr} - ${endDateStr}\n\n`;
      
      const tasks = this.extractTasksFromCommits(week.commits);
      
      // Group tasks by category
      const categorizedTasks = {};
      tasks.forEach(task => {
        const category = this.categorizeTask(task);
        if (!categorizedTasks[category]) {
          categorizedTasks[category] = [];
        }
        categorizedTasks[category].push(task);
      });
      
      // Output tasks by category
      Object.keys(categorizedTasks).sort().forEach(category => {
        report += `## ${category}\n\n`;
        
        categorizedTasks[category].forEach(task => {
          report += `* [${task.title}](${task.url}) (${task.repo})\n`;
        });
        
        report += '\n';
      });
      
      report += '---\n\n';
    });
    
    return report;
  }

  generateJsonReport(weeklyGroups) {
    const report = [];
    
    weeklyGroups.forEach(week => {
      const tasks = this.extractTasksFromCommits(week.commits);
      
      // Group tasks by category
      const categorizedTasks = {};
      tasks.forEach(task => {
        const category = this.categorizeTask(task);
        if (!categorizedTasks[category]) {
          categorizedTasks[category] = [];
        }
        categorizedTasks[category].push({
          title: task.title,
          repository: task.repo,
          date: task.date,
          url: task.url
        });
      });
      
      report.push({
        startDate: week.startDate,
        endDate: week.endDate,
        categories: categorizedTasks
      });
    });
    
    return JSON.stringify(report, null, 2);
  }

  generateReport(commits) {
    const weeklyGroups = this.groupCommitsByWeek(commits);
    
    switch (this.format) {
      case 'markdown':
        return this.generateMarkdownReport(weeklyGroups);
      case 'json':
        return this.generateJsonReport(weeklyGroups);
      case 'text':
      default:
        return this.generateTextReport(weeklyGroups);
    }
  }
}

// Helper function to prompt user to select repositories
async function promptForRepositories(github, orgName) {
  const fetchSpinner = ora(`Fetching repositories for ${orgName}`).start();
  let allRepos = [];
  
  try {
    allRepos = await github.getOrganizationRepos(orgName);
    fetchSpinner.succeed(`Found ${chalk.green(allRepos.length)} repositories in ${orgName}`);
    
    if (allRepos.length === 0) {
      console.log(chalk.yellow('No repositories found in this organization.'));
      return [];
    }
    
    // Get recently updated repositories
    const recentRepos = [...allRepos]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 10);
    
    const { selectedAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedAction',
        message: 'How would you like to select repositories?',
        choices: [
          { name: 'Choose from recently updated repositories', value: 'recent' },
          { name: 'Search for specific repositories', value: 'search' },
          { name: 'Select from all repositories (may be slow for large orgs)', value: 'all' }
        ]
      }
    ]);
    
    let reposToChooseFrom = [];
    let selectedRepos = [];
    
    if (selectedAction === 'recent') {
      reposToChooseFrom = recentRepos;
    } else if (selectedAction === 'search') {
      const { searchQuery } = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchQuery',
          message: 'Enter search term for repository names:',
          validate: input => input.length > 0 ? true : 'Search term is required'
        }
      ]);
      
      reposToChooseFrom = allRepos.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      if (reposToChooseFrom.length === 0) {
        console.log(chalk.yellow(`No repositories found matching "${searchQuery}"`));
        return promptForRepositories(github, orgName); // Try again
      }
    } else {
      reposToChooseFrom = allRepos;
    }
    
    const { repos } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'repos',
        message: 'Select repositories to include:',
        choices: reposToChooseFrom.map(repo => ({
          name: `${repo.name} (${repo.description || 'No description'})`,
          value: repo
        })),
        pageSize: 15,
        validate: selected => selected.length > 0 ? true : 'You must select at least one repository'
      }
    ]);
    
    selectedRepos = repos;
    
    // Save selected repos as favorites
    const { saveFavorites } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveFavorites',
        message: 'Would you like to save these repositories as favorites for future use?',
        default: true
      }
    ]);
    
    if (saveFavorites) {
      const repoNames = selectedRepos.map(repo => repo.name);
      (new ConfigManager(argv.config)).addFavoriteRepos(orgName, repoNames);
      console.log(chalk.green(`✓ Saved ${repoNames.length} repositories as favorites`));
    }
    
    return selectedRepos;
  } catch (error) {
    fetchSpinner.fail(`Failed to fetch repositories: ${error.message}`);
    return [];
  }
}

// Main application
async function run() {
  // Initialize config manager
  const configManager = new ConfigManager(argv.config);
  let token = configManager.getToken();
  
  // If no token is available, prompt for it
  if (!token) {
    const { inputToken } = await inquirer.prompt([
      {
        type: 'password',
        name: 'inputToken',
        message: 'Enter your GitHub personal access token:',
        validate: input => input.length > 0 ? true : 'Token is required'
      }
    ]);
    
    token = inputToken;
    configManager.setToken(token);
    console.log(chalk.green('✓ Token saved to config file'));
  }
  
  const github = new GitHubService(token);
  
  // Verify authentication
  let user;
  try {
    const spinner = ora('Verifying GitHub authentication').start();
    user = await github.getUser();
    spinner.succeed(`Authenticated as ${chalk.green(user.login)}`);
  } catch (error) {
    console.error(chalk.red('Authentication failed:'), error.message);
    return;
  }
  
  // Get organization
  let orgName = argv.org;
  const savedOrgs = configManager.getOrganizations();
  
  if (!orgName && savedOrgs.length > 0) {
    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select a GitHub organization:',
        choices: [...savedOrgs, new inquirer.Separator(), '+ Add a new organization']
      }
    ]);
    
    if (selectedOrg === '+ Add a new organization') {
      const { newOrg } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newOrg',
          message: 'Enter the organization name:',
          validate: input => input.length > 0 ? true : 'Organization name is required'
        }
      ]);
      
      orgName = newOrg;
      configManager.addOrganization(orgName);
    } else {
      orgName = selectedOrg;
    }
  } else if (!orgName) {
    const { inputOrg } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputOrg',
        message: 'Enter the GitHub organization name:',
        validate: input => input.length > 0 ? true : 'Organization name is required'
      }
    ]);
    
    orgName = inputOrg;
    configManager.addOrganization(orgName);
  }
  
  // Calculate date range
  const weeksToLookBack = argv.weeks;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeksToLookBack * 7));
  
  console.log(chalk.blue(`Looking for commits between ${chalk.yellow(startDate.toISOString().split('T')[0])} and ${chalk.yellow(endDate.toISOString().split('T')[0])}`));
  
  // Determine which repositories to process
  let repositories = [];
  let specifiedRepos = argv.repos;
  const favoriteRepos = configManager.getFavoriteRepos(orgName);
  
  // If repos were specified via command line, use those
  if (specifiedRepos && specifiedRepos.length > 0) {
    const reposSpinner = ora(`Validating specified repositories`).start();
    try {
      // Flatten the array in case it came through as nested arrays
      specifiedRepos = specifiedRepos.flat().map(r => r.trim());
      
      // Add these repositories to favorites for future use
      configManager.addFavoriteRepos(orgName, specifiedRepos);
      
      // For each specified repo, fetch its details to validate it exists
      for (const repoName of specifiedRepos) {
        try {
          const { data } = await github.octokit.repos.get({
            owner: orgName,
            repo: repoName
          });
          repositories.push(data);
        } catch (error) {
          console.warn(chalk.yellow(`\nWarning: Repository ${repoName} not found or not accessible`));
        }
      }
      
      reposSpinner.succeed(`Using ${chalk.green(repositories.length)} specified repositories`);
    } catch (error) {
      reposSpinner.fail(`Failed to validate repositories: ${error.message}`);
      return;
    }
  } 
  // If no repos specified but we have favorites, prompt to use them
  else if (favoriteRepos.length > 0) {
    const { useFavorites } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useFavorites',
        message: `Would you like to use your ${favoriteRepos.length} favorite repositories for ${orgName}?`,
        default: true
      }
    ]);
    
    if (useFavorites) {
      const reposSpinner = ora(`Fetching favorite repositories`).start();
      try {
        for (const repoName of favoriteRepos) {
          try {
            const { data } = await github.octokit.repos.get({
              owner: orgName,
              repo: repoName
            });
            repositories.push(data);
          } catch (error) {
            console.warn(chalk.yellow(`\nWarning: Repository ${repoName} not found or not accessible`));
          }
        }
        reposSpinner.succeed(`Using ${chalk.green(repositories.length)} favorite repositories`);
      } catch (error) {
        reposSpinner.fail(`Failed to fetch favorite repositories: ${error.message}`);
        return;
      }
    } else {
      // If user doesn't want to use favorites, prompt for selection
      repositories = await promptForRepositories(github, orgName);
    }
  } 
  // If no specified repos and no favorites, let user choose
  else {
    repositories = await promptForRepositories(github, orgName);
  }
  
  if (repositories.length === 0) {
    console.log(chalk.yellow('No repositories selected. Exiting.'));
    return;
  }
  
  // Fetch commits
  const commitsSpinner = ora(`Fetching commits for ${user.login}`).start();
  const allCommits = [];
  
  for (const repo of repositories) {
    commitsSpinner.text = `Fetching commits for ${repo.name} (${repositories.indexOf(repo) + 1}/${repositories.length})`;
    
    try {
      const commits = await github.getCommitsForRepo(
        repo.owner.login,
        repo.name,
        user.login,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Add repository information to each commit
      commits.forEach(commit => {
        commit.repository = repo.name;
      });
      
      allCommits.push(...commits);
    } catch (error) {
      // Just log the error and continue with other repositories
      console.error(`\nError fetching commits for ${repo.name}: ${error.message}`);
    }
  }
  
  commitsSpinner.succeed(`Found ${chalk.green(allCommits.length)} commits across all repositories`);
  
  // Generate report
  const reportGenerator = new ReportGenerator(argv.format);
  const report = reportGenerator.generateReport(allCommits);
  
  // Output report
  if (argv.output) {
    const outputPath = path.resolve(argv.output);
    fs.writeFileSync(outputPath, report);
    console.log(chalk.green(`\nReport saved to ${outputPath}`));
  } else {
    console.log('\n' + report);
  }
}

// Run the application
run().catch(error => {
  console.error(chalk.red('An error occurred:'), error);
  process.exit(1);
});
