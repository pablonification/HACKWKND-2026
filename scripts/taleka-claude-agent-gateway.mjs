import { createServer } from 'node:http';
import { query } from '@anthropic-ai/claude-agent-sdk';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 10535;
const DEFAULT_MODEL = 'sonnet';
const DEFAULT_MAX_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_SDK_RETRY_COUNT = 2;
const DEFAULT_SDK_RETRY_DELAY_MS = 900;

const host = process.env.TALEKA_CLAUDE_AGENT_HOST ?? DEFAULT_HOST;
const port = Number.parseInt(process.env.TALEKA_CLAUDE_AGENT_PORT ?? String(DEFAULT_PORT), 10);
const gatewayKey = process.env.TALEKA_CLAUDE_AGENT_KEY?.trim() ?? '';
const defaultModel = process.env.TALEKA_CLAUDE_AGENT_MODEL ?? DEFAULT_MODEL;
const maxBytes = Number.parseInt(
  process.env.TALEKA_CLAUDE_AGENT_MAX_BYTES ?? String(DEFAULT_MAX_BYTES),
  10,
);
const timeoutMs = Number.parseInt(
  process.env.TALEKA_CLAUDE_AGENT_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
  10,
);
const sdkRetryCount = Math.max(
  0,
  Number.parseInt(
    process.env.TALEKA_CLAUDE_AGENT_RETRY_COUNT ?? String(DEFAULT_SDK_RETRY_COUNT),
    10,
  ),
);
const sdkRetryDelayMs = Math.max(
  0,
  Number.parseInt(
    process.env.TALEKA_CLAUDE_AGENT_RETRY_DELAY_MS ?? String(DEFAULT_SDK_RETRY_DELAY_MS),
    10,
  ),
);

const allowedRoutes = new Set(['GET /v1/models', 'POST /v1/chat/completions']);

