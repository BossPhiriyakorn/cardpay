const major = Number.parseInt(process.versions.node.split(".")[0], 10);
const supportedMajors = new Set([20, 22, 24]);

if (!supportedMajors.has(major)) {
  console.error("");
  console.error("Unsupported Node.js version for this project.");
  console.error(`Current: v${process.versions.node}`);
  console.error("Required: 20.x, 22.x, or 24.x");
  console.error("");
  console.error("Fix:");
  console.error("1. Switch your terminal to Node 24 LTS");
  console.error("2. Reopen the terminal in this project");
  console.error("3. Run npm install again");
  console.error("");
  process.exit(1);
}
