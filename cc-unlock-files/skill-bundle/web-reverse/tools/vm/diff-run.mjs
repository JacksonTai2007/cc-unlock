import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { left: "", right: "", out: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--left") args.left = argv[++i] || "";
    else if (token === "--right") args.right = argv[++i] || "";
    else if (token === "--out") args.out = argv[++i] || "";
  }
  return args;
}

function parseStructuredFile(filePath) {
  const fullPath = path.resolve(filePath);
  const text = fs.readFileSync(fullPath, "utf8");
  if (fullPath.endsWith(".jsonl")) {
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          return { __line__: index + 1, raw: line };
        }
      });
  }
  return JSON.parse(text);
}

function isObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function findFirstDivergence(left, right, pathParts = []) {
  if (Object.is(left, right)) {
    return null;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    const max = Math.max(left.length, right.length);
    for (let i = 0; i < max; i += 1) {
      if (i >= left.length || i >= right.length) {
        return { path: [...pathParts, i], left: left[i], right: right[i] };
      }
      const nested = findFirstDivergence(left[i], right[i], [...pathParts, i]);
      if (nested) return nested;
    }
    return null;
  }

  if (isObject(left) && isObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!(key in left) || !(key in right)) {
        return { path: [...pathParts, key], left: left[key], right: right[key] };
      }
      const nested = findFirstDivergence(left[key], right[key], [...pathParts, key]);
      if (nested) return nested;
    }
    return null;
  }

  return { path: pathParts, left, right };
}

const args = parseArgs(process.argv);
if (!args.left || !args.right) {
  console.error("usage: node tools/vm/diff-run.mjs --left <browser.json|jsonl> --right <local.json|jsonl> [--out <report.json>]");
  process.exit(1);
}

const left = parseStructuredFile(args.left);
const right = parseStructuredFile(args.right);
const divergence = findFirstDivergence(left, right) || {
  path: [],
  left: null,
  right: null,
  equal: true
};

const report = {
  left: path.resolve(args.left),
  right: path.resolve(args.right),
  equal: Boolean(divergence.equal),
  firstDivergence: divergence.equal ? null : {
    path: divergence.path.join("."),
    left: divergence.left,
    right: divergence.right
  }
};

const output = JSON.stringify(report, null, 2);
if (args.out) {
  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output + "\n");
  console.log(`wrote: ${outPath}`);
} else {
  console.log(output);
}