if (!gatewayKey) {
  console.error('TALEKA_CLAUDE_AGENT_KEY is required.');
  process.exit(1);
}

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', (chunk) => {
      if (rejected) return;

      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
        reject(new Error(`Request body exceeds ${maxBytes} bytes.`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const parseJsonBody = async (req) => {
  const rawBody = await readRequestBody(req);
  if (rawBody.length === 0) {
    return {};
  }

  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
};

const extractMessages = (body) =>
  Array.isArray(body.messages)
    ? body.messages.filter(
        (message) =>
          message &&
          typeof message === 'object' &&
          typeof message.role === 'string' &&
          typeof message.content === 'string',
      )
    : [];

const toPromptParts = (messages) => {
  const systemPrompt = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n');
  const prompt = messages
    .filter((message) => message.role !== 'system')
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .filter(Boolean)
    .join('\n\n');

  return {
    systemPrompt,
    prompt: prompt || 'USER: Continue.',
  };
};

const extractAssistantText = (message) => {
  if (
    message.type === 'result' &&
    message.subtype === 'success' &&
    typeof message.result === 'string'
  ) {
    return message.result;
  }

  if (message.type !== 'assistant' || !Array.isArray(message.message?.content)) {
    return '';
  }

  return message.message.content
    .map((content) =>
      content?.type === 'text' && typeof content.text === 'string' ? content.text : '',
    )
    .filter(Boolean)
    .join('\n');
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isTransientClaudeError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return /abort|timeout|timed out|empty response|rate|429|gateway|502|503|504|overloaded|temporar/i.test(
    message,
  );
};

const runClaudeAgentAttempt = async ({ messages, model }) => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  const { systemPrompt, prompt } = toPromptParts(messages);
  let text = '';
  let resultMessage = null;

  try {
    for await (const message of query({
      prompt,
      options: {
        abortController,
        model,
        maxTurns: 1,
        maxThinkingTokens: 0,
        settingSources: [],
        systemPrompt:
          systemPrompt ||
          'You are a concise assistant. Answer the user directly and do not use tools.',
        disallowedTools: [
          'Agent',
          'Bash',
          'Edit',
          'FileEdit',
          'FileRead',
          'FileWrite',
          'Glob',
          'Grep',
          'NotebookEdit',
          'Read',
          'TodoWrite',
          'WebFetch',
          'WebSearch',
          'Write',
        ],
        env: {
          ...process.env,
          CLAUDE_AGENT_SDK_CLIENT_APP: 'taleka-ai-coach',
        },
      },
    })) {
      const candidateText = extractAssistantText(message);
      if (candidateText) {
        text = candidateText;
      }
      if (message.type === 'result') {
        resultMessage = message;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  if (resultMessage?.type === 'result' && resultMessage.is_error) {
    throw new Error(
      Array.isArray(resultMessage.errors) && resultMessage.errors.length > 0
        ? resultMessage.errors.join('; ')
        : resultMessage.subtype,
    );
  }

  return {
    text: text.trim(),
    usage: resultMessage?.usage,
  };
};

const runClaudeAgent = async ({ messages, model }) => {
  const maxAttempts = sdkRetryCount + 1;
  const errors = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await runClaudeAgentAttempt({ messages, model });
      if (!result.text) {
        throw new Error('Claude Agent SDK returned an empty response.');
      }
      return {
        ...result,
        attempts: attempt,
        retryErrors: errors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);

      if (attempt >= maxAttempts || !isTransientClaudeError(error)) {
        throw new Error(errors.join(' | '));
      }

      const delayMs = sdkRetryDelayMs * attempt;
      console.warn(
        `${new Date().toISOString()} Claude Agent SDK attempt ${attempt} failed, retrying in ${delayMs}ms: ${message}`,
      );
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw new Error(errors.join(' | ') || 'Claude Agent SDK failed.');
};

const handleModels = (res) => {
  sendJson(res, 200, {
    object: 'list',
    data: [
      {
        id: defaultModel,
        object: 'model',
        owned_by: 'anthropic',
      },
    ],
  });
};

const handleChatCompletions = async (req, res) => {
  const body = await parseJsonBody(req);
  const messages = extractMessages(body);
  if (messages.length === 0) {
    sendJson(res, 400, { error: 'messages must contain at least one string content message.' });
    return;
  }

  const model = typeof body.model === 'string' && body.model.trim() ? body.model : defaultModel;
  const result = await runClaudeAgent({ messages, model });

  sendJson(res, 200, {
    id: `taleka-claude-agent-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.text,
        },
        finish_reason: 'stop',
      },
    ],
    usage: result.usage,
    taleka_gateway: {
      attempts: result.attempts,
      retry_errors: result.retryErrors,
    },
  });
};

const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  const route = `${method} ${url.pathname}`;

  try {
    if (req.headers.authorization !== `Bearer ${gatewayKey}`) {
      sendJson(res, 401, { error: 'Unauthorized.' });
      return;
    }

    if (!allowedRoutes.has(route)) {
      sendJson(res, 404, { error: 'Route not found.' });
      return;
    }

    if (route === 'GET /v1/models') {
      handleModels(res);
      return;
    }

    await handleChatCompletions(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected Claude gateway error.';
    const status =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number(error.status)
        : /exceeds \d+ bytes/i.test(message)
          ? 413
          : /abort/i.test(message)
            ? 504
            : 502;
    if (!res.headersSent) {
      sendJson(res, status, { error: message });
    } else {
      res.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    console.log(
      `${new Date().toISOString()} ${route} ${res.statusCode} ${Date.now() - startedAt}ms`,
    );
  }
});

server.listen(port, host, () => {
  console.log(`Taleka Claude Agent gateway listening on http://${host}:${port}`);
  console.log(`Serving model ${defaultModel}`);
  console.log(`Claude Agent SDK retries: ${sdkRetryCount}, delay: ${sdkRetryDelayMs}ms`);
});
