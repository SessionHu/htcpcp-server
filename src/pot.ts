export type Pot = _Pot;
abstract class _Pot {
  #path: string;
  get path() {
    return this.#path;
  }
  constructor(path: string) {
    this.#path = path;
  }
  abstract start(mediatype: string, additions: string[]): string;
  abstract stop(mediatype: string): string;
  info(): string {
    return `${this.path}: ${Object.getPrototypeOf(this).constructor.name} @ ${this.status} < [ ${this.additions.join(', ')} ]`;
  }
  #status: 'idle' | 'brewing' = 'idle';
  protected set status(status: 'idle' | 'brewing') {
    this.#status = status;
  }
  get status() {
    return this.#status;
  }
  #additions: string[] = [];
  protected set additions(additions: string[]) {
    this.#additions = additions;
  }
  get additions() {
    return this.#additions;
  }
}

/**
 * @see https://httpbin.org/status/418
 */
const IM_A_TEAPOT_ASCII_ART = `

    -=[ teapot ]=-

       _...._
     .'  _ _ \`.
    | ."\` ^ \`". _,
    \\_;\`"---"\`|//
      |       ;/
      \\_     _/
        \`"""\`

`

export class HtcpcpError extends Error {
  name = 'HtcpcpError';
  #code = 400;
  get code() {
    return this.#code;
  }
  set code(code: number) {
    if (code < 100 || code > 599) {
      throw new Error('Invalid status code');
    }
    this.#code = code;
  }
  constructor(message: string, code?: number) {
    super(message);
    if (code) this.code = code;
  }
}

export class TeaPot extends _Pot {
  start(mediatype: string, additions: string[]): string {
    if (mediatype !== 'message/teapot') {
      throw new HtcpcpError(IM_A_TEAPOT_ASCII_ART, 418);
    } else if ('brewing' === this.status) {
      throw new HtcpcpError('I\'m already brewing!', 409);
    }
    this.status = 'brewing';
    this.additions = additions;
    return this.path + ': Starting brewing...';
  }
  stop(mediatype: string): string {
    if (mediatype !== 'message/teapot') {
      throw new HtcpcpError(IM_A_TEAPOT_ASCII_ART, 418);
    }
    this.status = 'idle';
    this.additions = [];
    return this.path + ': Stopped brewing...';
  }
}

export class CoffeePot extends _Pot {
  start(mediatype: string, additions: string[]): string {
    if (mediatype !== 'message/coffeepot'
      && mediatype !== 'application/coffee-pot-command')
    {
      throw new HtcpcpError('Sorry, I can only brew coffee.', 415);
    } else if ('brewing' === this.status) {
      throw new HtcpcpError('I\'m already brewing!', 409);
    }
    this.status = 'brewing';
    this.additions = additions;
    return this.path + ': Starting brewing...';
  }
  stop(mediatype: string): string {
    if (mediatype !== 'message/coffeepot'
      && mediatype !== 'application/coffee-pot-command')
    {
      throw new HtcpcpError('Sorry, I can only brew coffee.', 415);
    }
    this.status = 'idle';
    this.additions = [];
    return this.path + ': Stopped brewing...';
  }
}
