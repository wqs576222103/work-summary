const axios = require('axios');

/**
 * Call Volcengine Ark AI API with streaming support
 * @param {string} apiKey - Volcengine ARK API key
 * @param {string} model - Model name (default: deepseek-v3-2-251201)
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional configuration (tools, stream, etc.)
 * @returns {Promise<string>} - Generated response text
 */
async function callVolcengineAI(apiKey, model = 'deepseek-v3-2-251201', messages, options = {}) {
  try {
    const baseUrl = process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
    
    // Prepare input format from messages
    const input = messages.map(msg => ({
      role: msg.role,
      content: [
        {
          type: 'input_text',
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        }
      ]
    }));

    // Build request payload
    const payload = {
      model: model,
      stream: options.stream !== undefined ? options.stream : false,
      input: input
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    // Make the API request
    const response = await axios.post(
      `${baseUrl}/responses`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Handle streaming response
    if (options.stream) {
      return handleStreamingResponse(response);
    }

    // Handle non-streaming response
    return response.data.output?.[0]?.content?.[0]?.text || '';
  } catch (error) {
    console.error('Error calling Volcengine AI API:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Handle streaming response from Volcengine AI
 * @param {Object} response - Axios response object
 * @returns {Promise<string>} - Concatenated response text
 */
async function handleStreamingResponse(response) {
  return new Promise((resolve, reject) => {
    let fullText = '';
    
    // For streaming, we need to handle the response differently
    // This is a simplified version - in production, you'd use event-stream parsing
    try {
      const data = response.data;
      
      // If it's already parsed JSON (non-streaming case)
      if (data.output && data.output[0]) {
        fullText = data.output[0].content?.[0]?.text || '';
        resolve(fullText);
      } else {
        resolve('');
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate summary using Volcengine AI (convenience wrapper)
 * @param {string} promptText - Content to summarize
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(promptText, options = {}) {
  const apiKey = process.env.VOLCENGINE_API_KEY
  
  if (!apiKey) {
    throw new Error('VOLCENGINE_API_KEY environment variable is not set');
  }

  const messages = [
    {
      role: 'user',
      content: promptText
    }
  ];

  return await callVolcengineAI(apiKey, 'deepseek-v3-2-251201', messages, options);
}


module.exports = {
  callVolcengineAI,
  generateSummary
};
