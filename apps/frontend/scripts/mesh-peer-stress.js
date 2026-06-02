import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  url: "http://localhost",
  apiUrl: "http://localhost:5000",
  room: "",
  receivers: 14,
  file: "C:/tmp/airshare_mesh_10mb.bin",
  timeoutMs: 180_000,
  settleMs: 3_000,
  channel: "",
  headed: false,
  slowMo: 0,
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

    if (arg === "--headed") {
      args.headed = true;
      continue;
    }

    if (arg === "--headless") {
      args.headed = false;
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

  args.receivers = Number(args.receivers);
  args.timeoutMs = Number(args.timeoutMs);
  args.settleMs = Number(args.settleMs);
  args.slowMo = Number(args.slowMo);

  return args;
}

function usage() {
  return `
AirShare Local Mesh Peer Stress Test

Usage:
  node scripts/mesh-peer-stress.js --url http://localhost --receivers 14 --file C:/tmp/airshare_mesh_10mb.bin --out ../../reports/section7_assets/mesh_14_results.json
  node scripts/mesh-peer-stress.js --url http://localhost:5173 --receivers 14 --headed

Options:
  --url        Frontend URL. Use http://localhost for Docker nginx, or http://localhost:5173 for Vite.
  --apiUrl     Backend HTTP API URL used to create a valid room. Default: http://localhost:5000.
  --room       Existing room code to use. If omitted, the script creates one through --apiUrl.
  --receivers  Number of receiver browser contexts. Default: 14
  --file       File to send from the sender context. Default: C:/tmp/airshare_mesh_10mb.bin
  --timeoutMs  Max time to wait for receivers to download. Default: 180000
  --settleMs   Wait after joins before sending. Default: 3000
  --channel    Browser channel, e.g. chrome or msedge. Useful if Playwright's bundled Chromium is not installed.
  --headed     Show browser windows instead of running headless.
  --out        Optional JSON output path.

Prerequisite:
  Install Playwright in apps/frontend if it is not already available:
    npm install -D playwright
    npx playwright install chromium
`;
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const fallback = "C:/Users/athar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
    if (existsSync(fallback)) {
      return await import(pathToFileURL(fallback).href);
    }
    throw new Error("Playwright is not available. Run: npm install -D playwright && npx playwright install chromium");
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function createRoom(apiUrl) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/v1/room/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!/^[A-Z0-9]{8}$/.test(data.roomID || "")) {
    throw new Error(`Backend returned invalid room ID: ${data.roomID}`);
  }

  return data.roomID;
}

async function joinRoom(page, room) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByPlaceholder("ABCD1234").fill(room);
  await page.getByRole("button", { name: /connect to room/i }).click();
  await page.getByText("Transfer Room").waitFor({ timeout: 30_000 });
}

async function collectRoomState(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText;
    const connectedMatch = bodyText.match(/(\d+)\s+Connected Nodes/i);
    const dataChannelOpens = (bodyText.match(/Data Channel Open/g) || []).length;
    const receivedFiles = (bodyText.match(/Received file:/g) || []).length;
    const doneTransfers = (bodyText.match(/Done:/g) || []).length;

    return {
      connectedNodes: connectedMatch ? Number(connectedMatch[1]) : null,
      dataChannelOpens,
      receivedFiles,
      doneTransfers,
      visibleTextTail: bodyText.slice(-2000),
    };
  });
}

async function waitForConnectedPeers(page, expected, timeoutMs) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const state = await collectRoomState(page);
    if ((state.connectedNodes || 0) >= expected) {
      return state;
    }
    await page.waitForTimeout(1000);
  }

  return collectRoomState(page);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!existsSync(args.file)) {
    console.error(`Test file not found: ${args.file}`);
    console.error("Create one with: fsutil file createnew C:\\tmp\\airshare_mesh_10mb.bin 10485760");
    process.exitCode = 1;
    return;
  }

  const { chromium } = await importPlaywright();
  const startedAt = Date.now();
  const room = args.room || await createRoom(args.apiUrl);
  const downloads = [];
  const launchOptions = {
    headless: !args.headed,
    slowMo: args.slowMo,
  };

  if (args.channel) {
    launchOptions.channel = args.channel;
  }

  const browser = await chromium.launch(launchOptions);

  const contexts = [];

  try {
    console.log(`[${nowIso()}] Opening sender and ${args.receivers} receiver context(s).`);
    console.log(`[${nowIso()}] Frontend: ${args.url}`);
    console.log(`[${nowIso()}] Room: ${room}`);

    const senderContext = await browser.newContext({
      baseURL: args.url,
      acceptDownloads: true,
      viewport: { width: 1440, height: 950 },
    });
    contexts.push(senderContext);
    const sender = await senderContext.newPage();
    sender.on("console", (msg) => console.log(`[sender:${msg.type()}] ${msg.text()}`));

    await joinRoom(sender, room);
    console.log(`[${nowIso()}] Sender joined.`);

    const receiverPages = [];
    for (let i = 0; i < args.receivers; i += 1) {
      const context = await browser.newContext({
        baseURL: args.url,
        acceptDownloads: true,
        viewport: { width: 1280, height: 850 },
      });
      contexts.push(context);
      const page = await context.newPage();
      const receiverIndex = i + 1;

      page.on("download", async (download) => {
        downloads.push({
          receiver: receiverIndex,
          suggestedFilename: download.suggestedFilename(),
          atMs: Date.now() - startedAt,
        });
      });

      await joinRoom(page, room);
      receiverPages.push(page);
      console.log(`[${nowIso()}] Receiver ${receiverIndex}/${args.receivers} joined.`);
    }

    const senderReadyState = await waitForConnectedPeers(sender, args.receivers, 120_000);
    console.log(`[${nowIso()}] Sender connected nodes: ${senderReadyState.connectedNodes}`);
    await sender.waitForTimeout(args.settleMs);

    console.log(`[${nowIso()}] Sending file: ${args.file}`);
    await sender.locator("input[type=file]").setInputFiles(args.file);

    const deadline = Date.now() + args.timeoutMs;
    while (Date.now() < deadline && downloads.length < args.receivers) {
      console.log(`[${nowIso()}] Downloads completed: ${downloads.length}/${args.receivers}`);
      await sender.waitForTimeout(5000);
    }

    const senderState = await collectRoomState(sender);
    const receiverStates = [];
    for (let i = 0; i < receiverPages.length; i += 1) {
      receiverStates.push({
        receiver: i + 1,
        ...(await collectRoomState(receiverPages[i])),
      });
    }

    const result = {
      testName: "AirShare Local Mesh Peer Stress Test",
      startedAt: new Date(startedAt).toISOString(),
      endedAt: nowIso(),
      durationMs: Date.now() - startedAt,
      frontendUrl: args.url,
      room,
      senderFile: args.file,
      requestedReceivers: args.receivers,
      completedDownloads: downloads.length,
      success: downloads.length === args.receivers,
      downloads,
      senderState,
      receiverStates,
    };

    console.log("\n=== AirShare Mesh Stress Summary ===");
    console.log(JSON.stringify(result, null, 2));

    if (args.out) {
      const outPath = resolve(args.out);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      console.log(`\nWrote JSON results: ${outPath}`);
    }

    process.exitCode = result.success ? 0 : 2;
  } finally {
    for (const context of contexts) {
      await context.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
