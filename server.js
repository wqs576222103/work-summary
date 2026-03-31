const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');
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


const str2Arr = (str, defaultValue = []) => {
  let arr = []
  if (str) {
    if (Array.isArray(str)) {
      arr = str
    } else {
      arr = str.split(',').map(b => b.trim());
    }
  } else {
    arr = defaultValue
  }
  return arr
}

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
async function generateSummary(promptText) {
  try {
    // console.log(process.env.ANTHROPIC_API_URL, process.env.ANTHROPIC_API_KEY);
    // Prepare the request to Claude API
    const claudeResponse = await axios.post(
      process.env.ANTHROPIC_API_URL,
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: promptText
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    return claudeResponse.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error.response?.data || error.message);
    // console.log('Content:', content);
    throw error
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

    const dirPaths = str2Arr(dirPath, []);
    const repos = []

    for (const _dirPath of dirPaths) {
      // Normalize path for Windows
      const normalizedPath = path.normalize(_dirPath);

      if (!fs.existsSync(normalizedPath)) {
        return res.status(400).json({ error: 'Directory does not exist' });
      }

      const repoList = await findGitRepos(normalizedPath);
      repos.push(...repoList);
    }
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

const getPromptText = async (req) => {
  const { repos, branch, startDate, endDate, username } = req.body;
  if (!repos || !startDate || !endDate) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  let branchesToProcess = str2Arr(branch, ['alpha', 'dev']);

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
      //   content += `Branch: ${commit.branch}\n`;
      //   content += `Commit: ${commit.hash}\n`;
      //   content += `Date: ${commit.date}\n`;
      //   content += `Message: ${commit.message}\n`;
      content += `Diff:\n${commit.diff}\n`;
    }
  }

  // Save to temporary file
  const tempFile = path.join(__dirname, 'temp_commits.txt');
  const tempFilePrompt = path.join(__dirname, 'temp_commits_prompt.txt');


  await fs.promises.writeFile(tempFile, content, 'utf-8');
  const promptText = `请根据以下 Git 提交记录生成工作总结，按照以下格式输出：
日期：${startDate}~${endDate}
1. 重点工作完成情况
    1.1 项目 1
        变更描述
    1.2 项目 2
        变更描述
        ......
提交记录内容：
${content}`
  await fs.promises.writeFile(tempFilePrompt, promptText, 'utf-8');
  // Clean up temp file
  await fs.promises.unlink(tempFile);
  return promptText;
}

/**
 * Process repositories and generate summary
 */
app.post('/api/generate', async (req, res) => {
  let promptText = ''
  try {
    promptText = await getPromptText(req);
    // Generate summary using Claude
    const summary = await generateSummary(promptText);

    res.json({
      summary,
      commitsCount: allCommits.reduce((sum, repo) => sum + repo.commits.length, 0)
    });

  } catch (err) {

    console.error('Error generating summary:', err.message);
    const error = `${err.message}\n${promptText}`
    res.status(500).json({ error });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Open your browser and navigate to the above URL');
});
