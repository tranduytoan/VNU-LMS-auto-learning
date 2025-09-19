import WebSocket from "ws";
import fs from "fs";

const RS = String.fromCharCode(0x1e);

// Logger with job prefix support
function log(message, jobId = null) {
  const timestamp = new Date().toLocaleString();
  const prefix = jobId ? `[Job-${jobId}]` : "[System]";
  console.log(`${timestamp} ${prefix} ${message}`);
}

// Job class to handle individual WebSocket connections
class JobRunner {
  constructor(jobConfig, access_token, jobIndex) {
    this.jobId = jobIndex + 1;
    this.learningId = jobConfig.learningId;
    this.access_token = access_token;
    this.autoStopSeconds = jobConfig.autoStopSeconds;
    this.enabled = jobConfig.enable;
    
    this.ws = null;
    this.lastServerHeartbeat = Date.now();
    this.heartbeatInterval = null;
    this.watchdogInterval = null;
    this.autoStopTimer = null;
    this.heartbeatStart = null;
    this.isRunning = false;
  }

  start() {
    if (!this.enabled) {
      log("Job is disabled, skipping", this.jobId);
      return;
    }

    if (!this.learningId || !this.access_token) {
      log("Missing learningId or access_token, cannot start", this.jobId);
      return;
    }

    const wsUrl = `wss://lms.vnu.edu.vn/dhqg.lms.api/socket/hubs/lrs?learningId=${this.learningId}&access_token=${this.access_token}`;
    
    const wsHeaders = {
      "accept-language": "vi-VN,vi;q=0.9,en-US;q=0.6,en;q=0.5",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-websocket-extensions": "permessage-deflate; client_max_window_bits",
      "sec-websocket-key": "randomKey123==",
      "sec-websocket-version": "13",
      "cookie": "WEBSVR=app3",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    };

    this.ws = new WebSocket(wsUrl, { headers: wsHeaders });
    this.setupWebSocketHandlers();
    this.isRunning = true;
    log(`Starting connection to LearningId: ${this.learningId}`, this.jobId);
  }

  setupWebSocketHandlers() {
    this.ws.on("open", () => {
      const handshake = JSON.stringify({ protocol: "json", version: 1 }) + RS;
      this.ws.send(handshake);
      log("Connected, sent handshake", this.jobId);
    });

    this.ws.on("message", (data) => {
      const msg = data.toString().trim();

      // Handshake success
      if (msg === "{}" || msg === "{}" + RS) {
        log("Handshake success, starting heartbeat...", this.jobId);
        this.heartbeatStart = Date.now();

        // Send heartbeat every 15s
        this.heartbeatInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 6 }) + RS);
          }
        }, 15000);

        // Watchdog: check every 5s
        this.watchdogInterval = setInterval(() => {
          if (Date.now() - this.lastServerHeartbeat > 30000) {
            log("No server heartbeat for 30s. Stopping job...", this.jobId);
            this.stop();
          }
        }, 5000);

        // Auto stop timer (if >0)
        if (this.autoStopSeconds > 0) {
          this.autoStopTimer = setTimeout(() => {
            const elapsed = (Date.now() - this.heartbeatStart) / 1000;
            const mm = Math.floor(elapsed / 60);
            const ss = Math.floor(elapsed % 60);
            log(`Auto stopped after ${mm}m ${ss}s`, this.jobId);
            this.stop();
          }, this.autoStopSeconds * 1000);
        }
      }

      // Server heartbeat
      if (msg.startsWith('{"type":6')) {
        this.lastServerHeartbeat = Date.now();
      }
    });

    this.ws.on("error", (err) => {
      log(`WebSocket error: ${err.message}`, this.jobId);
      this.stop();
    });

    this.ws.on("close", () => {
      log("Connection closed", this.jobId);
      this.stop();
    });
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    clearInterval(this.heartbeatInterval);
    clearInterval(this.watchdogInterval);
    clearTimeout(this.autoStopTimer);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    const elapsed = this.heartbeatStart ? (Date.now() - this.heartbeatStart) / 1000 : 0;
    const mm = Math.floor(elapsed / 60);
    const ss = Math.floor(elapsed % 60);
    log(`Job stopped after ${mm}m ${ss}s`, this.jobId);
  }

  getStatus() {
    return {
      jobId: this.jobId,
      learningId: this.learningId,
      enabled: this.enabled,
      isRunning: this.isRunning,
      uptime: this.heartbeatStart ? (Date.now() - this.heartbeatStart) / 1000 : 0
    };
  }
}

