const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
});

// Store git username cache
const gitUsernameCache = new Map();

/**
 * Find all git repositories in a directory
 * @param {string} dirPath - Directory path to scan
 * @returns {Promise<string[]>} - Array of git repository paths
 */
async function findGitRepos(dirPath) {
  const repos = [];

  async function scanDir(currentPath) {
    try {
      const items = await fs.promises.readdir(currentPath);

      for (const item of items) {
        const fullPath = path.join(currentPath, item);

        try {
          const stat = await fs.promises.stat(fullPath);

          if (stat.isDirectory()) {
            // Check if this is a .git directory
            if (item === '.git') {
              const repoPath = path.dirname(fullPath);
              repos.push(repoPath);
              return; // Don't go deeper
            }

            // Continue scanning subdirectories
            await scanDir(fullPath);
          }
        } catch (err) {
          // Skip inaccessible directories
        }
      }
    } catch (err) {
      console.error(`Error scanning ${currentPath}:`, err.message);
    }
  }

  await scanDir(dirPath);
  return repos;
}

/**
 * Get git username for a repository
 * @param {string} repoPath - Repository path
 * @returns {Promise<string>} - Git username
 */
async function getGitUsername(repoPath) {
  if (gitUsernameCache.has(repoPath)) {
    return gitUsernameCache.get(repoPath);
  }

  try {
    const git = simpleGit(repoPath);

    // Try to get global config first
    let username = '';

    try {
      // First try: get global config
      const globalConfig = await git.listConfig(true);
      if (globalConfig.all['user.name']) {
        username = globalConfig.all['user.name'];
      } else {
        // Second try: get local project config
        const localConfig = await git.listConfig(false);
        if (localConfig.all['user.name']) {
          username = localConfig.all['user.name'];
        }
      }
    } catch (configErr) {
      console.error(`Error getting config for ${repoPath}:`, configErr.message);
    }

    gitUsernameCache.set(repoPath, username);
    return username;
  } catch (err) {
    console.error(`Error getting username for ${repoPath}:`, err.message);
    return 'unknown';
  }
}

/**
 * Get commits for a repository in a date range
 * @param {string} repoPath - Repository path
 * @param {string|string[]} branches - Branch name or array of branch names
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} username - Git username to filter
 * @returns {Promise<Object[]>} - Array of commit objects
 */
async function getRepoCommits(repoPath, branches, startDate, endDate, username) {
  const git = simpleGit(repoPath);
  const commits = [];

  try {
    // Default branches if not specified
    if (!branches || branches.length === 0) {
      branches = ['alpha', 'dev'];
    }

    // Convert single branch to array
    if (typeof branches === 'string') {
      branches = [branches];
    }

    if (!username) {
      username = await getGitUsername(repoPath);
    }

    // Store current branch
    const currentBranch = await git.branch();
    // console.log(`Current branch: ${currentBranch.current}`);
    // console.log(`Processing branches: ${branches.join(', ')}`);
    // console.log(`Username: ${username}`);
    const currentBranchName = currentBranch.current;

    // Process each branch
    for (const branch of branches) {
      try {
        // Switch to specified branch if different from current
        if (branch !== currentBranchName) {
          await git.checkout(branch);
        }

        // Get commit logs with date range using proper git syntax
        const log = await git.log([
          `--since=${startDate}`,
          `--until=${endDate} 23:59:59`,
          `--author=${username}`
        ]);

        for (const commit of log.all) {
          try {
            // Get detailed commit information
            // git show -- . ':!package.json' ':!package-lock.json' ':!.env.development'
            const show = await git.show([commit.hash, '--', '.', ':!package.json', ':!package-lock.json', ':!.env.development']);
            // const show = await git.show([commit.hash, '--stat']);

            commits.push({
              hash: commit.hash,
              message: commit.message,
              date: commit.date,
              author: commit.author_name,
              branch: branch,
              diff: show
            });
          } catch (err) {
            console.error(`Error getting details for commit ${commit.hash}:`, err.message);
          }
        }
      } catch (branchErr) {
        console.error(`Error processing branch ${branch} in ${repoPath}:`, branchErr.message);
        // Continue with next branch
      }
    }

    // Switch back to original branch
    if (currentBranchName && branches[branches.length - 1] !== currentBranchName) {
      await git.checkout(currentBranchName);
    }

    return commits;
  } catch (err) {
    console.error(`Error accessing repo ${repoPath}:`, err.message);
    return [];
  }
}

