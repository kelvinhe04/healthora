const { spawn } = require("child_process");
const path = require("path");

const cwd = process.cwd();

const commands = [
  { cmd: "bun", args: ["run", "dev"], cwd: path.join(cwd, "backend"), color: "\x1b[36m", name: "backend" },
  { cmd: "bun", args: ["run", "dev"], cwd: path.join(cwd, "frontend"), color: "\x1b[32m", name: "frontend" },
  { cmd: "stripe", args: ["listen", "--forward-to", "localhost:3002/webhooks/stripe"], cwd, color: "\x1b[33m", name: "stripe" },
];

const children = commands.map(({ cmd, args, cwd: cmdCwd, color, name }) => {
  const child = spawn(cmd, args, { cwd: cmdCwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });

  const prefix = `${color}[${name}]\x1b[0m`;

  child.stdout.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(Boolean)) {
      console.log(`${prefix} ${line}`);
    }
  });

  child.stderr.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(Boolean)) {
      console.error(`${prefix} ${line}`);
    }
  });

  child.on("close", (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });

  return child;
});

process.on("SIGINT", () => {
  children.forEach((c) => c.kill());
  process.exit(0);
});
