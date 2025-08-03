import net from 'node:net';
import EventEmitter from 'node:events';
import { STATUS_CODES } from 'node:http';

import * as httptext from './httptext';

const onconnection = async (s: net.Socket, that: HttpServer) => {
  console.log('Client connected!');

  s.on('error', (err) => {
    console.error('An error occurred:', err);
    const body = Buffer.from((err as Error).stack || String(err));
    if (!s.writableEnded) {
      s.write(`HTTP/1.1 400 Bad Request\ncontent-length: ${body.length}\n\n`);
      s.write(body);
      s.end();
    }
  });

  let rawData: Buffer;

  s.on('data', function ondata(chunk) {
    try {
      rawData = rawData ? Buffer.concat([rawData, chunk]) : chunk;

      while (true) {
        let requestLine: httptext.RequestLine;
        let headers: Map<string, string>;
        let body: Buffer;

        // 寻找请求头结束标记
        const headersEndIndex = rawData.indexOf('\r\n\r\n');
        if (headersEndIndex === -1) break;

        // 解析请求头
        const headersSection = rawData.subarray(0, headersEndIndex).toString();
        const tempheaders = new Array<[string, string]>();
        const lines = headersSection.split(/\r?\n/);
        requestLine = httptext.parseRequestLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (httptext.LWS_START_REGEX.test(line)) {
            const last = tempheaders.pop();
            if (!last) throw new Error('Unexpected fold in headers');
            last[1] += httptext.parseMessageHeaderFold(line);
            tempheaders.push(last);
          } else {
            tempheaders.push(httptext.parseMessageHeaderStart(line));
          }
        }
        headers = new Map(tempheaders);

        // 根据 Content-Length 判断请求体长度
        const contentLengthStr = headers.get('content-length');
        const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;
        if (isNaN(contentLength)) throw new Error('Invalid Content-Length header');

        const requestTotalLength = headersEndIndex + 4 + contentLength;

        // 检查整个请求是否已完整接收
        if (rawData.length < requestTotalLength) break;
        body = rawData.subarray(headersEndIndex + 4, requestTotalLength);
        that.emit('conn', requestLine, headers, body, new HttpResponse(s));

        // 切掉已经处理完的请求数据留下后面的部分
        rawData = rawData.subarray(requestTotalLength);

        // 如果 rawData 被切空了就没必要继续循环了
        if (rawData.length === 0) break;

        // 继续下一次 while 循环处理缓冲区里可能存在的下一个请求
      }
    } catch (e) {
      s.emit('error', e);
    }
  });

  s.on('end', () => {
    console.log('Client disconnected.');
  });
};

interface HttpServerEvents {
  'conn': (reql: httptext.RequestLine, headers: Map<string, string>, body: Buffer, resp: HttpResponse) => void;
}


class HttpServer extends EventEmitter {
  #sserver = net.createServer();

  constructor() {
    super();
    this.#sserver.on('connection', (socket) => {
      onconnection(socket, this);
    });
  }

  public listen(port: number, cb?: () => void): this {
    this.#sserver.listen(port, cb);
    return this;
  }

  public on<T extends keyof HttpServerEvents>(event: T, listener: HttpServerEvents[T]): this;
  public on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  public emit<T extends keyof HttpServerEvents>(event: T, ...args: Parameters<HttpServerEvents[T]>): boolean;
  public emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}


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
