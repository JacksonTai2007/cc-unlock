/**
 * generate-eval-assertions.mjs
 *
 * 读取 eval_set.json，根据 expectedRoutes / expectedArtifacts / expectedReasoningTags
 * 自动生成 assertions 骨架。
 *
 * 用法：node tools/qa/generate-eval-assertions.mjs [--in-place] [--subset <N>]
 *   --in-place  直接覆盖原文件（默认输出到 stdout）
 *   --subset N   只处理前 N 条 eval（默认全部）
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const evalPath = resolve(__dirname, '../../eval_set.json');

const args = process.argv.slice(2);
const inPlace = args.includes('--in-place');
const subsetIdx = args.indexOf('--subset');
const subset = subsetIdx >= 0 ? parseInt(args[subsetIdx + 1], 10) : null;

const evals = JSON.parse(readFileSync(evalPath, 'utf-8'));

function generateAssertions(ev) {
  const assertions = [];

  // shouldTrigger=false → no_task_artifacts
  if (ev.shouldTrigger === false) {
    assertions.push({
      type: 'no_task_artifacts',
      description: '不应创建 task artifacts（非本 skill 场景）',
    });
    return assertions;
  }

  // expectedRoutes → route_matches
  for (const topic of ev.expectedRoutes || []) {
    if (topic !== 'task-local' && topic !== 'browser-controlled-reuse') {
      assertions.push({
        type: 'route_matches',
        topic,
        description: `应路由到 ${topic} 专题`,
      });
    }
  }

  // expectedArtifacts → artifact_exists
  for (const artifact of ev.expectedArtifacts || []) {
    assertions.push({
      type: 'artifact_exists',
      path: artifact,
      description: `${artifact} 应已生成`,
    });
  }

  // expectedReasoningTags → reasoning_tag_present
  for (const tag of ev.expectedReasoningTags || []) {
    assertions.push({
      type: 'reasoning_tag_present',
      tag,
      description: `应包含推理标签: ${tag}`,
    });
  }

  // forbiddenReasoningTags → reasoning_tag_forbidden
  for (const tag of ev.forbiddenReasoningTags || []) {
    assertions.push({
      type: 'reasoning_tag_forbidden',
      tag,
      description: `不应包含推理标签: ${tag}`,
    });
  }

  return assertions;
}

const target = subset ? evals.slice(0, subset) : evals;
let generated = 0;

for (const ev of target) {
  ev.assertions = generateAssertions(ev);
  if (ev.assertions.length > 0) generated++;
}

if (inPlace) {
  writeFileSync(evalPath, JSON.stringify(evals, null, 2) + '\n', 'utf-8');
  console.log(`已写入 ${evalPath}`);
  console.log(`共 ${target.length} 条 eval，${generated} 条生成了断言`);
} else {
  // 输出统计
  console.log(`共 ${target.length} 条 eval，${generated} 条可生成断言`);
  console.log('使用 --in-place 写入文件');
}
