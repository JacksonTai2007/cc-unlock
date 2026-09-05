import { readTopicRegistryFromSource } from "./topic-manifests.mjs";

export function readTopicRegistry() {
  return readTopicRegistryFromSource();
}

export function getTopicByKey(key) {
  return readTopicRegistry().find((topic) => topic.key === key) || null;
}

export function topicHasMaturity(topic, ...levels) {
  const allowed = new Set(levels.flat().map((level) => String(level || "").trim()).filter(Boolean));
  if (allowed.size === 0) {
    return true;
  }
  return allowed.has(String(topic?.maturity || "").trim());
}

export function listTopicsByMaturity(...levels) {
  return readTopicRegistry().filter((topic) => topicHasMaturity(topic, ...levels));
}

export function getTopicPresentPaths(topic) {
  return Array.from(
    new Set(
      [topic?.taskSemantics?.presentPath, topic?.formalValidation?.presentPath]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

