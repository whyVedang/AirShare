import WebSocket from "ws";
import { randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULTS = {
  clients: 150,
  rooms: 3,
  holdMs: 60_000,
  connectTimeoutMs: 30_000,
  joinTimeoutMs: 30_000,
  rampMs: 25,
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }

  args.clients = Number(args.clients);
  args.rooms = Number(args.rooms);
  args.holdMs = Number(args.holdMs);
  args.connectTimeoutMs = Number(args.connectTimeoutMs);
  args.joinTimeoutMs = Number(args.joinTimeoutMs);
  args.rampMs = Number(args.rampMs);

  return args;
}

function usage() {
  return `
AirShare WebSocket Backend Stress Test

Usage:
  node scripts/ws-connection-stress.js --url ws://localhost:5000
  node scripts/ws-connection-stress.js --url wss://your-render-app.onrender.com --clients 150 --rooms 3 --holdMs 60000 --out ../../reports/section7_assets/ws_stress_150_results.json --csv ../../reports/section7_assets/ws_stress_150_clients.csv

Options:
  --url               WebSocket URL. Required. Use ws:// for local, wss:// for Render.
  --clients           Number of simulated WebSocket clients. Default: 150
  --rooms             Number of rooms to distribute clients across. Default: 3
  --holdMs            How long to keep joined clients connected. Default: 60000
  --connectTimeoutMs  Time allowed for socket open events. Default: 30000
  --joinTimeoutMs     Time allowed for existing-peers join acknowledgements. Default: 30000
  --rampMs            Delay between starting each connection. Default: 25
  --apiUrl            HTTP API URL used to create valid rooms. Defaults from --url.
  --out               Optional JSON summary output path.
  --csv               Optional per-client CSV output path.

Notes:
  The backend currently caps rooms at 50 peers, so 150 clients should use 3 rooms.
`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function deriveApiUrl(wsUrl) {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.origin;
}

async function createRooms(count, apiUrl) {
  const rooms = [];

  for (let i = 0; i < count; i += 1) {
    const response = await fetch(`${apiUrl}/api/v1/room/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to create room ${i + 1}: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!/^[A-Z0-9]{8}$/.test(data.roomID || "")) {
      throw new Error(`Backend returned invalid room ID: ${data.roomID}`);
    }

    rooms.push(data.roomID);
  }

  return rooms;
}

function toCsvCell(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function makeClient(index, roomId, url, startedAt) {
  const peerId = randomUUID();
  const record = {
    index: index + 1,
    peerId,
    roomId,
    opened: false,
    joined: false,
    cleanClose: false,
    closedBeforeCleanup: false,
    openMs: null,
    joinMs: null,
    existingPeers: 0,
    newPeerMessages: 0,
    peerDisconnectedMessages: 0,
    errors: [],
    closeCode: null,
    closeReason: "",
  };

  const ws = new WebSocket(url);

  ws.on("open", () => {
    record.opened = true;
    record.openMs = Date.now() - startedAt;
    ws.send(JSON.stringify({
      type: "join-room",
      payload: {
        roomID: roomId,
        peerID: peerId,
      },
    }));
  });

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());

      if (message.type === "existing-peers") {
        record.joined = true;
        record.joinMs = Date.now() - startedAt;
        record.existingPeers = Array.isArray(message.payload) ? message.payload.length : 0;
      }

      if (message.type === "new-peer") {
        record.newPeerMessages += 1;
      }

      if (message.type === "peer-disconnected") {
        record.peerDisconnectedMessages += 1;
      }

      if (message.type === "error") {
        record.errors.push(message.payload?.message || message.message || "backend error");
      }
    } catch (error) {
      record.errors.push(`invalid-json-message: ${error.message}`);
    }
  });

  ws.on("error", (error) => {
    record.errors.push(error.message);
  });

  ws.on("close", (code, reason) => {
    record.closeCode = code;
    record.closeReason = reason?.toString() || "";
    if (!record.cleanClose) {
      record.closedBeforeCleanup = true;
    }
  });

  return { ws, record };
}

function summarize(records, config, startedAt, endedAt) {
  const opened = records.filter((r) => r.opened).length;
  const joined = records.filter((r) => r.joined).length;
  const failedToOpen = records.filter((r) => !r.opened).length;
  const failedToJoin = records.filter((r) => r.opened && !r.joined).length;
  const unexpectedCloses = records.filter((r) => r.closedBeforeCleanup).length;
  const clientErrors = records.reduce((sum, r) => sum + r.errors.length, 0);
  const totalNewPeerMessages = records.reduce((sum, r) => sum + r.newPeerMessages, 0);
  const totalPeerDisconnectedMessages = records.reduce((sum, r) => sum + r.peerDisconnectedMessages, 0);
  const successful = joined === config.clients && unexpectedCloses === 0 && clientErrors === 0;

  const roomCounts = records.reduce((acc, r) => {
    acc[r.roomId] ||= { opened: 0, joined: 0, clients: 0 };
    acc[r.roomId].clients += 1;
    if (r.opened) acc[r.roomId].opened += 1;
    if (r.joined) acc[r.roomId].joined += 1;
    return acc;
  }, {});

  return {
    testName: "AirShare WebSocket Backend Stress Test",
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationMs: endedAt - startedAt,
    url: config.url,
    requestedClients: config.clients,
    rooms: config.rooms,
    holdMs: config.holdMs,
    opened,
    joined,
    failedToOpen,
    failedToJoin,
    unexpectedCloses,
    clientErrors,
    totalNewPeerMessages,
    totalPeerDisconnectedMessages,
    success: successful,
    roomCounts,
  };
}

async function writeJson(path, data) {
  const fullPath = resolve(path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeCsv(path, records) {
  const fullPath = resolve(path);
  await mkdir(dirname(fullPath), { recursive: true });
  const headers = [
    "index",
    "peerId",
    "roomId",
    "opened",
    "joined",
    "openMs",
    "joinMs",
    "existingPeers",
    "newPeerMessages",
    "closedBeforeCleanup",
    "errorCount",
    "errors",
  ];
  const lines = [
    headers.join(","),
    ...records.map((record) => headers.map((header) => {
      if (header === "errorCount") return record.errors.length;
      if (header === "errors") return toCsvCell(record.errors.join("; "));
      return toCsvCell(record[header]);
    }).join(",")),
  ];
  await writeFile(fullPath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.url) {
    console.error("Missing required --url option.");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const maxPerRoom = Math.ceil(args.clients / args.rooms);
  if (maxPerRoom > 50) {
    console.error(`Invalid config: ${args.clients} clients across ${args.rooms} rooms means ${maxPerRoom} clients/room.`);
    console.error("AirShare currently limits each room to 50 peers. Increase --rooms or lower --clients.");
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const apiUrl = args.apiUrl || deriveApiUrl(args.url);
  const roomIds = await createRooms(args.rooms, apiUrl);
  const clients = [];

  console.log(`[${nowIso()}] Starting ${args.clients} WebSocket clients across ${args.rooms} room(s).`);
  console.log(`[${nowIso()}] Target: ${args.url}`);
  console.log(`[${nowIso()}] Created rooms via ${apiUrl}: ${roomIds.join(", ")}`);

  for (let i = 0; i < args.clients; i += 1) {
    const roomId = roomIds[i % args.rooms];
    clients.push(makeClient(i, roomId, args.url, startedAt));
    if (args.rampMs > 0) await sleep(args.rampMs);
  }

  const connectDeadline = Date.now() + args.connectTimeoutMs;
  while (Date.now() < connectDeadline && clients.some((c) => !c.record.opened && c.record.errors.length === 0)) {
    await sleep(250);
  }

  const joinDeadline = Date.now() + args.joinTimeoutMs;
  while (Date.now() < joinDeadline && clients.some((c) => c.record.opened && !c.record.joined && c.record.errors.length === 0)) {
    await sleep(250);
  }

  const joined = clients.filter((c) => c.record.joined).length;
  console.log(`[${nowIso()}] Joined clients: ${joined}/${args.clients}. Holding for ${args.holdMs}ms.`);
  await sleep(args.holdMs);

  for (const client of clients) {
    client.record.cleanClose = true;
    if (client.ws.readyState === WebSocket.OPEN || client.ws.readyState === WebSocket.CONNECTING) {
      client.ws.close(1000, "stress-test-complete");
    }
  }

  await sleep(1_000);

  const endedAt = Date.now();
  const records = clients.map((client) => client.record);
  const summary = summarize(records, args, startedAt, endedAt);

  console.log("\n=== AirShare WebSocket Stress Summary ===");
  console.log(JSON.stringify(summary, null, 2));

  if (args.out) {
    await writeJson(args.out, { summary, clients: records });
    console.log(`\nWrote JSON results: ${resolve(args.out)}`);
  }

  if (args.csv) {
    await writeCsv(args.csv, records);
    console.log(`Wrote CSV results: ${resolve(args.csv)}`);
  }

  process.exitCode = summary.success ? 0 : 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
