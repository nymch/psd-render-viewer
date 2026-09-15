/**
 * Compares the app's composite against a baseline and attributes the difference to layers.
 *
 * ADR-0008 decides the shape: one script, several modes. Everything after reading the pixels is
 * shared; only where the baseline comes from differs.
 *
 *   regression — a previous run of this script, stored as tile summaries rather than as an
 *                image. Threshold is zero, so any changed tile is a real change
 *   reference  — a lossless export from another renderer. Per-pixel, threshold to be calibrated
 *   lossy      — an image the author distributed as the correct result, usually a JPEG. Compared
 *                by tile mean, against a JPEG noise floor measured from our own render each run
 *
 * **The diff runs inside the browser and only statistics come back.** A 4200x3600 composite is
 * 60MB of RGBA; serialising that to Node per run would dominate the cost, and the report needs
 * none of it.
 *
 * **Nothing this writes can be restored as an image.** A baseline holds a hash and four mean
 * channel values per 64x64 tile; reports hold statistics, and layers are identified by the index
 * `buildLayerTree` assigns rather than by name or rectangle.
 *
 *   node scripts/compare.mjs <psd> --save-baseline out.json
 *   node scripts/compare.mjs <psd> --baseline out.json
 *   node scripts/compare.mjs <psd> --expected export.png --threshold 2
 *   node scripts/compare.mjs <psd> --expected-lossy author.jpg --allow-scale
 *
 * Needs `npm run dev` running. Playwright's chromium must be installed once:
 *   npx playwright install chromium
 */
