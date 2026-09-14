/**
 * Tallies what a set of PSDs actually contains, so the gaps in the fixture matrix can be seen.
 *
 * ADR-0008 puts this first: nothing else can be scoped until it is known whether the files on
 * hand already cover the cases the spec lists. It parses and counts, nothing more — no rendering,
 * no reference renderer, no comparison.
 *
 * **The output carries no artwork and no layer names.** Counts, distributions, and depths only,
 * so a report from a client file can be shared.
 *
 * `skipLayerImageData` is what makes this usable on real files. Without it a 170MB PSD decodes
 * every layer into memory; with it only the structure is read.
 *
 *   node scripts/inventory.mjs <file-or-directory>...
 *   node scripts/inventory.mjs ~/psd --json > inventory.json
 */
import {readFileSync, readdirSync, statSync} from "node:fs";
import {join, extname} from "node:path";
import {createHash} from "node:crypto";
import {initializeCanvas, readPsd} from "ag-psd";

// ag-psd wants a canvas even when no pixels are read. Nothing draws, so a stub is enough
initializeCanvas(
  (width, height) => ({
    width,
    height,
    getContext: () => ({
      createImageData: (w, h) => ({
        data: new Uint8ClampedArray(w * h * 4),
        width: w,
        height: h,
      }),
    }),
  }),
  (width, height) => ({
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }),
);

/** The 10 with no corresponding operation in Canvas 2D. Mirrors ADR-0002 */
const UNSUPPORTED_BLEND_MODES = new Set([
  "dissolve",
  "linear burn",
  "darker color",
  "lighter color",
  "vivid light",
  "linear light",
  "pin light",
  "hard mix",
  "subtract",
  "divide",
]);

function collectPaths(inputs) {
  const found = [];
  for (const input of inputs) {
    const stats = statSync(input);
    if (!stats.isDirectory()) {
      found.push(input);
      continue;
    }
    for (const entry of readdirSync(input)) {
      const path = join(input, entry);
      const ext = extname(entry).toLowerCase();
      if ((ext === ".psd" || ext === ".psb") && statSync(path).isFile()) {
        found.push(path);
      }
    }
  }
  return found;
}

function inspect(path) {
  const bytes = readFileSync(path);
  const psd = readPsd(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    {skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true},
  );

  const tally = {
    layers: 0,
    groups: 0,
    maxDepth: 0,
    hidden: 0,
    clipping: 0,
    withMask: 0,
    maskSmallerThanLayer: 0,
    maskDefaultColorWhite: 0,
    vectorMask: 0,
    adjustment: 0,
    effects: 0,
    passThroughGroups: 0,
    isolatedGroups: 0,
    groupsBelowFullOpacity: 0,
    layersBelowFullOpacity: 0,
    blendModes: {},
    unsupportedBlendModes: {},
    clippedElementsUngrouped: 0,
  };

  const walk = (nodes, depth) => {
    for (const layer of nodes ?? []) {
      const isGroup = layer.children !== undefined;
      tally.maxDepth = Math.max(tally.maxDepth, depth);
      if (isGroup) tally.groups++;
      else tally.layers++;

      const blendMode = layer.blendMode ?? (isGroup ? "pass through" : "normal");
      tally.blendModes[blendMode] = (tally.blendModes[blendMode] ?? 0) + 1;
      if (UNSUPPORTED_BLEND_MODES.has(blendMode)) {
        tally.unsupportedBlendModes[blendMode] =
          (tally.unsupportedBlendModes[blendMode] ?? 0) + 1;
      }

      const opacity = layer.opacity ?? 1;
      if (isGroup) {
        if (blendMode === "pass through") tally.passThroughGroups++;
        else tally.isolatedGroups++;
        if (opacity < 1) tally.groupsBelowFullOpacity++;
      } else if (opacity < 1) {
        tally.layersBelowFullOpacity++;
      }

      if (layer.hidden === true) tally.hidden++;
      if (layer.clipping === true) tally.clipping++;
      if (layer.vectorMask !== undefined) tally.vectorMask++;
      if (layer.adjustment !== undefined) tally.adjustment++;
      if (layer.effects !== undefined) tally.effects++;
      if (layer.blendClippendElements === false) tally.clippedElementsUngrouped++;

      const mask = layer.mask;
      if (mask !== undefined && mask.disabled !== true) {
        tally.withMask++;
        if (mask.defaultColor === 255) tally.maskDefaultColorWhite++;
        const layerWidth = (layer.right ?? 0) - (layer.left ?? 0);
        const layerHeight = (layer.bottom ?? 0) - (layer.top ?? 0);
        const maskWidth = (mask.right ?? 0) - (mask.left ?? 0);
        const maskHeight = (mask.bottom ?? 0) - (mask.top ?? 0);
        if (maskWidth < layerWidth || maskHeight < layerHeight) {
          tally.maskSmallerThanLayer++;
        }
      }

      if (isGroup) walk(layer.children, depth + 1);
    }
  };
  walk(psd.children, 1);

  return {
    // The file is identified by a hash, so a report names no client file
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
    sizeBytes: bytes.byteLength,
    width: psd.width,
    height: psd.height,
    bitsPerChannel: psd.bitsPerChannel,
    nodes: tally.layers + tally.groups,
    ...tally,
  };
}

