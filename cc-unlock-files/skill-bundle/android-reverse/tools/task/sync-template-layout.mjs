import fs from "node:fs";
import path from "node:path";
import {
  compatibilityExtensionDir,
  coreTaskTemplateFiles,
  ensureDir,
  getTopicExtensionFile,
  getTopicExtensionSourcePath,
  getTopicPackDir,
  getTopicPackFiles,
  listRegistryTopics,
  templateTaskCoreDir,
  templateTaskDir
} from "./common.mjs";

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  fs.copyFileSync(from, to);
}

for (const relPath of coreTaskTemplateFiles) {
  const sourcePath = path.join(templateTaskDir, ...relPath.split("/"));
  if (!fs.existsSync(sourcePath)) {
    continue;
  }
  copyFile(sourcePath, path.join(templateTaskCoreDir, ...relPath.split("/")));
}
copyFile(path.join(templateTaskDir, "task.json"), path.join(templateTaskCoreDir, "core-task.json"));
ensureDir(compatibilityExtensionDir);

for (const topic of listRegistryTopics()) {
  const packDir = getTopicPackDir(topic);
  if (packDir && fs.existsSync(packDir)) {
    for (const relPath of getTopicPackFiles(topic)) {
      copyFile(path.join(packDir, ...relPath.split("/")), path.join(templateTaskDir, ...relPath.split("/")));
    }
  }

  const extensionSourcePath = getTopicExtensionSourcePath(topic);
  const compatibilityFile = getTopicExtensionFile(topic);
  if (extensionSourcePath && compatibilityFile) {
    copyFile(extensionSourcePath, path.join(compatibilityExtensionDir, compatibilityFile));
  }
}

console.log("sync-template-layout: compatibility template refreshed from root template and topic packs");

