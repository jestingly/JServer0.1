# JEST® Server v0.1

Lightweight Node.js WebSocket server for the JEST® JavaScript Game Engine.

The server uses the [`ws`](https://github.com/websockets/ws) package and listens on **port 8080** by default. The JEST game client connects separately; no standalone `client.html` is required.

## Requirements

- Node.js and npm
- Git (only needed to clone the repository)

### Install Node.js on macOS

If you use Homebrew:

```bash
brew install node
```

Verify the installation:

```bash
node -v
npm -v
```

## Install

Clone your server repository (substitute its actual GitHub URL):

```bash
git clone <YOUR-REPOSITORY-URL>
cd <YOUR-REPOSITORY-DIRECTORY>
```

Install dependencies:

```bash
npm ci
```

`npm ci` uses the committed `package-lock.json`. If you are setting up the project without a lockfile, use `npm install` instead.

**Do not commit `node_modules/`.** npm creates it locally when dependencies are installed.

## Run

Start the server:

```bash
node jserver.js
```

The server listens at:

```text
ws://localhost:8080
```

Keep the terminal open while using the server. Press **Control+C** to stop it.

## Connect the JEST game client

For a game client running on the **same computer**, connect to:

```text
ws://localhost:8080
```

For a game client on **another device on the same local network**, use the server computer's LAN IP address, for example:

```text
ws://X.X.X.X:8080
```

On macOS, the Wi-Fi address can often be found with:

```bash
ipconfig getifaddr en0
```

The server computer's firewall must allow the connection. `localhost` refers to the device running the client, so it will not reach another computer.

**Note:** `ws://` is suitable for local development. A game served over HTTPS generally needs a properly configured `wss://` endpoint for remote connections.

## Repository files

```text
jest-server/
├── jserver.js          # WebSocket server implementation
├── package.json        # Node dependency manifest
├── package-lock.json   # Locked dependency versions
├── .gitignore          # Local files excluded from Git
└── README.md           # Installation and usage instructions
```

## Updating dependencies

After changing `package.json`, run:

```bash
npm install
```

Commit the updated `package.json` and `package-lock.json` together.