/**
 * The cases the v1 spec lists for its side-by-side comparison. A case with no file behind it is
 * what has to be generated.
 */
function coverage(files) {
  const any = (predicate) => files.filter(predicate).map((f) => f.id);
  return {
    "nested isolated groups": any((f) => f.isolatedGroups > 0 && f.maxDepth > 1),
    "pass-through group": any((f) => f.passThroughGroups > 0),
    "group below full opacity": any((f) => f.groupsBelowFullOpacity > 0),
    "hidden layers": any((f) => f.hidden > 0),
    "adjustment layer": any((f) => f.adjustment > 0),
    "layer effects": any((f) => f.effects > 0),
    "multiply or screen": any(
      (f) => (f.blendModes.multiply ?? 0) + (f.blendModes.screen ?? 0) > 0,
    ),
    "linear dodge": any((f) => (f.blendModes["linear dodge"] ?? 0) > 0),
    "unsupported blend mode": any(
      (f) => Object.keys(f.unsupportedBlendModes).length > 0,
    ),
    "mask smaller than its layer": any((f) => f.maskSmallerThanLayer > 0),
    "mask with white default color": any((f) => f.maskDefaultColorWhite > 0),
    "clipping mask": any((f) => f.clipping > 0),
    "clipped elements ungrouped": any((f) => f.clippedElementsUngrouped > 0),
    "vector mask": any((f) => f.vectorMask > 0),
    "more than 8 bits per channel": any((f) => (f.bitsPerChannel ?? 8) > 8),
  };
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const inputs = args.filter((a) => !a.startsWith("--"));

if (inputs.length === 0) {
  console.error("usage: node scripts/inventory.mjs <file-or-directory>... [--json]");
  process.exit(1);
}

const paths = collectPaths(inputs);
if (paths.length === 0) {
  console.error("no .psd or .psb files found");
  process.exit(1);
}

const files = [];
const failures = [];
for (const path of paths) {
  try {
    files.push(inspect(path));
  } catch (error) {
    // The filename is kept out of the report; only that one file failed matters
    failures.push(error instanceof Error ? error.message : String(error));
  }
}

const report = {
  generated: new Date().toISOString(),
  filesRead: files.length,
  filesFailed: failures.length,
  failures,
  files,
  coverage: coverage(files),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`read ${files.length} file(s), ${failures.length} failed\n`);
  for (const f of files) {
    console.log(
      `${f.id}  ${f.width}x${f.height} ${f.bitsPerChannel}bit  ` +
        `${f.nodes} nodes (${f.groups} groups, depth ${f.maxDepth})  ` +
        `${(f.sizeBytes / 1024 / 1024).toFixed(1)}MB`,
    );
  }
  console.log("\ncoverage — a case with no file behind it has to be generated:");
  for (const [name, ids] of Object.entries(report.coverage)) {
    const mark = ids.length > 0 ? "yes" : "NO ";
    console.log(`  ${mark}  ${name}${ids.length > 0 ? `  (${ids.length})` : ""}`);
  }
  for (const message of failures) console.log(`\nfailed: ${message}`);
}
