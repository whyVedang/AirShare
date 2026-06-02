import { mkdtemp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const DEFAULTS = {
  url: "http://localhost",
  receivers: 14,
  file: "C:/tmp/airshare_mesh_10mb.bin",
  timeoutMs: 420_000,
  settleMs: 5_000,
  port: 9222,
  chrome: "C:/Program Files/Google/Chrome/Application/chrome.exe",
};

function parseArgs(argv) {
  const args = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

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
  args.port = Number(args.port);

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(250);
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CDPPage {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.eventWaiters = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });

    this.ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);

        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result || {});
        }

        return;
      }

      if (message.method) {
        this.events.push(message);
        const waiters = this.eventWaiters.get(message.method);
        if (waiters?.length) {
          const waiter = waiters.shift();
          waiter.resolve(message);
          if (waiters.length === 0) this.eventWaiters.delete(message.method);
        }
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30_000);
    });
  }

  async eval(expression, awaitPromise = false) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });

    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Runtime evaluation failed"
      );
    }

    return result.result?.value;
  }

  async waitForEvent(method, timeoutMs = 15_000) {
    const existingIndex = this.events.findIndex((event) => event.method === method);
    if (existingIndex >= 0) {
      const [event] = this.events.splice(existingIndex, 1);
      return event;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) || [];
        this.eventWaiters.set(
          method,
          waiters.filter((waiter) => waiter.resolve !== resolve)
        );
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);

      const waiter = {
        resolve: (event) => {
          clearTimeout(timeoutId);
          resolve(event);
        },
        reject,
      };

      const waiters = this.eventWaiters.get(method) || [];
      waiters.push(waiter);
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    if (typeof this.ws.terminate === "function") {
      this.ws.terminate();
      return;
    }

    this.ws.close();
  }
}

