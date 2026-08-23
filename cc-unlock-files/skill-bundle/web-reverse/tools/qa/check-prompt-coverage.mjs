import { failWith, readText } from "./common.mjs";
import { readTopicRegistry } from "./topic-registry.mjs";

const prompts = readText("PROMPTS.md");
const topics = readTopicRegistry();
const topicKeys = new Set(topics.map((topic) => topic.key));
const topicHits = new Map(topics.map((topic) => [topic.key, 0]));
const findings = [];

const markerRegex = /<!--\s*topics:\s*([^>]+?)\s*-->/g;
const markers = [];
let match = null;

while ((match = markerRegex.exec(prompts)) !== null) {
  const raw = match[1];
  const keys = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    findings.push("PROMPTS.md contains an empty <!-- topics: --> marker");
    continue;
  }

  markers.push(keys);
  for (const key of keys) {
    if (!topicKeys.has(key)) {
      findings.push(`PROMPTS.md references unknown topic marker "${key}"`);
      continue;
    }
    topicHits.set(key, (topicHits.get(key) || 0) + 1);
  }
}

if (markers.length === 0) {
  findings.push("PROMPTS.md does not contain any <!-- topics: ... --> coverage markers");
}

for (const topic of topics) {
  if ((topicHits.get(topic.key) || 0) === 0) {
    findings.push(`topic "${topic.key}" has no prompt coverage marker in PROMPTS.md`);
  }
}

failWith(findings, "check-prompt-coverage");