// Load and validate config
function loadConfig() {
  try {
    const config = JSON.parse(fs.readFileSync("config.json", "utf8"));
    return config;
  } catch (error) {
    log(`Error loading config: ${error.message}`);
    process.exit(1);
  }
}

// Validate configuration
function validateConfig(config) {
  if (!config.access_token || config.access_token.trim() === "") {
    log("Error: access_token is missing or empty");
    return false;
  }

  if (!config.list_job || !Array.isArray(config.list_job)) {
    log("Error: list_job is missing or not an array");
    return false;
  }

  const enabledJobs = config.list_job.filter(job => {
    const hasRequiredFields = job.learningId && typeof job.autoStopSeconds === 'number' && typeof job.enable === 'boolean';
    return hasRequiredFields && job.enable;
  });

  if (enabledJobs.length === 0) {
    log("Error: No enabled jobs found with complete data (learningId, autoStopSeconds, enable)");
    return false;
  }

  log(`Found ${enabledJobs.length} enabled job(s) out of ${config.list_job.length} total jobs`);
  return true;
}

// Main execution
const config = loadConfig();

if (!validateConfig(config)) {
  log("Configuration validation failed. Exiting...");
  process.exit(1);
}

const runners = [];
const enabledJobs = config.list_job.filter(job => job.enable && job.learningId && typeof job.autoStopSeconds === 'number');

log(`Starting ${enabledJobs.length} job(s)...`);

// Create and start job runners
enabledJobs.forEach((jobConfig, index) => {
  const runner = new JobRunner(jobConfig, config.access_token, index);
  runners.push(runner);
  runner.start();
});

// Handle user input and status commands
import readline from "readline";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on("line", (input) => {
  const command = input.trim().toUpperCase();
  
  switch (command) {
    case "C":
      log("Stopping all jobs by user request...");
      cleanupAndExit();
      break;
    
    case "S":
    case "STATUS":
      showStatus();
      break;
    
    case "H":
    case "HELP":
      showHelp();
      break;
    
    default:
      if (input.trim() !== "") {
        log(`Unknown command: ${input}. Type 'H' for help.`);
      }
  }
});

function showStatus() {
  log("=== Job Status ===");
  runners.forEach(runner => {
    const status = runner.getStatus();
    const mm = Math.floor(status.uptime / 60);
    const ss = Math.floor(status.uptime % 60);
    const statusText = status.isRunning ? `Running (${mm}m ${ss}s)` : "Stopped";
    log(`Job ${status.jobId} (${status.learningId}): ${statusText}`, null);
  });
  log("================");
}

function showHelp() {
  log("=== Available Commands ===");
  log("C - Stop all jobs and exit");
  log("S or STATUS - Show status of all jobs");
  log("H or HELP - Show this help message");
  log("========================");
}

function cleanupAndExit() {
  log("Shutting down all jobs...");
  runners.forEach(runner => runner.stop());
  
  setTimeout(() => {
    log("All jobs stopped. Exiting...");
    process.exit(0);
  }, 1000);
}

// Handle process signals
process.on('SIGINT', () => {
  log("Received SIGINT signal");
  cleanupAndExit();
});

process.on('SIGTERM', () => {
  log("Received SIGTERM signal");
  cleanupAndExit();
});

// Show initial help
log(`Auto LMS started with ${runners.length} job(s)`);
showHelp();