async function newPage(port, url, downloadPath) {
  let response;
  let lastError;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/json/new?${url}`, {
        method: "PUT",
      });

      if (response.ok) break;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  if (!response?.ok) {
    throw new Error(`Failed to create Chrome tab: ${lastError?.message || "unknown error"}`);
  }

  const target = await response.json();
  const page = new CDPPage(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable");
  await page.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath,
  }).catch(() => {});

  await page.send("Page.navigate", { url });
  await page.waitForEvent("Page.loadEventFired").catch(() => {});
  await sleep(1000);

  return page;
}

async function waitForText(page, pattern, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const text = await page.eval("document.body.innerText");
    if (pattern.test(text)) return text;
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function clickGenerateRoom(page) {
  await waitForText(page, /Generate Code/i, 30_000, "home page");

  await page.eval(`
    (() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => /generate code/i.test(candidate.innerText));
      if (!button) throw new Error("Generate Code button not found");
      button.click();
    })()
  `);

  const text = await waitForText(page, /Transfer Room/i, 30_000, "sender room screen");
  const match = text.match(/Code:\s*([A-Z0-9]{8})/i);

  if (!match) {
    throw new Error("Could not read generated room code from sender UI");
  }

  return match[1].toUpperCase();
}

async function joinRoom(page, room) {
  await page.eval(`
    (() => {
      const input = [...document.querySelectorAll("input")]
        .find((candidate) => candidate.placeholder === "ABCD1234");
      if (!input) throw new Error("Room input not found");

      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, "${room}");
      input.dispatchEvent(new Event("input", { bubbles: true }));

      const button = [...document.querySelectorAll("button")]
        .find((candidate) => /connect to room/i.test(candidate.innerText));
      if (!button) throw new Error("Connect button not found");
      button.click();
    })()
  `);

  await waitForText(page, /Transfer Room/i, 30_000, `receiver joined ${room}`);
}

async function installDownloadNamePatch(page, suffix) {
  await page.eval(`
    (() => {
      if (window.__airshareDownloadNamePatchInstalled) return;
      window.__airshareDownloadNamePatchInstalled = true;
      const suffix = ${JSON.stringify(suffix)};
      const originalClick = HTMLAnchorElement.prototype.click;

      HTMLAnchorElement.prototype.click = function patchedClick(...args) {
        if (this.download && !this.download.includes(suffix)) {
          this.download = this.download.replace(/(\\.[^./\\\\]+)?$/, "-" + suffix + "$1");
        }
        return originalClick.apply(this, args);
      };
    })()
  `);
}

async function collectRoomState(page) {
  return page.eval(`
    (() => {
      const bodyText = document.body.innerText;
      const connectedMatch = bodyText.match(/(\\d+)\\s+Connected Nodes/i);
      return {
        connectedNodes: connectedMatch ? Number(connectedMatch[1]) : null,
        dataChannelOpens: (bodyText.match(/Data Channel Open/g) || []).length,
        receivedFiles: (bodyText.match(/Received file:/g) || []).length,
        doneTransfers: (bodyText.match(/Done:/g) || []).length,
        failedTransfers: (bodyText.match(/Transfer failed:/g) || []).length,
        visibleTextTail: bodyText.slice(-2000)
      };
    })()
  `);
}

async function waitForConnectedPeers(page, expected, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await collectRoomState(page);
    if ((state.connectedNodes || 0) >= expected) return state;
    await sleep(1000);
  }

  return collectRoomState(page);
}

async function uploadFile(page, filePath) {
  const { root } = await page.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await page.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "input[type=file]",
  });

  if (!nodeId) {
    throw new Error("File input not found");
  }

  await page.send("DOM.setFileInputFiles", {
    nodeId,
    files: [filePath],
  });
}

async function listDownloadedFiles(downloadPath, owner = "page") {
  const names = await readdir(downloadPath).catch(() => []);
  const files = [];

  for (const name of names) {
    if (name.endsWith(".crdownload") || name === "downloads.htm") continue;
    const fullPath = join(downloadPath, name);
    const fileStat = await stat(fullPath).catch(() => null);
    if (fileStat?.isFile()) {
      files.push({
        owner,
        name,
        path: fullPath,
        size: fileStat.size,
      });
    }
  }

  return files;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!existsSync(args.chrome)) {
    throw new Error(`Chrome not found: ${args.chrome}`);
  }

  if (!existsSync(args.file)) {
    throw new Error(`Test file not found: ${args.file}`);
  }

  const profileDir = await mkdtemp(join(tmpdir(), "airshare-cdp-profile-"));
  const downloadRoot = await mkdtemp(join(tmpdir(), "airshare-cdp-downloads-"));
  const senderDownloadPath = join(downloadRoot, "sender");
  const chromeArgs = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-popup-blocking",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${args.port}`,
    `--user-data-dir=${profileDir}`,
    "--unsafely-treat-insecure-origin-as-secure=http://localhost,http://127.0.0.1",
    "about:blank",
  ];

  const chrome = spawn(args.chrome, chromeArgs, {
    stdio: ["ignore", "ignore", "pipe"],
    windowsHide: true,
  });
  let chromeErrors = "";
  chrome.stderr.on("data", (data) => {
    chromeErrors += data.toString();
  });
  chrome.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      console.error(`[Chrome exited] code=${code} signal=${signal || ""}`);
      if (chromeErrors.trim()) console.error(chromeErrors.trim().slice(-4000));
    }
  });

  const pages = [];
  const startedAt = Date.now();

  try {
    await waitForJson(`http://127.0.0.1:${args.port}/json/version`);
    await mkdir(senderDownloadPath, { recursive: true });

    console.log(`[${nowIso()}] Chrome CDP running on port ${args.port}`);
    console.log(`[${nowIso()}] Frontend: ${args.url}`);
    console.log(`[${nowIso()}] Downloads: ${downloadRoot}`);

    const sender = await newPage(args.port, args.url, senderDownloadPath);
    pages.push(sender);
    const room = await clickGenerateRoom(sender);
    console.log(`[${nowIso()}] Sender created room: ${room}`);

    const receivers = [];
    const receiverDownloadPaths = [];
    for (let i = 0; i < args.receivers; i += 1) {
      const receiverDownloadPath = join(downloadRoot, `receiver-${i + 1}`);
      await mkdir(receiverDownloadPath, { recursive: true });
      receiverDownloadPaths.push(receiverDownloadPath);

      const receiver = await newPage(args.port, args.url, receiverDownloadPath);
      pages.push(receiver);
      await joinRoom(receiver, room);
      await installDownloadNamePatch(receiver, `receiver-${i + 1}`);
      receivers.push(receiver);
      console.log(`[${nowIso()}] Receiver ${i + 1}/${args.receivers} joined.`);
    }

    const senderReadyState = await waitForConnectedPeers(sender, args.receivers, 180_000);
    console.log(`[${nowIso()}] Sender connected nodes: ${senderReadyState.connectedNodes}`);
    await sleep(args.settleMs);

    console.log(`[${nowIso()}] Sending file: ${args.file}`);
    await uploadFile(sender, resolve(args.file));

    const fileSize = (await stat(args.file)).size;
    const deadline = Date.now() + args.timeoutMs;
    let downloadedFiles = [];
    let liveReceiverStates = [];

    while (Date.now() < deadline) {
      downloadedFiles = (await Promise.all(
        receiverDownloadPaths.map((path, index) => listDownloadedFiles(path, `receiver-${index + 1}`))
      )).flat();
      const completeFiles = downloadedFiles.filter((file) => file.size === fileSize);
      liveReceiverStates = await Promise.all(receivers.map((receiver) => collectRoomState(receiver)));
      const completedReceivers = liveReceiverStates.filter((state) => state.receivedFiles > 0).length;

      console.log(`[${nowIso()}] Receiver completions: ${completedReceivers}/${args.receivers}; downloaded files: ${completeFiles.length}`);

      if (completedReceivers >= args.receivers) break;
      await sleep(5000);
    }

    const senderState = await collectRoomState(sender);
    const finalReceiverStates = liveReceiverStates.length === receivers.length
      ? liveReceiverStates
      : await Promise.all(receivers.map((receiver) => collectRoomState(receiver)));
    const receiverStates = finalReceiverStates.map((state, index) => ({
      receiver: index + 1,
      ...state,
    }));

    downloadedFiles = (await Promise.all(
      receiverDownloadPaths.map((path, index) => listDownloadedFiles(path, `receiver-${index + 1}`))
    )).flat();
    const completeFiles = downloadedFiles.filter((file) => file.size === fileSize);
    const completedReceiverStates = receiverStates.filter((state) => state.receivedFiles > 0);
    const result = {
      testName: "AirShare Chrome CDP Mesh Transfer Stress Test",
      startedAt: new Date(startedAt).toISOString(),
      endedAt: nowIso(),
      durationMs: Date.now() - startedAt,
      frontendUrl: args.url,
      room,
      senderFile: args.file,
      senderFileSize: fileSize,
      requestedReceivers: args.receivers,
      completedDownloads: completeFiles.length,
      completedReceivers: completedReceiverStates.length,
      success: completedReceiverStates.length >= args.receivers,
      downloadRoot,
      receiverDownloadPaths,
      downloads: downloadedFiles,
      senderState,
      receiverStates,
    };

    console.log("\n=== AirShare Chrome CDP Mesh Stress Summary ===");
    console.log(JSON.stringify(result, null, 2));

    if (args.out) {
      const outPath = resolve(args.out);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      console.log(`\nWrote JSON results: ${outPath}`);
    }

    process.exitCode = result.success ? 0 : 2;
  } finally {
    for (const page of pages) {
      page.close();
    }

    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
