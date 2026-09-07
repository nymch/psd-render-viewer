import {describe, expect, it} from "vitest";
import type {Layer, Psd} from "ag-psd";
import {UNNAMED_LAYER, buildLayerTree, countUnsupported} from "@/lib/psd/tree";
import type {LayerGroup, LayerNode} from "@/lib/psd/tree";

function pixels(width = 1, height = 1) {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  };
}

function leaf(overrides: Partial<Layer> = {}): Layer {
  return {
    name: "レイヤー",
    left: 0,
    top: 0,
    right: 1,
    bottom: 1,
    opacity: 1,
    blendMode: "normal",
    imageData: pixels(),
    ...overrides,
  };
}

function psd(children: Layer[]): Psd {
  return {width: 100, height: 100, children};
}

function asGroup(node: LayerNode): LayerGroup {
  if (node.kind !== "group") throw new Error("グループではない");
  return node;
}

describe("buildLayerTree", () => {
  it("children[0]が最背面のまま、順序を変えずに並ぶ", () => {
    const {nodes} = buildLayerTree(
      psd([leaf({name: "背面"}), leaf({name: "前面"})]),
    );
    expect(nodes.map((node) => node.name)).toEqual(["背面", "前面"]);
  });

  it("hiddenがtrueのノードはvisibleがfalseになる", () => {
    const {nodes} = buildLayerTree(psd([leaf({hidden: true})]));
    expect(nodes[0]?.visible).toBe(false);
  });

  it("hiddenが無いノードはvisibleがtrueになる", () => {
    const {nodes} = buildLayerTree(psd([leaf()]));
    expect(nodes[0]?.visible).toBe(true);
  });

  it("nameがundefinedのとき既定の名前になる", () => {
    const {nodes} = buildLayerTree(psd([leaf({name: undefined})]));
    expect(nodes[0]?.name).toBe(UNNAMED_LAYER);
  });

  it("pass throughのグループの不透明度が子に掛け合わされる", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "通過グループ",
          blendMode: "pass through",
          opacity: 0.5,
          children: [leaf({opacity: 0.5})],
        },
      ]),
    );
    expect(asGroup(nodes[0]!).children[0]?.renderOpacity).toBe(0.25);
  });

  it("pass throughのグループ自身は不透明度を持たない（子へ渡したので二重に掛からない）", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "通過グループ",
          blendMode: "pass through",
          opacity: 0.5,
          children: [leaf()],
        },
      ]),
    );
    expect(nodes[0]?.renderOpacity).toBe(1);
  });

  it("分離グループの不透明度は子に掛け合わされず、グループのノードに残る", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "分離グループ",
          blendMode: "normal",
          opacity: 0.5,
          children: [leaf({opacity: 1})],
        },
      ]),
    );
    const group = asGroup(nodes[0]!);
    expect(group.renderOpacity).toBe(0.5);
    expect(group.children[0]?.renderOpacity).toBe(1);
  });

  it("分離グループが通過グループの中にあるとき、親の不透明度はグループ自身へ乗る", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "通過グループ",
          blendMode: "pass through",
          opacity: 0.5,
          children: [
            {
              name: "分離グループ",
              blendMode: "normal",
              opacity: 0.5,
              children: [leaf({opacity: 1})],
            },
          ],
        },
      ]),
    );
    const inner = asGroup(asGroup(nodes[0]!).children[0]!);
    expect(inner.renderOpacity).toBe(0.25);
    expect(inner.children[0]?.renderOpacity).toBe(1);
  });

  it("blendModeが無いグループは通過として扱う", () => {
    const {nodes} = buildLayerTree(
      psd([{name: "グループ", children: [leaf()]}]),
    );
    expect(asGroup(nodes[0]!).isolated).toBe(false);
  });

  it("blendModeが無いレイヤーは通常合成として扱う", () => {
    const {nodes} = buildLayerTree(psd([leaf({blendMode: undefined})]));
    expect(nodes[0]?.blendMode).toBe("normal");
  });

  it("ピクセルはノードではなくストアに入り、ノードはidだけを持つ", () => {
    const {nodes, pixels: store} = buildLayerTree(psd([leaf()]));
    const node = nodes[0];
    if (node?.kind !== "layer") throw new Error("レイヤーではない");
    expect(node.pixelId).not.toBeNull();
    expect(store.get(node.pixelId!)?.width).toBe(1);
  });

  it("disabledなマスクは読まない", () => {
    const {nodes} = buildLayerTree(
      psd([
        leaf({
          mask: {left: 0, top: 0, right: 1, bottom: 1, disabled: true, imageData: pixels()},
        }),
      ]),
    );
    expect(nodes[0]?.mask).toBeNull();
  });

  it("マスクは矩形とdefaultColorを保って読まれる", () => {
    const {nodes} = buildLayerTree(
      psd([
        leaf({
          mask: {left: 2, top: 3, right: 5, bottom: 7, defaultColor: 255, imageData: pixels(3, 4)},
        }),
      ]),
    );
    expect(nodes[0]?.mask).toMatchObject({
      bounds: {left: 2, top: 3, right: 5, bottom: 7},
      defaultColor: 255,
    });
  });
});

describe("未対応の判定", () => {
  it("対応する演算が無い描画モードが未対応として記録される", () => {
    const {nodes} = buildLayerTree(psd([leaf({blendMode: "vivid light"})]));
    expect(nodes[0]?.unsupported).toContainEqual({
      kind: "blend-mode",
      blendMode: "vivid light",
    });
  });

  it("レイヤー効果が未対応として記録される", () => {
    const {nodes} = buildLayerTree(psd([leaf({effects: {}})]));
    expect(nodes[0]?.unsupported).toContainEqual({kind: "layer-effects"});
  });

  it("blendClippendElementsが明示的にfalseのときだけ未対応になる", () => {
    const on = buildLayerTree(psd([leaf({blendClippendElements: true})]));
    const off = buildLayerTree(psd([leaf({blendClippendElements: false})]));
    expect(on.nodes[0]?.unsupported).toEqual([]);
    expect(off.nodes[0]?.unsupported).toContainEqual({
      kind: "clipped-elements-ungrouped",
    });
  });

  it("countUnsupportedは入れ子のグループの中まで数える", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "グループ",
          children: [leaf({blendMode: "hard mix"}), leaf()],
        },
        leaf({effects: {}}),
      ]),
    );
    expect(countUnsupported(nodes)).toBe(2);
  });
});
