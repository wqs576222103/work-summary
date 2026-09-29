const axios = require("axios");

/**
 * Call Volcengine Ark AI API with streaming support
 * @param {string} apiKey - Volcengine ARK API key
 * @param {string} model - Model name
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Optional configuration (tools, stream, etc.)
 * @returns {Promise<string>} - Generated response text
 */
async function callVolcengineAI(
  apiKey,
  model = "deepseek-v4-1-flash-260910",
  messages,
  options = {},
) {
  try {
    const baseUrl =
      process.env.VOLCENGINE_BASE_URL ||
      "https://ark.cn-beijing.volces.com/api/v3";

    // Prepare input format from messages
    const input = messages.map((msg) => ({
      role: msg.role,
      content: [
        {
          type: "input_text",
          text:
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content),
        },
      ],
    }));

    // Build request payload
    const payload = {
      model: model,
      stream: options.stream !== undefined ? options.stream : false,
      input: input,
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }
    console.log("Payload:", payload);
    console.log("url:", `${baseUrl}/responses`);
    // Make the API request
    const response = await axios.post(`${baseUrl}/responses`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    console.log("Response:", response.data);

    // Handle streaming response
    if (options.stream) {
      return handleStreamingResponse(response);
    }

    // Handle non-streaming response
    return extractResponseText(response.data);
  } catch (error) {
    console.error(
      "Error calling Volcengine AI API:",
      error.response?.data || error.message,
    );
    throw error;
  }
}

/**
 * Extract text from a non-streaming Responses API payload.
 * output may contain reasoning items and multiple message items,
 * so we cannot assume output[0] is the assistant message.
 * @param {Object} data - Response body from the Responses API
 * @returns {string} - Concatenated assistant message text
 */
function extractResponseText(data) {
  const output = data?.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const texts = [];
  for (const item of output) {
    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (typeof part?.text === "string") {
        texts.push(part.text);
      }
    }
  }

  return texts.join("");
}

/**
 * Extract text from a streaming Responses API event payload.
 * @param {Object} event - A single SSE event data object
 * @param {boolean} deltaSeen - Whether delta events were already received
 * @returns {string} - Text contributed by this event, if any
 */
function extractStreamText(event, deltaSeen = false) {
  if (
    event?.type === "response.output_text.delta" &&
    typeof event.delta === "string"
  ) {
    return event.delta;
  }

  // Whole-message output events only used as fallback when no deltas arrived,
  // otherwise response.completed would duplicate the delta text
  if (deltaSeen) return "";

  return extractResponseText({ output: event?.output });
}

/**
 * Handle streaming response from Volcengine AI
 * @param {Object} response - Axios response object (data is a Node stream of SSE events)
 * @returns {Promise<string>} - Concatenated response text
 */
function handleStreamingResponse(response) {
  return new Promise((resolve, reject) => {
    let fullText = "";
    let buffer = "";
    let deltaSeen = false;
    const data = response.data;

    const onText = (piece) => {
      fullText += piece;
      if (piece) deltaSeen = true;
    };
    const state = () => ({
      get deltaSeen() {
        return deltaSeen;
      },
    });

    // Already parsed JSON or buffered body (despite stream flag)
    if (!data || typeof data.pipe !== "function") {
      if (typeof data === "string" && data.includes("data:")) {
        buffer = parseSseText(data, buffer, onText, state);
        resolve(fullText + flushSseText(buffer, onText, state));
        return;
      }
      resolve(extractResponseText(data));
      return;
    }

    data.setEncoding("utf8");
    data.on("data", (chunk) => {
      buffer = parseSseText(chunk, buffer, onText, state);
    });
    data.on("end", () => {
      fullText += flushSseText(buffer, onText, state);
      resolve(fullText);
    });
    data.on("error", reject);
  });
}

/**
 * Parse SSE formatted text, invoking onText for each complete event
 * @param {string} text - Raw SSE chunk
 * @param {string} buffer - Leftover incomplete block from previous chunk
 * @param {function} onText - Callback invoked for each parsed text piece
 * @param {function} getState - Returns the current stream parse state
 * @returns {string} - Unconsumed trailing buffer
 */
function parseSseText(text, buffer, onText, getState) {
  const blocks = (buffer + text).split("\n\n");
  const remainder = blocks.pop() || "";

  for (const block of blocks) {
    consumeSseBlock(block, onText, getState);
  }

  return remainder;
}

/**
 * Parse any remaining buffered SSE text as a final block
 * @param {string} text - Trailing buffer content
 * @param {function} onText - Callback invoked for each parsed text piece
 * @param {function} getState - Returns the current stream parse state
 * @returns {string} - Always empty string
 */
function flushSseText(text, onText, getState) {
  if (text) consumeSseBlock(text, onText, getState);
  return "";
}

/**
 * Consume one SSE block (one or more `data:` lines)
 * @param {string} block - Raw SSE block
 * @param {function} onText - Callback invoked for each parsed text piece
 * @param {function} getState - Returns the current stream parse state
 */
function consumeSseBlock(block, onText, getState) {
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload);
      const piece = extractStreamText(
        event,
        getState ? getState().deltaSeen : false,
      );
      if (piece) onText(piece);
    } catch (err) {
      console.error("Failed to parse stream event:", payload);
    }
  }
}

/**
 * Generate summary using Volcengine AI (convenience wrapper)
 * @param {string} promptText - Content to summarize
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Generated summary
 */
async function generateSummary(promptText, options = {}) {
  const apiKey = process.env.VOLCENGINE_API_KEY;

  if (!apiKey) {
    throw new Error("VOLCENGINE_API_KEY environment variable is not set");
  }

  const messages = [
    {
      role: "user",
      content: promptText,
    },
  ];

  return await callVolcengineAI(
    apiKey,
    "deepseek-v4-1-flash-260910",
    messages,
    options,
  );
}

module.exports = {
  callVolcengineAI,
  generateSummary,
};