import {readFileSync, writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {resolve, sep} from "node:path";
import {createHash} from "node:crypto";
import {chromium} from "playwright";
import {initializeCanvas, readPsd} from "ag-psd";

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

/** Mirrors ADR-0002. Checked against the app at run time — see `unsupportedCount` below */
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

/**
 * The layer metadata the attribution needs, in the order `buildLayerTree` assigns ids.
 *
 * Derived here rather than imported, because `lib/` is TypeScript behind a path alias. The
 * duplication is guarded: the count of unsupported nodes is compared against what the app's own
 * panel displays, so a rule drifting apart from `tree.ts` surfaces on the next run.
 */
function readLayers(path) {
  const bytes = readFileSync(path);
  const psd = readPsd(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    {skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true},
  );

  const layers = [];
  const walk = (nodes, depth) => {
    for (const layer of nodes ?? []) {
      const isGroup = layer.children !== undefined;
      const blendMode = layer.blendMode ?? (isGroup ? "pass through" : "normal");
      const unsupported = [];
      if (UNSUPPORTED_BLEND_MODES.has(blendMode)) unsupported.push("blend-mode");
      if (layer.adjustment !== undefined) unsupported.push("adjustment-layer");
      if (layer.effects !== undefined) unsupported.push("layer-effects");
      if (layer.vectorMask !== undefined) unsupported.push("vector-mask");
      if (layer.blendClippendElements === false) {
        unsupported.push("clipped-elements-ungrouped");
      }

      const left = layer.left ?? 0;
      const top = layer.top ?? 0;
      const right = layer.right ?? left;
      const bottom = layer.bottom ?? top;

      layers.push({
        index: layers.length,
        depth,
        kind: isGroup ? "group" : "layer",
        blendMode,
        opacity: layer.opacity ?? 1,
        clipping: layer.clipping === true,
        visible: layer.hidden !== true,
        hasMask: layer.mask !== undefined && layer.mask.disabled !== true,
        unsupported,
        // Geometry is an input to the attribution and is dropped before the report is written
        bounds: {left, top, right, bottom},
      });

      if (isGroup) walk(layer.children, depth + 1);
    }
  };
  walk(psd.children, 1);

  return {
    id: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
    width: psd.width,
    height: psd.height,
    bitsPerChannel: psd.bitsPerChannel,
    layers,
  };
}

/** Tiles are what a baseline is made of. See `summarise` in the page function below */
const TILE = 64;

/**
 * Opens the PSD in the app, then diffs and attributes without taking the pixels out.
 *
 * `baseline` is `{kind: "tiles", tiles}` for a regression run, `{kind: "png", dataUrl}` for a
 * reference run, or null to capture a new baseline.
 */
async function runInPage(page, psdPath, layers, threshold, baseline) {
  // The server answering is not the same as the app being ready. Selecting a file before React
  // hydrates drops it silently, which is what happens when this is run straight after `npm run
  // dev`, so the first attempt is given a short leash and retried once
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.locator('input[type="file"]').setInputFiles(psdPath);
  try {
    await page.waitForSelector("canvas:not([hidden])", {timeout: 30000});
  } catch {
    await page.locator('input[type="file"]').setInputFiles(psdPath);
    await page.waitForSelector("canvas:not([hidden])", {timeout: 600000});
  }

  return page.evaluate(
    async ({layers, threshold, baseline, TILE}) => {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d", {willReadFrequently: true});
      const width = canvas.width;
      const height = canvas.height;

      // What the panel says is unsupported, to catch this script's rules drifting from tree.ts
      const badge = document.querySelector("aside .text-amber-600");
      const shownUnsupported = badge
        ? Number(badge.textContent.replace(/\D/g, ""))
        : 0;

      /**
       * Reduces the composite to one hash and one mean colour per tile.
       *
       * **A baseline must not be restorable as an image.** A 64x64 tile is 4096 pixels reduced
       * to four averages and a hash, so the picture cannot be recovered from it — the reduction
       * is what makes a baseline safe to keep, and the tile size is a privacy parameter before
       * it is a performance one. A per-pixel hash would be trivially invertible.
       *
       * The hash answers "did this tile change at all", which is what a threshold of zero needs.
       * The means answer "by how much", which matters if the zero ever stops holding — it was
       * measured on a 200x150 canvas and real documents are far larger.
       */
      const summarise = (data) => {
        const across = Math.ceil(width / TILE);
        const down = Math.ceil(height / TILE);
        const tiles = [];
        for (let ty = 0; ty < down; ty++) {
          for (let tx = 0; tx < across; tx++) {
            const x0 = tx * TILE;
            const y0 = ty * TILE;
            const x1 = Math.min(width, x0 + TILE);
            const y1 = Math.min(height, y0 + TILE);
            // Two FNV-1a passes with different offsets, so a collision needs both to agree
            let h1 = 0x811c9dc5;
            let h2 = 0x01000193;
            let r = 0;
            let g = 0;
            let b = 0;
            let a = 0;
            let n = 0;
            for (let y = y0; y < y1; y++) {
              for (let x = x0; x < x1; x++) {
                const p = (y * width + x) * 4;
                for (let ch = 0; ch < 4; ch++) {
                  const v = data[p + ch];
                  h1 = Math.imul(h1 ^ v, 0x01000193) >>> 0;
                  h2 = Math.imul(h2 ^ (v + ch), 0x85ebca6b) >>> 0;
                }
                r += data[p];
                g += data[p + 1];
                b += data[p + 2];
                a += data[p + 3];
                n++;
              }
            }
            tiles.push({
              x: x0,
              y: y0,
              h: `${h1.toString(16)}${h2.toString(16)}`,
              m: [r / n, g / n, b / n, a / n].map((v) => +v.toFixed(3)),
            });
          }
        }
        return tiles;
      };

      if (baseline === null) {
        return {
          width,
          height,
          shownUnsupported,
          tiles: summarise(ctx.getImageData(0, 0, width, height).data),
        };
      }

      if (baseline.kind === "tiles") {
        const now = summarise(ctx.getImageData(0, 0, width, height).data);
        const before = new Map(baseline.tiles.map((t) => [`${t.x},${t.y}`, t]));
        if (before.size !== now.length) {
          return {
            width,
            height,
            shownUnsupported,
            sizeMismatch: {expected: {tiles: before.size}, got: {tiles: now.length}},
          };
        }

        const changed = [];
        let worstMeanDelta = 0;
        for (const tile of now) {
          const was = before.get(`${tile.x},${tile.y}`);
          if (was === undefined || was.h === tile.h) continue;
          const delta = Math.max(...tile.m.map((v, i) => Math.abs(v - was.m[i])));
          worstMeanDelta = Math.max(worstMeanDelta, delta);
          changed.push({x: tile.x, y: tile.y, meanDelta: +delta.toFixed(3)});
        }

        // Attribution is by tile here, which is coarser than the reference mode's per-pixel map
        const overlaps = (bounds, tile) =>
          tile.x < bounds.right &&
          tile.x + TILE > bounds.left &&
          tile.y < bounds.bottom &&
          tile.y + TILE > bounds.top;

        const perLayer = layers.map((layer) => {
          const hit = changed.filter((t) => overlaps(layer.bounds, t));
          // The denominator is how many tiles the bounds actually touch. A layer rarely lands on
          // the grid, so dividing its size by the tile size undercounts and the share overshoots
          const {left, top, right, bottom} = layer.bounds;
          const l = Math.max(0, Math.min(width - 1, left));
          const t = Math.max(0, Math.min(height - 1, top));
          const r = Math.max(l + 1, Math.min(width, right));
          const b = Math.max(t + 1, Math.min(height, bottom));
          const tilesInLayer =
            (Math.floor((r - 1) / TILE) - Math.floor(l / TILE) + 1) *
            (Math.floor((b - 1) / TILE) - Math.floor(t / TILE) + 1);
          return {
            index: layer.index,
            depth: layer.depth,
            kind: layer.kind,
            blendMode: layer.blendMode,
            opacity: layer.opacity,
            clipping: layer.clipping,
            visible: layer.visible,
            hasMask: layer.hasMask,
            unsupported: layer.unsupported,
            shareOfRegion: +((hit.length / tilesInLayer) * 100).toFixed(2),
            shareOfAllDifference:
              changed.length === 0
                ? 0
                : +((hit.length / changed.length) * 100).toFixed(2),
          };
        });

        return {
          width,
          height,
          shownUnsupported,
          granularity: `tile-${TILE}`,
          tiles: now.length,
          changedTiles: changed.length,
          percentTilesChanged: +((changed.length / now.length) * 100).toFixed(4),
          worstTileMeanDelta: +worstMeanDelta.toFixed(3),
          perLayer,
        };
      }

      const decode = (src) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("an image did not decode"));
          image.src = src;
        });

      if (baseline.kind === "lossy") {
        const author = await decode(baseline.dataUrl);
        const scaled = author.width !== width || author.height !== height;
        if (scaled && !baseline.allowScale) {
          return {
            width,
            height,
            shownUnsupported,
            sizeMismatch: {expected: {width: author.width, height: author.height}},
          };
        }
        // Compare in the reference's own dimensions. Anything the scaling costs is absorbed by
        // the floor below, which is measured on the same scaled surface
        const w = author.width;
        const h = author.height;

        /**
         * A JPEG has no alpha, so the author's image is already flat against something. Ours is
         * not: the app composites onto a bare canvas. Without matching that background, every
         * transparent pixel reads as a difference.
         */
        const flat = document.createElement("canvas");
        flat.width = w;
        flat.height = h;
        const flatCtx = flat.getContext("2d", {willReadFrequently: true});
        flatCtx.fillStyle = baseline.background;
        flatCtx.fillRect(0, 0, w, h);
        flatCtx.drawImage(canvas, 0, 0, w, h);

        const tilesOf = (data, tw, th) => {
          const across = Math.ceil(tw / TILE);
          const down = Math.ceil(th / TILE);
          const out = [];
          for (let ty = 0; ty < down; ty++) {
            for (let tx = 0; tx < across; tx++) {
              const x0 = tx * TILE;
              const y0 = ty * TILE;
              const x1 = Math.min(tw, x0 + TILE);
              const y1 = Math.min(th, y0 + TILE);
              let r = 0, g = 0, b = 0, n = 0;
              for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                  const p = (y * tw + x) * 4;
                  r += data[p];
                  g += data[p + 1];
                  b += data[p + 2];
                  n++;
                }
              }
              out.push({x: x0, y: y0, m: [r / n, g / n, b / n]});
            }
          }
          return out;
        };
        const worst = (a, b) => Math.max(...a.m.map((v, i) => Math.abs(v - b.m[i])));

        const ours = tilesOf(flatCtx.getImageData(0, 0, w, h).data, w, h);

        const ref = document.createElement("canvas");
        ref.width = w;
        ref.height = h;
        const refCtx = ref.getContext("2d", {willReadFrequently: true});
        refCtx.drawImage(author, 0, 0);
        const theirs = tilesOf(refCtx.getImageData(0, 0, w, h).data, w, h);

        /**
         * The floor, measured rather than guessed.
         *
         * Our own flattened render is pushed through JPEG at the same quality and read back.
         * Whatever that round trip costs is what JPEG alone does to this picture, per tile, so a
         * difference against the author's image only counts once it clears its own tile's floor.
         * Detailed tiles get a high floor and flat ones a low one, which a fixed threshold
         * cannot do.
         */
        const roundTripped = await decode(flat.toDataURL("image/jpeg", baseline.quality));
        const rt = document.createElement("canvas");
        rt.width = w;
        rt.height = h;
        const rtCtx = rt.getContext("2d", {willReadFrequently: true});
        rtCtx.drawImage(roundTripped, 0, 0);
        const floorTiles = tilesOf(rtCtx.getImageData(0, 0, w, h).data, w, h);

        const changed = [];
        let worstDelta = 0;
        let worstFloor = 0;
        const floors = [];
        for (let i = 0; i < ours.length; i++) {
          const delta = worst(ours[i], theirs[i]);
          const floor = worst(ours[i], floorTiles[i]);
          floors.push(floor);
          worstDelta = Math.max(worstDelta, delta);
          worstFloor = Math.max(worstFloor, floor);
          if (delta > Math.max(floor * baseline.margin, 0.5)) {
            changed.push({
              x: ours[i].x,
              y: ours[i].y,
              delta: +delta.toFixed(3),
              floor: +floor.toFixed(3),
            });
          }
        }
        floors.sort((a, b) => a - b);

        // Layer rectangles are in document coordinates; the comparison may be in the
        // reference's, so they are scaled to match before anything is attributed
        const sx = w / width;
        const sy = h / height;
        const overlaps = (bounds, tile) =>
          tile.x < bounds.right * sx &&
          tile.x + TILE > bounds.left * sx &&
          tile.y < bounds.bottom * sy &&
          tile.y + TILE > bounds.top * sy;

        const perLayer = layers.map((layer) => {
          const hit = changed.filter((t) => overlaps(layer.bounds, t));
          const l = Math.max(0, Math.min(w - 1, layer.bounds.left * sx));
          const t = Math.max(0, Math.min(h - 1, layer.bounds.top * sy));
          const r = Math.max(l + 1, Math.min(w, layer.bounds.right * sx));
          const b = Math.max(t + 1, Math.min(h, layer.bounds.bottom * sy));
          const tilesInLayer =
            (Math.floor((r - 1) / TILE) - Math.floor(l / TILE) + 1) *
            (Math.floor((b - 1) / TILE) - Math.floor(t / TILE) + 1);
          return {
            index: layer.index,
            depth: layer.depth,
            kind: layer.kind,
            blendMode: layer.blendMode,
            opacity: layer.opacity,
            clipping: layer.clipping,
            visible: layer.visible,
            hasMask: layer.hasMask,
            unsupported: layer.unsupported,
            shareOfRegion: +((hit.length / tilesInLayer) * 100).toFixed(2),
            shareOfAllDifference:
              changed.length === 0
                ? 0
                : +((hit.length / changed.length) * 100).toFixed(2),
          };
        });

        return {
          width,
          height,
          shownUnsupported,
          granularity: `tile-${TILE}`,
          comparedAt: {width: w, height: h, scaled},
          background: baseline.background,
          jpegQuality: baseline.quality,
          margin: baseline.margin,
          tiles: ours.length,
          tilesExceedingFloor: changed.length,
          percentExceedingFloor: +((changed.length / ours.length) * 100).toFixed(4),
          worstTileDelta: +worstDelta.toFixed(3),
          worstTileFloor: +worstFloor.toFixed(3),
          medianTileFloor: +floors[Math.floor(floors.length / 2)].toFixed(3),
          perLayer,
        };
      }

      const expected = await decode(baseline.dataUrl);
      if (expected.width !== width || expected.height !== height) {
        return {
          width,
          height,
          shownUnsupported,
          sizeMismatch: {
            expected: {width: expected.width, height: expected.height},
          },
        };
      }

      const scratch = document.createElement("canvas");
      scratch.width = width;
      scratch.height = height;
      const scratchCtx = scratch.getContext("2d", {willReadFrequently: true});
      scratchCtx.drawImage(expected, 0, 0);

      const a = ctx.getImageData(0, 0, width, height).data;
      const b = scratchCtx.getImageData(0, 0, width, height).data;

      const differing = new Uint8Array(width * height);
      let total = 0;
      let maxDelta = 0;
      let sumDelta = 0;
      for (let p = 0; p < width * height; p++) {
        let worst = 0;
        for (let ch = 0; ch < 4; ch++) {
          const delta = Math.abs(a[p * 4 + ch] - b[p * 4 + ch]);
          if (delta > worst) worst = delta;
        }
        maxDelta = Math.max(maxDelta, worst);
        sumDelta += worst;
        if (worst > threshold) {
          differing[p] = 1;
          total++;
        }
      }

      const attributed = new Uint8Array(width * height);
      const perLayer = layers.map((layer) => {
        const {left, top, right, bottom} = layer.bounds;
        let area = 0;
        let diff = 0;
        for (let y = Math.max(0, top); y < Math.min(height, bottom); y++) {
          for (let x = Math.max(0, left); x < Math.min(width, right); x++) {
            area++;
            const p = y * width + x;
            if (differing[p]) {
              diff++;
              attributed[p] = 1;
            }
          }
        }
        return {
          index: layer.index,
          depth: layer.depth,
          kind: layer.kind,
          blendMode: layer.blendMode,
          opacity: layer.opacity,
          clipping: layer.clipping,
          visible: layer.visible,
          hasMask: layer.hasMask,
          unsupported: layer.unsupported,
          // Ratios only. The rectangle stays out of the report
          shareOfRegion: area === 0 ? 0 : +((diff / area) * 100).toFixed(2),
          shareOfAllDifference: total === 0 ? 0 : +((diff / total) * 100).toFixed(2),
        };
      });

      let outsideEveryLayer = 0;
      let insideUnsupported = 0;
      const unsupportedMask = new Uint8Array(width * height);
      for (const layer of layers) {
        if (layer.unsupported.length === 0) continue;
        const {left, top, right, bottom} = layer.bounds;
        for (let y = Math.max(0, top); y < Math.min(height, bottom); y++) {
          for (let x = Math.max(0, left); x < Math.min(width, right); x++) {
            unsupportedMask[y * width + x] = 1;
          }
        }
      }
      for (let p = 0; p < width * height; p++) {
        if (!differing[p]) continue;
        if (!attributed[p]) outsideEveryLayer++;
        if (unsupportedMask[p]) insideUnsupported++;
      }

      return {
        width,
        height,
        shownUnsupported,
        pixels: width * height,
        differingPixels: total,
        percentDiffering: +((total / (width * height)) * 100).toFixed(4),
        maxChannelDelta: maxDelta,
        meanChannelDelta: +(sumDelta / (width * height)).toFixed(4),
        explainedByUnsupported: insideUnsupported,
        unexplained: total - insideUnsupported,
        outsideEveryLayer,
        perLayer,
      };
    },
    {layers, threshold, baseline, TILE},
  );
}

