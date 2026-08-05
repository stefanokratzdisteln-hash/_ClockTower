<p align="right">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a>
</p>

# ClockTower · Trouble Brewing

![ClockTower · Trouble Brewing](public/cover.png)

An unofficial LAN multiplayer companion for Blood on the Clocktower: Trouble Brewing. The Storyteller hosts the game on a computer and manages the Grimoire, seats, characters, night phases, nominations, and voting. Every player joins from a phone on the same local network and receives only the information visible to them.

> Current version: `v1.0.0`<br>
> Supported player count: 5–15<br>
> **Network requirement: an active connection is mandatory. The Storyteller's computer and every player device must be on the same LAN.**

## Features

- Mandatory LAN multiplayer with the Storyteller as host
- Join by room code, player link, or QR code
- Real-time WebSocket synchronization and automatic reconnection
- Automatic or manual Trouble Brewing character assignment
- Private identity reveals, evil-team information, and Demon bluffs
- Storyteller Grimoire, seat ordering, status markers, and custom reminders
- First-night and other-night order with synchronized player actions
- Day discussion, nominations, voting, executions, and dead-vote tracking
- Undo, redo, game log, import, and export
- Dawn and ending cinematics, room audio, and animation controls
- English and Chinese interfaces with responsive desktop and mobile layouts
- SQLite room persistence and deterministic, read-only Storyteller hints
- Installable PWA and replaceable custom artwork

## Tech Stack

- React 19 + Vite 6
- TypeScript 5.9
- Fastify 5 + WebSocket
- Node.js built-in SQLite
- pnpm workspace
- Vitest + Playwright + ESLint + Prettier

## Quick Start

### Requirements

- Node.js 22 or later
- pnpm 11.9.0
- One computer for the Storyteller to use as the host
- Player phones connected to the same Wi-Fi or wired LAN as the host

If pnpm is not installed, enable it through Corepack:

```bash
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

### Install and Run

```bash
git clone https://github.com/stefanokratzdisteln-hash/_ClockTower.git
cd _ClockTower
git switch v1.0.0
pnpm install
pnpm dev
```

Local development addresses:

- Web interface: <http://localhost:5173>
- Server health check: <http://localhost:3000/health>

Windows users may also run `start.bat`. The script currently contains an absolute path for the original development machine, so update that path before using it on another computer.

## LAN Multiplayer (Required)

This project has no offline single-player mode. The Storyteller interface, player interfaces, and server must stay connected throughout the game. Identities, night actions, nominations, and votes are synchronized over the LAN in real time.

### 1. Connect Every Device to the Same Network

Connect the Storyteller's computer and all player phones to the same Wi-Fi or wired LAN. Guest Wi-Fi, router client isolation, and cellular data may prevent the devices from reaching one another.

### 2. Find the Storyteller Computer's LAN Address

Run the following command in Windows PowerShell or Command Prompt:

```powershell
ipconfig
```

Find the active network adapter's `IPv4 Address`, such as `192.168.1.100`. Never send players `127.0.0.1` or `localhost`; those addresses always refer to the player's own device.

### 3. Open the Storyteller Interface Through the LAN Address

After running `pnpm dev`, the Storyteller should open:

```text
http://<storyteller-computer-LAN-IP>:5173
```

For example:

```text
http://192.168.1.100:5173
```

**The Storyteller must create the room from this LAN address.** Player links and QR codes are generated from the address currently open in the browser. If the room is created from `localhost:5173`, the resulting QR code also contains `localhost`, and player phones will not be able to connect.

### 4. Join from Player Devices

After the room has been created, players can:

- Scan the QR code shown in the Storyteller interface;
- Open the player link copied by the Storyteller; or
- Visit `http://<LAN-IP>:5173` and enter the room code and seat name manually.

The Storyteller interface shows each player's online status. Do not close the terminal running `pnpm dev`, allow the host computer to sleep, or switch the host to another network during a game.

### 5. Windows Firewall

Windows may ask for network permission the first time the services start. Allow access on at least private networks. If players cannot open the page, confirm that Node.js is allowed through the firewall. In development mode, players must be able to reach port `5173`; Vite forwards API and WebSocket traffic to port `3000` inside the host computer:

