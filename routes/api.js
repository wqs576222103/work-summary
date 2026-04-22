const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { findGitRepos, getGitUsername, getRepoCommits } = require('../services/gitService');
// const { generateSummary } = require('../services/aiService');
const { generateSummary } = require('../services/volcAiService');

// Helper function to convert string to array
const str2Arr = (str, defaultValue = []) => {
  let arr = [];
  if (str) {
    if (Array.isArray(str)) {
      arr = str;
    } else {
      arr = str.split(',').map(b => b.trim());
    }
  } else {
    arr = defaultValue;
  }
  return arr;
};

/**
 * Prepare prompt text from request data
 */
const getPromptText = async (req) => {
  const { repos, branch, startDate, endDate, username } = req.body;
  
  if (!repos || !startDate || !endDate) {
    throw new Error('Missing required parameters');
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
      content += `Diff:\n${commit.diff}\n`;
    }
  }

  // Save to temporary files
  const tempFile = path.join(__dirname, '../temp_commits.txt');
  const tempFilePrompt = path.join(__dirname, '../temp_commits_prompt.txt');

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
${content}`;
  
  await fs.promises.writeFile(tempFilePrompt, promptText, 'utf-8');
  
  // Clean up temp file
  await fs.promises.unlink(tempFile);
  
  return { promptText, allCommits };
};

/**
 * POST /api/scan
 * Scan directory for git repositories
 */
router.post('/scan', async (req, res) => {
  try {
    const { dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: 'Directory path is required' });
    }

    const dirPaths = str2Arr(dirPath, []);
    const repos = [];

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
 * POST /api/username
 * Get git username for a repository
 */
router.post('/username', async (req, res) => {
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
 * POST /api/generate
 * Process repositories and generate summary
 */
router.post('/generate', async (req, res) => {
  let _promptText = '';
  
  try {
    const { promptText, allCommits } = await getPromptText(req);
    _promptText = promptText;

    // Generate summary using Claude
    const summary = await generateSummary(promptText);
    // 暂时不调用ai, 请复制以下提示词
    // const summary = promptText

    res.json({
      summary,
      commitsCount: allCommits.reduce((sum, repo) => sum + repo.commits.length, 0)
    });
  } catch (err) {
    console.error('Error generating summary:', err.message);
    const error = `${err.message}\n${_promptText}`;
    res.status(500).json({ error });
  }
});

module.exports = router;