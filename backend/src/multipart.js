import { badRequest } from "./http.js";

const headerSeparator = Buffer.from("\r\n\r\n");
const lineBreak = Buffer.from("\r\n");

export function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};

  let cursor = buffer.indexOf(delimiter);
  if (cursor === -1) {
    throw badRequest("Multipart boundary was not found in request body.");
  }

  while (cursor !== -1) {
    cursor += delimiter.length;

    if (buffer.subarray(cursor, cursor + 2).toString() === "--") {
      break;
    }

    if (buffer.subarray(cursor, cursor + 2).equals(lineBreak)) {
      cursor += 2;
    }

    const headerEnd = buffer.indexOf(headerSeparator, cursor);
    if (headerEnd === -1) {
      break;
    }

    const headers = parsePartHeaders(buffer.subarray(cursor, headerEnd).toString("utf8"));
    const bodyStart = headerEnd + headerSeparator.length;
    const nextDelimiter = buffer.indexOf(delimiter, bodyStart);
    if (nextDelimiter === -1) {
      break;
    }

    let bodyEnd = nextDelimiter;
    if (buffer.subarray(bodyEnd - 2, bodyEnd).equals(lineBreak)) {
      bodyEnd -= 2;
    }

    const body = buffer.subarray(bodyStart, bodyEnd);
    const disposition = headers["content-disposition"] ?? "";
    const name = getDispositionValue(disposition, "name");
    const filename = getDispositionValue(disposition, "filename");

    if (name && filename) {
      files[name] = {
        filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        buffer: body
      };
    } else if (name) {
      fields[name] = body.toString("utf8");
    }

    cursor = nextDelimiter;
  }

  return { fields, files };
}

function getBoundary(contentType = "") {
  const match = contentType.match(/boundary="?([^";]+)"?/i);
  if (!match) {
    throw badRequest("Content-Type must include a multipart boundary.");
  }
  return match[1];
}

function parsePartHeaders(rawHeaders) {
  return rawHeaders.split("\r\n").reduce((headers, line) => {
    const index = line.indexOf(":");
    if (index === -1) {
      return headers;
    }

    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
    return headers;
  }, {});
}

function getDispositionValue(disposition, key) {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return match ? match[1] : null;
}
