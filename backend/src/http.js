const defaultLimitBytes = 20 * 1024 * 1024;

export async function readBody(request, limitBytes = defaultLimitBytes) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function readJson(request) {
  const body = await readBody(request, 1024 * 1024);
  if (body.length === 0) {
    return {};
  }

  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

export function sendJson(response, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...corsHeaders(),
    ...headers
  });
  response.end(body);
}

export function sendError(response, error) {
  const statusCode = error.statusCode ?? 500;
  sendJson(response, statusCode, {
    error: {
      message: statusCode === 500 ? "Internal server error." : error.message,
      code: error.code ?? statusCode
    }
  });
}

export function sendNoContent(response) {
  response.writeHead(204, corsHeaders());
  response.end();
}

export function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}

export function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function notFound(message = "Resource not found.") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

export function methodNotAllowed(message = "Method not allowed.") {
  const error = new Error(message);
  error.statusCode = 405;
  return error;
}
