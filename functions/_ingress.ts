import { applySecurityHeaders } from "../src/lib/security-headers";

export const MAX_BODY_BYTES = 65536; // 64 KiB

export interface BoundedJsonResult<T = unknown> {
  ok: true;
  data: T;
}

export interface BoundedJsonError {
  ok: false;
  response: Response;
}

export async function readBoundedJson<T = unknown>(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
  allowedTypes: string[] = ["application/json"],
): Promise<BoundedJsonResult<T> | BoundedJsonError> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const isTypeAllowed = allowedTypes.some((type) => contentType.includes(type));
  if (!isTypeAllowed) {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: "Unsupported Content-Type. Expected application/json" },
        }) + "\n",
        {
          status: 415,
          headers,
        },
      ),
    };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      const headers = applySecurityHeaders(new Headers(), "json-api-public");
      headers.set("Content-Type", "application/json; charset=utf-8");
      return {
        ok: false,
        response: new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32600, message: `Payload too large. Maximum size is ${maxBytes} bytes.` },
          }) + "\n",
          {
            status: 413,
            headers,
          },
        ),
      };
    }
  }

  if (!request.body) {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Empty request body" },
        }) + "\n",
        {
          status: 400,
          headers,
        },
      ),
    };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel("Payload exceeded maximum allowed size");
          const headers = applySecurityHeaders(new Headers(), "json-api-public");
          headers.set("Content-Type", "application/json; charset=utf-8");
          return {
            ok: false,
            response: new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: `Payload too large. Maximum size is ${maxBytes} bytes.` },
              }) + "\n",
              {
                status: 413,
                headers,
              },
            ),
          };
        }
        chunks.push(value);
      }
    }
  } catch {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Error reading request stream" },
        }) + "\n",
        {
          status: 400,
          headers,
        },
      ),
    };
  }

  const fullBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder("utf-8").decode(fullBuffer);
  try {
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error: Invalid JSON" },
        }) + "\n",
        {
          status: 400,
          headers,
        },
      ),
    };
  }
}