/**
 * Generate summary using Claude API
 * @param {string} content - Commit content to summarize
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(content) {
  try {
    const response = await anthropic.messages.create({
      // model: "claude-opus-4-6",
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `请根据以下 Git 提交记录生成工作总结，按照以下格式输出：

日期：${new Date().toISOString().split('T')[0]}~${new Date().toISOString().split('T')[0]}
1. 重点工作完成情况
    1.1 项目 1
        变更描述
    1.2 项目 2
        变更描述
        ......

提交记录内容：
${content}`
      }]
    });

    return response.content[0].text;
  } catch (err) {
    console.error('Error generating summary:', err.message);
    // console.log('Content:', content);
    throw err
  }
}

// API Routes

/**
 * Scan directory for git repositories
 */
app.post('/api/scan', async (req, res) => {
  try {
    const { dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    // Normalize path for Windows
    const normalizedPath = path.normalize(dirPath);

    if (!fs.existsSync(normalizedPath)) {
      return res.status(400).json({ error: 'Directory does not exist' });
    }

    const repos = await findGitRepos(normalizedPath);
    res.json({ repos });
  } catch (err) {
    console.error('Error scanning directory:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get git username for a repository
 */
app.post('/api/username', async (req, res) => {
  try {
    const { repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: 'Repository path is required' });
    }

    const username = await getGitUsername(repoPath);
    res.json({ username });
  } catch (err) {
    console.error('Error getting username:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Process repositories and generate summary
 */
app.post('/api/generate', async (req, res) => {
  try {
    const { repos, branch, branches, startDate, endDate, username } = req.body;

    if (!repos || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Support both single branch (backward compatible) and multiple branches
    const branchesToProcess = branches || (branch ? [branch] : null);

    const allCommits = [];

    // Collect commits from all repositories
    for (const repoPath of repos) {
      const repoName = path.basename(repoPath);
      const commits = await getRepoCommits(repoPath, branchesToProcess, startDate, endDate, username);

      if (commits.length > 0) {
        allCommits.push({
          repoName,
          repoPath,
          commits
        });
      }
    }

    // Format commits into a text file content
    let content = '';
    for (const repo of allCommits) {
      content += `\n=== ${repo.repoName} ===\n\n`;

      for (const commit of repo.commits) {
        content += `Branch: ${commit.branch}\n`;
        content += `Commit: ${commit.hash}\n`;
        content += `Date: ${commit.date}\n`;
        content += `Message: ${commit.message}\n`;
        content += `Diff:\n${commit.diff}\n\n`;
      }
    }

    // Save to temporary file
    const tempFile = path.join(__dirname, 'temp_commits.txt');
    const tempFilePrompt = path.join(__dirname, 'temp_commits_prompt.txt');
    await fs.promises.writeFile(tempFile, content, 'utf-8');
    await fs.promises.writeFile(tempFilePrompt, `请根据以下 Git 提交记录生成工作总结，按照以下格式输出：
日期：${startDate}~${endDate}
1. 重点工作完成情况
    1.1 项目 1
        变更描述
    1.2 项目 2
        变更描述
        ......

提交记录内容：
${content}`, 'utf-8');

    // Generate summary using Claude
    const summary = await generateSummary(content);

    // Clean up temp file
    await fs.promises.unlink(tempFile);

    res.json({
      summary,
      commitsCount: allCommits.reduce((sum, repo) => sum + repo.commits.length, 0)
    });

  } catch (err) {
    console.error('Error generating summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Open your browser and navigate to the above URL');
});