- `5173`: Web interface reached by player devices
- `3000`: API and WebSocket service running on the host; it must also be configured and exposed correctly in a split frontend/backend deployment

### Connection Troubleshooting

| Problem                                  | What to check                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A player cannot open the page            | Use the host's LAN IP instead of `localhost`, and confirm both devices are on the same network            |
| A QR code opens but does not connect     | Reopen the Storyteller interface through the LAN address, then generate the link or QR code again         |
| The page opens but state does not update | Confirm the server is still running, then check terminal errors, the firewall, and WebSocket connectivity |
| Players reconnect repeatedly             | Disable automatic cellular-data switching, stabilize Wi-Fi, and prevent the host from sleeping            |
| Devices cannot connect on the same Wi-Fi | Check the router for AP/client isolation or guest-network restrictions                                    |

## Game Flow

1. Connect every device to the same LAN. The Storyteller starts the project and opens the web interface through the host's LAN IP.
2. The Storyteller creates a room.
3. Share the player link, QR code, or room code.
4. Players join using the same display names shown on their seats.
5. The Storyteller confirms that every player is online, then assigns characters automatically or manually.
6. Follow the interface through identity reveal, first night, day, nominations, voting, and subsequent nights.
7. Open the public review or export the game data when the game ends.

The Storyteller remains the final authority. The rules engine validates phases and actions, but the project does not replace the Storyteller and does not include the published rulebook text.

## Commands

| Command             | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `pnpm dev`          | Start the web and server development processes        |
| `pnpm build`        | Build every workspace package                         |
| `pnpm test`         | Run unit and server tests                             |
| `pnpm test:e2e`     | Build the project and run Playwright end-to-end tests |
| `pnpm typecheck`    | Type-check all TypeScript packages                    |
| `pnpm lint`         | Run ESLint                                            |
| `pnpm format:check` | Check formatting                                      |
| `pnpm format`       | Format the project with Prettier                      |

Install the Playwright browser before running end-to-end tests for the first time:

```bash
pnpm exec playwright install chromium
```

## Configuration

| Environment variable | Default                  | Description                                                                       |
| -------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `PORT`               | `3000`                   | Fastify server port                                                               |
| `CLOCKTOWER_DB_PATH` | `data/clocktower.sqlite` | SQLite database path                                                              |
| `VITE_API_URL`       | Same origin              | API address used by the web client; set it for split frontend/backend deployments |

During development, Vite proxies `/api` and `/ws` to `localhost:3000`.

## Project Structure

```text
.
├─ apps/
│  ├─ web/              # React web app and mobile player interface
│  └─ server/           # Fastify API, WebSocket, and room persistence
├─ packages/
│  ├─ rules-engine/     # Game state, phases, characters, and action validation
│  └─ shared/           # Types shared by the client and server
├─ tests/e2e/           # Playwright multiplayer and localization tests
├─ docs/                # Asset specification and recorded rules judgments
└─ public/              # Project images, audio, and cinematic assets
```

## Custom Artwork

Place custom assets in `apps/web/public/assets/user/` using the exact filenames and dimensions in [`docs/ASSET_SPEC.md`](docs/ASSET_SPEC.md). When an asset is missing, the interface continues to use its built-in CSS or existing asset fallback.

Do not bake buttons or interface text into background artwork, as that would interfere with localization and responsive layouts.

## Data and Security

- Room state is stored in a local SQLite database at `data/clocktower.sqlite` by default.
- Session tokens are persisted as hashes, and players receive only the information visible to their characters.
- The current suggestion service is local, read-only, and deterministic. It makes no external AI network requests and cannot modify game state directly.
- The project does not yet include the complete account system, rate limiting, or reverse-proxy configuration required for a public deployment. Add HTTPS, access control, backups, and monitoring before exposing it to the internet.

## Copyright Notice

This is an unofficial game companion and is not affiliated with or endorsed by the original game's publisher or rights holders. All related game names, characters, rules, and artwork remain the property of their respective owners. Use only assets for which you have the necessary rights, and comply with all applicable licenses and copyright requirements.