const args = process.argv.slice(2);
const psdPath = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? null : args[at + 1];
};

if (psdPath === undefined) {
  console.error(
    "usage: node scripts/compare.mjs <psd> [--expected png | --expected-lossy jpg | --baseline json | --save-baseline json]\n" +
      "       [--threshold N] [--background #ffffff] [--jpeg-quality 0.9] [--margin 2] [--allow-scale]\n" +
      "       [--url http://localhost:3000] [--out report.json]",
  );
  process.exit(1);
}

const threshold = Number(flag("threshold") ?? 0);
const url = flag("url") ?? "http://localhost:3000";
const expectedPath = flag("expected");
const lossyPath = flag("expected-lossy");
const background = flag("background") ?? "#ffffff";
const jpegQuality = Number(flag("jpeg-quality") ?? 0.9);
const margin = Number(flag("margin") ?? 2);
const allowScale = args.includes("--allow-scale");
const baselinePath = flag("baseline");
const saveBaselinePath = flag("save-baseline");
const outPath = flag("out");

// Checked before anything expensive runs, so a bad path fails in a second rather than after a
// full render
if (saveBaselinePath !== null) refuseIfCommittable(saveBaselinePath);

const document_ = readLayers(psdPath);

let baseline = null;
let mode = "capture";
if (lossyPath !== null) {
  mode = "lossy";
  baseline = {
    kind: "lossy",
    dataUrl: `data:image/jpeg;base64,${readFileSync(lossyPath).toString("base64")}`,
    background,
    quality: jpegQuality,
    margin,
    allowScale,
  };
} else if (expectedPath !== null) {
  mode = "reference";
  baseline = {
    kind: "png",
    dataUrl: `data:image/png;base64,${readFileSync(expectedPath).toString("base64")}`,
  };
} else if (baselinePath !== null) {
  mode = "regression";
  const stored = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (stored.tiles === undefined) {
    console.error(
      `${baselinePath} is not a tile baseline. Baselines written before this change stored the composited image itself; delete it and capture a new one with --save-baseline`,
    );
    process.exit(1);
  }
  baseline = {kind: "tiles", tiles: stored.tiles};
}

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  await page.goto(url, {timeout: 60000});
} catch {
  console.error(`could not reach ${url}. Is \`npm run dev\` running?`);
  await browser.close();
  process.exit(1);
}

