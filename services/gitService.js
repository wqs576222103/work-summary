const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

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
    if (!username) {
      username = await getGitUsername(repoPath);
    }

    // Store current branch
    const currentBranch = await git.branch();
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
          `--author=${username}`,
          // 过滤掉merge commit
          `--no-merges`,
        ]);

        for (const commit of log.all) {
          try {
            // Get detailed commit information
            const show = await git.show([commit.hash, '--', '.', ':!package.json', ':!package-lock.json', ':!.env.development']);

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

module.exports = {
  findGitRepos,
  getGitUsername,
  getRepoCommits
};