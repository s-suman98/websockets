# Pulse WebSocket POC

A small React + Spring Boot demo that broadcasts a simulated stock price to every connected browser once per second and shows the current WebSocket connection count.

## Run with Docker Compose

From the project root:

```sh
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) in one or more browser tabs. Each tab is counted as a connected device. The Spring Boot service is also available directly on port `8080`; its WebSocket endpoint is `ws://localhost:8080/ws`.

To stop the services, press `Ctrl+C`, then run `docker compose down`.

## Run locally without Docker

Start the Spring Boot backend from the `backend` directory with `mvn spring-boot:run`. In a second terminal, start the frontend from `frontend`:

```sh
npm install
npm run dev
```

Open the URL printed by Vite (usually [http://localhost:5173](http://localhost:5173)). Vite forwards the `/ws` WebSocket connection to the backend on port `8080`.

## WebSocket messages

The server sends JSON messages on connect/disconnect and every price tick:

```json
{"type":"price","symbol":"POC","price":182.73,"change":0.24,"timestamp":"2026-10-01T12:00:00Z","connectedDevices":2}
```

Connection updates have `type: "status"` and include `connectedDevices` and `timestamp`. Prices are simulated and are not financial data.

Clients can also send a JSON message on the same `/ws` connection. The server broadcasts it to all client connections and sends the sender a separate acknowledgement:

```json
{"type":"chat","message":"Hello from a client","messageId":"msg-001"}
```

The sender receives `type: "ack"` (including `messageId` when supplied); clients receive a `type: "chat"` broadcast. The web UI has a message box below the dashboard and displays the acknowledgement.

## WebSocket endpoints and API reference

| Endpoint | Purpose |
| --- | --- |
| `ws://localhost:8080/ws` | Client price stream and two-way chat messages |
| `ws://localhost:8080/ws/admin` | Read-only admin monitor: initial client snapshot, then refreshed snapshots on client connect/disconnect |

The admin snapshot includes the WebSocket session ID, the remote IP observed by the backend, the `User-Agent` string, and connection time. The IP can be a proxy or Docker network address, and `User-Agent` is a client-provided label rather than a verified hardware identity. The admin endpoint currently has no authentication, so keep it on a trusted local network and add access control before exposing it.

Connect to inspect admin events from a terminal:

```sh
npx wscat -c ws://localhost:8080/ws/admin
```

The machine-readable API reference is [docs/websocket-api.yaml](docs/websocket-api.yaml), written in AsyncAPI format for WebSocket events (the WebSocket equivalent of an OpenAPI/Swagger reference).
