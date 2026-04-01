const axios = require('axios');

/**
 * Generate summary using Claude API
 * @param {string} promptText - Commit content to summarize
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(promptText) {
  try {
    // Prepare the request to Claude API
    const claudeResponse = await axios.post(
      process.env.ANTHROPIC_API_URL,
      {
        model: 'claude-haquette-4-5-20251001',
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

    return claudeResponse.data.content[0].text;
  } catch (error) {
    console.error('Error calling Claude API:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  generateSummary
};