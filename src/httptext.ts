export interface RequestLine {
  method: string;
  requestUri: string;
  httpVersion: string;
}

export function parseRequestLine(reqline: string): RequestLine {
  reqline = reqline.replace(/\r?\n?$/, '');
  const parts = reqline.split(' ');
  if (parts.length !== 3) throw new Error('Invalid request line format');
  const [ method, requestUri, httpVersion ] = parts;
  if (!isToken(method))
    throw new Error('Invalid method');
  else if (!isRequestUri(requestUri))
    throw new Error('Invalid request URI');
  else if (!isHttpVersion(httpVersion))
    throw new Error('Invalid HTTP version');
  return { method, requestUri, httpVersion };
}

const TSPECIALS = new Set(...'()<>@,;:\\"/[]?={}\x20\x09');
function hasTspecials(s: string): boolean {
  for (const c of s) {
    if (TSPECIALS.has(c)) return true;
  }
  return false;
}

export function hasCTL(s: string): boolean {
  for (const c of s) {
    const n = c.codePointAt(0)!;
    if ((n >= 0 && n <= 31) || n == 127) return true;
  }
  return false;
}

function isCHARs(s: string): boolean {
  for (const c of s) {
    const n = c.codePointAt(0)!;
    if (n < 0 || n > 127) return false;
  }
  return true;
}

export function isToken(s: string): boolean {
  return (hasCTL(s) || hasTspecials(s)) ? false : isCHARs(s);
}

const HTTP_VERSION_REGEX = /^HTTP\/\d+\.\d+$/;
function isHttpVersion(s: string): boolean {
  return HTTP_VERSION_REGEX.test(s);
}

function isRequestUri(s: string): boolean {
  if (s === '*') return true;
  // abs_path
  if (s[0] === '/') s = 'coffee:' + s; // yeah, 'cause here 's htcpcp
  // absoluteURI
  try {
    new URL(s); // is uri?
    return true;
  } catch (e) {
    // not uri
    console.debug(e);
    return false;
  }
}

const LWS_REGEX = /(\r\n)|\x09|\x20/g;
export const LWS_START_REGEX = /^((\r\n)|\x09|\x20)+/;

export function parseMessageHeaderStart(msgh: string) {
  msgh = msgh.replace(/\r?\n?$/, '');
  const colonIndex = msgh.indexOf(':');
  const fieldName = msgh.substring(0, colonIndex);
  if (!isToken(fieldName)) throw new Error('Invalid field name');
  const fieldValue = msgh.substring(colonIndex + 1).replaceAll(LWS_REGEX, ' ').replace(LWS_START_REGEX, '');
  if (hasCTL(fieldValue)) throw new Error('Invalid field value');
  return [ fieldName.toLocaleLowerCase('en-US'), fieldValue ] as [ string, string ];
}

export function parseMessageHeaderFold(line: string) {
  line = line.replace(/\r?\n?$/, '').replaceAll(LWS_REGEX, ' ');
  if (hasCTL(line)) throw new Error('Invalid field value');
  return line;
}
