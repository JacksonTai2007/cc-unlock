import { writeGeneratedTopicDocs } from "../topic-manifests.mjs";
import { syncDocFactFiles } from "../docs/fact-sync.mjs";

writeGeneratedTopicDocs();
syncDocFactFiles();
console.log("generate-topic-docs: regenerated topic-route-matrix.json, capability-matrix.md, and manifest-backed explanatory docs");
