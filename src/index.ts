import * as httpserver from './httpserver';
import * as pot from './pot';

const pots = new Array<pot.Pot>;

pots.push(new pot.CoffeePot('/pot-0'));
pots.push(new pot.TeaPot('/pot-1'));

function handleBrew(path: string, headers: Map<string, string>, body: Buffer, resp: httpserver.HttpResponse) {
  // check content-type header
  const contentType = headers.get('content-type');
  if (!contentType || (
    // https://www.rfc-editor.org/rfc/rfc2324.html#section-4
    contentType !== 'message/coffeepot' &&
    // https://www.rfc-editor.org/rfc/rfc2324.html#section-2.1.1
    contentType !== 'application/coffee-pot-command' &&
    // https://www.rfc-editor.org/rfc/rfc7168.html#section-3
    contentType !== 'message/teapot'
  )) {
    const payload = Buffer.from(
      'The Content-Type header of a POST or BREW request sent to a\n' +
      'pot MUST be "message/teapot" or "message/coffeepot".\n'
    );
    resp.writeStatusLine(415);
    resp.setHeader('connection', 'close');
    resp.setHeader('content-type', 'text/plain');
    resp.setHeader('content-length', payload.length.toString());
    resp.writeHeaders();
    resp.writeBodyEnd(payload);
    return;
  }
  let payloadstr: string;
  let status = 200;
  // get pot
  const tpot = pots.find(p => p.path === path);
  if (!tpot) {
    status = 404;
    // ps: the `Sorr` is not typo
    payloadstr = 'Sorr, no pot found for '+ path;
  } else try {
    const additions = headers.get('accept-additions')?.split(/,\s*/) || [];
    const command = body.toString('utf8').trim();
    if (command === 'start') {
      payloadstr = tpot.start(contentType, additions);
    } else if (command === 'stop') {
      payloadstr = tpot.stop(contentType);
    } else {
      payloadstr = 'Invalid command';
      status = 422;
    }
  } catch (e) {
    status = e instanceof pot.HtcpcpError ? e.code : 500;
    payloadstr = e instanceof Error ? e.stack || e.toString() : String(e);
  }
  // send
  const payload = Buffer.from(payloadstr + '\n');
  resp.writeStatusLine(status);
  resp.setHeader('connection', 'close');
  resp.setHeader('content-type', 'text/plain');
  resp.setHeader('content-length', payload.length.toString());
  resp.writeHeaders();
  resp.writeBodyEnd(payload);
}

const server = httpserver.createServer((reql, headers, body, resp) => {
  const path = new URL((reql.requestUri[0] === '/' ? 'coffee:' : '') + reql.requestUri).pathname;
  if (reql.method === 'BREW' || reql.method === 'POST') {
    handleBrew(path, headers, body, resp);
  } else {
    resp.writeStatusLine(200);
    resp.setHeader('connection', 'close');
    resp.setHeader('content-type', 'text/plain');
    resp.setHeader('content-length', '15');
    resp.writeHeaders();
    resp.writeBodyEnd('Hello, HTCPCP!\n');
  }
});

server.listen(8000, () => {
  console.log('Server is running on port 8000');
});
