# htcpcp-server

This is an [HTCPCP/1.0](https://rfc-editor.org/rfc/rfc2324) server implemented in Node.js and TypeScript!

Also supports [HTCPCP-TEA](https://rfc-editor.org/rfc/rfc7168).

## ✨ Features

-   Implements `BREW`, `POST`, `GET` methods.
-   Supports both coffee pots (`message/coffeepot`) and teapots (`message/teapot`).
-   Can `start` and `stop` the brewing process.
-   Provides an API to get the status of the pots.
-   HTTP/1.1 418 I'm a teapot

> Includes a custom HTTP server because Node.js's native module lacks full support for HTCPCP methods like BREW.

## 🚀 Quick Start

### Install Dependencies

```bash
yarn
```

### Run the Development Server

The server will run on `http://localhost:8000`.

```bash
yarn dev
```

### Build the Server

```bash
yarn build
```

## ☕️ API Usage Example

Full documentation in RFC 2324 and RFC 7168. Examples below:

### Get Information for All Pots

```bash
curl http://localhost:8000/
```

### Get Information for a Specific Pot (e.g., the teapot at /pot-1)

```bash
curl http://localhost:8000/pot-1
```

### Start Brewing Coffee

```bash
curl -X BREW http://localhost:8000/pot-0 \
  -H 'Content-Type: message/coffeepot' \
  -d 'start'
```

### Stop Brewing Coffee

```bash
curl -X BREW http://localhost:8000/pot-0 \
  -H 'Content-Type: message/coffeepot' \
  -d 'stop'
```

### I'm a teapot

```bash
curl -X BREW http://localhost:8000/pot-1 \
  -H 'Content-Type: message/coffeepot' \
  -d 'start'
```

## 🤝 License

This project is licensed under the [MIT License](LICENSE).
