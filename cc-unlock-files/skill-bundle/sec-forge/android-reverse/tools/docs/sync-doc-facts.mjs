import { syncDocFactFiles } from "./fact-sync.mjs";
import { collectDocFactSyncFindings } from "./fact-sync.mjs";

const checkOnly = process.argv.includes("--check");

if (checkOnly) {
  const findings = collectDocFactSyncFindings();
  if (findings.length > 0) {
    console.error("sync-doc-facts: FAILED");
    for (const finding of findings) {
      console.error(`- ${finding}`);
    }
    process.exitCode = 1;
  } else {
    console.log("sync-doc-facts: OK");
  }
} else {
  syncDocFactFiles();
  console.log("sync-doc-facts: refreshed manifest-backed explanatory docs");
}

