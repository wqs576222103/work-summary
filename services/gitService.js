const fs = require("fs");
const path = require("path");
const simpleGit = require("simple-git");

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
            if (item === ".git") {
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
    let username = "";

    try {
      // First try: get global config
      const globalConfig = await git.listConfig(true);
      if (globalConfig.all["user.name"]) {
        username = globalConfig.all["user.name"];
      } else {
        // Second try: get local project config
        const localConfig = await git.listConfig(false);
        if (localConfig.all["user.name"]) {
          username = localConfig.all["user.name"];
        }
      }
    } catch (configErr) {
      console.error(`Error getting config for ${repoPath}:`, configErr.message);
    }

    gitUsernameCache.set(repoPath, username);
    return username;
  } catch (err) {
    console.error(`Error getting username for ${repoPath}:`, err.message);
    return "unknown";
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
async function getRepoCommits(
  repoPath,
  branches,
  startDate,
  endDate,
  username,
) {
  const git = simpleGit(repoPath);
  const commits = [];
  const seenHashes = new Set();

  try {
    if (!username) {
      username = await getGitUsername(repoPath);
    }

    // Read branch refs directly - never checkout, so dirty working trees
    // and branch switching are not a concern
    const branchInfo = await git.branch();
    const currentBranchName = branchInfo.current;
    const refNames = Object.keys(branchInfo.branches || {});
    const remoteNames = await git
      .raw(["remote"])
      .then((out) =>
        out
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
      )
      .catch(() => []);

    const branchesToProcess = [];
    for (const branch of str2ArrSafe(branches)) {
      const ref = resolveBranchRef(branch, refNames, remoteNames);
      if (ref) {
        branchesToProcess.push({ branch, ref });
      } else {
        console.warn(
          `Branch "${branch}" not found in ${repoPath}, available: ${refNames.join(", ") || "none"}`,
        );
      }
    }

    // Fallback: no requested branch exists, use the current branch instead
    if (branchesToProcess.length === 0) {
      if (currentBranchName) {
        console.warn(
          `None of requested branches exist in ${repoPath}, falling back to "${currentBranchName}"`,
        );
        branchesToProcess.push({
          branch: currentBranchName,
          ref: currentBranchName,
        });
      } else {
        return [];
      }
    }

    for (const { branch, ref } of branchesToProcess) {
      try {
        const logArgs = [
          ref,
          `--since=${normalizeSince(startDate)}`,
          `--until=${normalizeUntil(endDate)}`,
          // 过滤掉merge commit
          `--no-merges`,
        ];
        // Empty author pattern would filter out everything
        if (username) {
          logArgs.push(`--author=${username}`);
        }

        const log = await git.log(logArgs);

        console.log(
          `Repo ${repoPath} branch ${ref}: ${log.all.length} commits (${startDate}~${endDate}, author=${username || "any"})`,
        );

        for (const commit of log.all) {
          // Same commit may appear on multiple branches, keep it once
          if (seenHashes.has(commit.hash)) continue;
          seenHashes.add(commit.hash);

          try {
            // git show works on any ref, no checkout required
            const show = await git.show([
              commit.hash,
              "--",
              ".",
              ":!package.json",
              ":!package-lock.json",
              ":!.env.development",
            ]);

            commits.push({
              hash: commit.hash,
              message: commit.message,
              date: commit.date,
              author: commit.author_name,
              branch: branch,
              diff: show,
            });
          } catch (err) {
            console.error(
              `Error getting details for commit ${commit.hash}:`,
              err.message,
            );
          }
        }
      } catch (branchErr) {
        console.error(
          `Error processing branch ${branch} in ${repoPath}:`,
          branchErr.message,
        );
        // Continue with next branch
      }
    }

    return commits;
  } catch (err) {
    console.error(`Error accessing repo ${repoPath}:`, err.message);
    return [];
  }
}

/**
 * Resolve a branch name to a readable git ref without checking out
 * @param {string} branch - Requested branch name
 * @param {string[]} refNames - Local branch/remote refs from `git branch`
 * @param {string[]} remoteNames - Remote names (e.g. ["origin"])
 * @returns {string|null} - Ref to pass to git log, or null if not found
 */
function resolveBranchRef(branch, refNames, remoteNames) {
  if (refNames.includes(branch)) return branch;

  for (const remote of remoteNames) {
    const remoteRef = `${remote}/${branch}`;
    if (
      refNames.includes(remoteRef) ||
      refNames.includes(`remotes/${remoteRef}`)
    ) {
      return remoteRef;
    }
  }

  return null;
}

/**
 * Normalize a start date for git --since
 * Git parses a bare YYYY-MM-DD unreliably, always append 00:00:00
 * @param {string} date - Start date (YYYY-MM-DD)
 * @returns {string}
 */
function normalizeSince(date) {
  const d = String(date || "").trim();
  if (!d) return d;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d} 00:00:00` : d;
}

/**
 * Normalize an end date for git --until
 * @param {string} date - End date (YYYY-MM-DD)
 * @returns {string}
 */
function normalizeUntil(date) {
  const d = String(date || "").trim();
  if (!d) return d;
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d} 23:59:59` : d;
}

/**
 * Normalize branches parameter to a string array
 * @param {string|string[]} branches - Branch name or array of branch names
 * @returns {string[]}
 */
function str2ArrSafe(branches) {
  if (Array.isArray(branches)) return branches.filter(Boolean);
  if (typeof branches === "string")
    return branches
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
  return [];
}

module.exports = {
  findGitRepos,
  getGitUsername,
  getRepoCommits,
};
