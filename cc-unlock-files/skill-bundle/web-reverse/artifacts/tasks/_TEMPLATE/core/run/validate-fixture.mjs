import fs from "node:fs";

const fixture = JSON.parse(
  fs.readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")
);

console.log("[validate-fixture] fixture keys:", Object.keys(fixture));

