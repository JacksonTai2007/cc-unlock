import { mustExist, readText } from "./common.mjs";

[
  "artifacts/tasks/_TEMPLATE/task.json",
  "artifacts/tasks/_TEMPLATE/report.md",
  "artifacts/tasks/_TEMPLATE/run/fixtures.json",
  "artifacts/tasks/_TEMPLATE/run/verify-once.mjs",
  "artifacts/tasks/_TEMPLATE/run/split-delivery-notes.md",
  "artifacts/tasks/_TEMPLATE/run/framework-runtime-notes.md",
  "artifacts/tasks/_TEMPLATE/run/network-stack-notes.md",
  "artifacts/tasks/_TEMPLATE/run/art-runtime-notes.md"
].forEach(mustExist);

const taskJson = readText("artifacts/tasks/_TEMPLATE/task.json");
[
  "\"splitDelivery\"",
  "\"frameworkRuntime\"",
  "\"artRuntime\"",
  "\"javaApi\"",
  "\"jni\"",
  "\"webview\"",
  "\"storageIpc\"",
  "\"antiRoot\"",
  "\"antiEmulatorDebug\"",
  "\"integrity\"",
  "\"nativeNetwork\"",
  "\"dexLoader\"",
  "\"smaliPatch\"",
  "\"cryptoProtocol\""
].forEach((key) => {
  if (!taskJson.includes(key)) {
    throw new Error(`task.json missing section ${key}`);
  }
});

console.log("template check passed");