const result = await runInPage(
  page,
  psdPath,
  document_.layers,
  threshold,
  baseline,
);
await browser.close();

/**
 * A baseline embeds the composited image, so it is the artwork.
 *
 * Reports are built to be shareable; a baseline is the opposite and only exists to be diffed
 * against locally. Refusing to write one where git would pick it up is worth more than a line in
 * the README, because the mistake is silent and the file looks like every other JSON here.
 */
function refuseIfCommittable(path) {
  const full = resolve(path);

  let root;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return; // Not run from inside a repository, so nothing can be committed by accident
  }

  // Outside the work tree there is nothing for git to pick up
  if (full !== root && !full.startsWith(root + sep)) return;

  try {
    execFileSync("git", ["check-ignore", "-q", full], {stdio: "ignore"});
    return; // Ignored, so it cannot be committed
  } catch {
    // Not ignored
  }

  console.error(
    `refusing to write a baseline to ${path}: it is inside the repository and not ignored, ` +
      `and a baseline contains the composited image itself.\n` +
      `Write it under verification/, or anywhere outside the repository.`,
  );
  process.exit(1);
}

if (mode === "capture") {
  if (saveBaselinePath === null) {
    console.error(
      "nothing to compare against. Pass --save-baseline to store this render, or --baseline / --expected to compare",
    );
    process.exit(1);
  }
  writeFileSync(
    saveBaselinePath,
    JSON.stringify(
      {
        document: document_.id,
        width: result.width,
        height: result.height,
        capturedAt: new Date().toISOString(),
        tileSize: TILE,
        tiles: result.tiles,
      },
      null,
      2,
    ),
  );
  console.log(
    `baseline saved: ${saveBaselinePath} (${result.width}x${result.height})`,
  );
  process.exit(0);
}

