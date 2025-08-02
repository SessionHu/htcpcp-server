import net from 'node:net';
import EventEmitter from 'node:events';
import { STATUS_CODES } from 'node:http';

import * as httptext from './httptext';

const onconnection = async (s: net.Socket, that: HttpServer) => {
  console.log('Client connected!');

  s.on('error', (err) => {
    console.error('An error occurred:', err);
    // 构造一个 400 错误响应
    const body = Buffer.from((err as Error).stack || String(err));
    if (!s.writableEnded) {
      s.write(`HTTP/1.1 400 Bad Request\ncontent-length: ${body.length}\n\n`);
      s.write(body);
      s.end();
    }
  });


  let rawData: Buffer;
  let requestLine: httptext.RequestLine;
  let headers: Map<string, string>;
  let body: Buffer;

  // 监听 'data' 事件来获取所有数据
  s.on('data', function ondata(chunk) {
    try {
      rawData = rawData ? Buffer.concat([rawData, chunk]) : chunk;

      // 找到请求头和 body 的分隔符，也就是 CRLF CRLF
      const headersEndIndex = rawData.indexOf('\r\n\r\n');
      if (headersEndIndex !== -1 && !headers) {
        // 如果找到了分隔符，说明请求头已经完整了
        const headersSection = rawData.subarray(0, headersEndIndex).toString();

        // 解析请求头
        const tempheaders = new Array<[string, string]>;
        const lines = headersSection.split(/\r?\n/);
        requestLine = httptext.parseRequestLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line.length === 0) continue; // 忽略空行
          if (httptext.LWS_START_REGEX.test(line)) {
            const last = tempheaders.pop();
            if (!last) throw new Error('Unexpected fold in headers');
            last[1] += httptext.parseMessageHeaderFold(line);
            tempheaders.push(last);
          } else tempheaders.push(httptext.parseMessageHeaderStart(line));
        }
        headers = new Map(tempheaders);
      }
      if (headers) {
        // 根据 Content-Length 头部来判断 body 的长度
        const bodySection = rawData.subarray(headersEndIndex + 4);
        const contentLengthStr = headers.get('content-length');
        const contentLength = contentLengthStr ? parseInt(contentLengthStr) : 0;
        if (isNaN(contentLength)) throw new Error('Invalid Content-Length header');
        if (contentLength > 0 && bodySection.length >= contentLength) {
          body = bodySection.subarray(0, contentLength);
          s.removeListener('data', ondata);
          that.emit('conn', requestLine, headers, body, new HttpResponse(s));
        } else if (contentLength === 0) {
          // 如果没有 body 或者 Content-Length 是 0，直接处理
          that.emit('conn', requestLine, headers, body, new HttpResponse(s));
        }
      }
    } catch (e) {
      s.emit('error', e);
    }
  });

  s.on('end', () => {
    console.log('Client disconnected.');
  });
}

class HttpServer extends EventEmitter {
  #sserver = net.createServer();
  constructor() {
    super();
    this.#sserver.on('connection', (s) => {
      onconnection(s, this);
    });
  }
  listen(port: number, cb: () => void) {
    this.#sserver.listen(port, cb);
  }
};

export class HttpResponse {
  readonly #s: net.Socket;
  constructor(s: net.Socket) {
    this.#s = s;
  }
  readonly #headers = new Map<string, string>;
  /**
   * 0: status line
   * 1: headers
   * 2: body
   * 3: ended
   */
  #state = 0;
  writeStatusLine(status = 200, reason?: string) {
    if (this.#state > 0)
      throw new Error('Cannot write status line after written');
    else if (status < 100 || status > 999 || !Number.isInteger(status))
      throw new Error('Invalid status code');
    else if (reason?.includes('\r') || reason?.includes('\n'))
      throw new Error('Invalid reason phrase');
    let sl = `HTTP/1.1 ${status} `;
    sl += reason || STATUS_CODES[status] || 'unknown';
    sl += '\r\n';
    this.#s.write(sl);
    this.#state = 1;
  }
  setHeader(name: string, value: string) {
    if (!httptext.isToken(name)) throw new Error('Invalid field name');
    else if (httptext.hasCTL(value)) throw new Error('Invalid field value');
    this.#headers.set(name.toLocaleLowerCase('en-US'), value);
  }
  getHeader(name: string) {
    return this.#headers.get(name.toLocaleLowerCase('en-US'));
  }
  writeHeaders() {
    if (!this.#headers.get('content-length'))
      throw new Error('Content-Length header is required');
    else if (this.#state < 1) throw new Error('Cannot write headers before status line');
    else if (this.#state > 1) throw new Error('Cannot write headers after written');
    for (const [name, value] of this.#headers) {
      this.#s.write(`${name}: ${value}\r\n`);
    }
    this.#s.write('\r\n');
    this.#state = 2;
  }
  writeBodyEnd(chunk: Buffer | string) {
    if (this.#state < 2) throw new Error('Cannot write body before headers');
    else if (this.#state > 2) throw new Error('Cannot write body after ended');
    if (typeof chunk === 'string') chunk = Buffer.from(chunk);
    if (Number(this.#headers.get('content-length')) !== chunk.length)
      throw new Error('Chunk length does not match Content-Length header');
    this.#s.write(chunk);
    this.#s.end();
  }
}

export const createServer = (onconn: (reql: httptext.RequestLine, headers: Map<string, string>, body: Buffer | undefined, resp: HttpResponse) => void) => {
  return new HttpServer().on('conn', onconn);
}
