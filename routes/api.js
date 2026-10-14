const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const {
  findGitRepos,
  getGitUsername,
  getRepoCommits,
} = require("../services/gitService");
// const { generateSummary } = require('../services/aiService');
const { generateSummary } = require("../services/volcAiService");

// Helper function to convert string to array
const str2Arr = (str, defaultValue = []) => {
  let arr = [];
  if (str) {
    if (Array.isArray(str)) {
      arr = str;
    } else {
      arr = str.split(",").map((b) => b.trim());
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
  const { repos, branch, startDate, endDate, username, extraNotes } = req.body;

  if (!repos || !startDate || !endDate) {
    throw new Error("Missing required parameters");
  }

  let branchesToProcess = str2Arr(branch, ["alpha", "dev"]);
  const allCommits = [];
  const seenHashes = new Set();

  // Collect commits from all repositories
  for (const repoPath of repos) {
    const repoName = path.basename(repoPath);
    const rawCommits = await getRepoCommits(
      repoPath,
      branchesToProcess,
      startDate,
      endDate,
      username,
    );

    // Deduplicate commits whose hash already collected (e.g. same repo listed twice)
    const commits = rawCommits.filter((commit) => {
      if (!commit.hash || seenHashes.has(commit.hash)) return false;
      seenHashes.add(commit.hash);
      return true;
    });

    if (commits.length > 0) {
      allCommits.push({
        repoName,
        repoPath,
        commits,
      });
    }
  }

  // No commits found: fail fast instead of asking AI with an empty prompt
  if (allCommits.length === 0) {
    throw new Error(
      `未找到符合条件的提交记录（分支: ${branchesToProcess.join(", ")}，时间: ${startDate}~${endDate}，用户: ${username || "默认"}），请检查分支名称、日期范围或用户名`,
    );
  }

  // Format commits into a text file content
  let content = "";
  for (const repo of allCommits) {
    content += `\n=== ${repo.repoName} ===\n\n`;

    for (const commit of repo.commits) {
      content += `Diff:\n${commit.diff}\n`;
    }
  }

  // If content exceeds 50000 chars, rebuild with only commit messages (no diff)
  if (content.length > 50000) {
    console.log(
      `Commit content is ${content.length} chars (>50000), rebuilding with only commit messages`,
    );
    content = "";
    for (const repo of allCommits) {
      content += `\n=== ${repo.repoName} ===\n\n`;

      for (const commit of repo.commits) {
        content += `Commit: ${commit.message}\n`;
      }
    }
  } else {
    console.log(
      `Commit content is ${content.length} chars, using full content`,
    );
  }

  console.log("Commit content:", content);

  const promptText = `
日期：${startDate}~${endDate}的GIT提交记录如下：
    ${content}
    
`;

  const extraNotesText =
    typeof extraNotes === "string" && extraNotes.trim()
      ? `\n\n额外说明：\n${extraNotes.trim()}\n`
      : "";

  const finalPromptText = promptText + extraNotesText;

  // Save prompt to a temp file for debugging
  const tempFilePrompt = path.join(__dirname, "../temp_commits_prompt.txt");
  await fs.promises.writeFile(tempFilePrompt, finalPromptText, "utf-8");

  return { promptText: finalPromptText, allCommits };
};

/**
 * POST /api/scan
 * Scan directory for git repositories
 */
router.post("/scan", async (req, res) => {
  try {
    const { dirPath } = req.body;

    if (!dirPath) {
      return res.status(400).json({ error: "Directory path is required" });
    }

    const dirPaths = str2Arr(dirPath, []);
    const repoSet = new Set();

    for (const _dirPath of dirPaths) {
      // Normalize path for Windows
      const normalizedPath = path.normalize(_dirPath);

      if (!fs.existsSync(normalizedPath)) {
        return res.status(400).json({ error: "Directory does not exist" });
      }

      const repoList = await findGitRepos(normalizedPath);
      repoList.forEach((repo) => repoSet.add(repo));
    }

    res.json({ repos: [...repoSet] });
  } catch (err) {
    console.error("Error scanning directory:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/username
 * Get git username for a repository
 */
router.post("/username", async (req, res) => {
  try {
    const { repoPath } = req.body;

    if (!repoPath) {
      return res.status(400).json({ error: "Repository path is required" });
    }

    const username = await getGitUsername(repoPath);
    res.json({ username });
  } catch (err) {
    console.error("Error getting username:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/generate
 * Process repositories and generate summary
 */
router.post("/generate", async (req, res) => {
  let _promptText = "";

  try {
    const { promptText, allCommits } = await getPromptText(req);
    _promptText = promptText;

    // Generate summary using Claude
    // const summary = await generateSummary(promptText);
    // 暂时不调用ai, 请复制以下提示词
    const summary = promptText;

    res.json({
      summary,
      commitsCount: allCommits.reduce(
        (sum, repo) => sum + repo.commits.length,
        0,
      ),
    });
  } catch (err) {
    console.error("Error generating summary:", err.message);
    const error = `${err.message}\n${_promptText}`;
    res.status(500).json({ error });
  }
});

module.exports = router;