const expectedUnsupported = document_.layers.filter(
  (l) => l.unsupported.length > 0,
).length;

const report = {
  generated: new Date().toISOString(),
  mode,
  threshold,
  document: {
    id: document_.id,
    width: document_.width,
    height: document_.height,
    bitsPerChannel: document_.bitsPerChannel,
    nodes: document_.layers.length,
  },
  // A mismatch means this script's rules have drifted from lib/psd/tree.ts
  unsupportedCount: {
    computedHere: expectedUnsupported,
    shownByTheApp: result.shownUnsupported,
    agree: expectedUnsupported === result.shownUnsupported,
  },
  consoleErrors,
  ...result,
};
delete report.shownUnsupported;

const json = JSON.stringify(report, null, 2);
if (outPath !== null) {
  writeFileSync(outPath, json);
  console.log(`report written: ${outPath}`);
} else {
  console.log(json);
}

if (report.sizeMismatch !== undefined) {
  console.error(
    `\nthe reference is ${report.sizeMismatch.expected.width}x${report.sizeMismatch.expected.height} but the composite is ${result.width}x${result.height}. Export at 100%, or pass --allow-scale to compare in the reference\u2019s dimensions`,
  );
  process.exit(1);
}

if (!report.unsupportedCount.agree) {
  console.error(
    `\nthis script counted ${expectedUnsupported} unsupported nodes but the app shows ${result.shownUnsupported}. The rules here have drifted from lib/psd/tree.ts`,
  );
}

// The two modes measure different things, so they cannot share one summary
if (mode === "lossy") {
  console.error(
    `\n${report.tilesExceedingFloor} of ${report.tiles} tiles differ beyond what JPEG alone explains ` +
      `(${report.percentExceedingFloor}%).\n` +
      `worst tile delta ${report.worstTileDelta}, against a median JPEG floor of ${report.medianTileFloor} ` +
      `(worst floor ${report.worstTileFloor}) at quality ${report.jpegQuality}.`,
  );
} else if (mode === "regression") {
  console.error(
    report.changedTiles === 0
      ? `\nnothing changed: 0 of ${report.tiles} tiles differ from the baseline.`
      : `\n${report.changedTiles} of ${report.tiles} tiles changed (${report.percentTilesChanged}%), ` +
          `the worst by ${report.worstTileMeanDelta} in mean channel value. Any change at all is a real change.`,
  );
} else {
  console.error(
    `\n${report.differingPixels} of ${report.pixels} pixels differ (${report.percentDiffering}%). ` +
      `${report.unexplained} of those are not inside a layer already marked unsupported.`,
  );
}
