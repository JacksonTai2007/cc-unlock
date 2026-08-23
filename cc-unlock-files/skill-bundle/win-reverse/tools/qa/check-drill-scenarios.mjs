import { listDrills, validateDrillManifest } from "../task/drill-lib.mjs";

const drills = listDrills();
if (drills.length === 0) {
  console.error("check-drill-scenarios: no drills found");
  process.exit(1);
}

let failed = false;
for (const drill of drills) {
  const errors = validateDrillManifest(drill);
  if (errors.length > 0) {
    failed = true;
    console.error(`[${drill.id}] invalid drill manifest`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    continue;
  }
  console.log(`[${drill.id}] topics=${drill.topics.length} successCriteria=${drill.taskPatch.successCriteria.length}`);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("check-drill-scenarios: OK");
}
