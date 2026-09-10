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
    name: "Layer",
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
  if (node.kind !== "group") throw new Error("not a group");
  return node;
}

describe("buildLayerTree", () => {
  it("keeps children[0] backmost and does not reorder", () => {
    // 背面 is left non-ASCII deliberately, guarding against a regression in layer names
    const {nodes} = buildLayerTree(
      psd([leaf({name: "背面"}), leaf({name: "Front"})]),
    );
    expect(nodes.map((node) => node.name)).toEqual(["背面", "Front"]);
  });

  it("turns hidden: true into visible: false", () => {
    const {nodes} = buildLayerTree(psd([leaf({hidden: true})]));
    expect(nodes[0]?.visible).toBe(false);
  });

  it("turns a missing hidden into visible: true", () => {
    const {nodes} = buildLayerTree(psd([leaf()]));
    expect(nodes[0]?.visible).toBe(true);
  });

  it("falls back to UNNAMED_LAYER when name is undefined", () => {
    const {nodes} = buildLayerTree(psd([leaf({name: undefined})]));
    expect(nodes[0]?.name).toBe(UNNAMED_LAYER);
  });

  it("multiplies a pass-through group's opacity into its children", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "Pass through group",
          blendMode: "pass through",
          opacity: 0.5,
          children: [leaf({opacity: 0.5})],
        },
      ]),
    );
    expect(asGroup(nodes[0]!).children[0]?.renderOpacity).toBe(0.25);
  });

  it("leaves a pass-through group itself at 1, so its opacity is not applied twice", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "Pass through group",
          blendMode: "pass through",
          opacity: 0.5,
          children: [leaf()],
        },
      ]),
    );
    expect(nodes[0]?.renderOpacity).toBe(1);
  });

  it("keeps an isolated group's opacity on the group and off its children", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "Isolated group",
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

  it("applies a pass-through parent's opacity to an isolated group itself, not its children", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "Pass through group",
          blendMode: "pass through",
          opacity: 0.5,
          children: [
            {
              name: "Isolated group",
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

  it("treats a group with no blendMode as pass through", () => {
    const {nodes} = buildLayerTree(
      psd([{name: "Group", children: [leaf()]}]),
    );
    expect(asGroup(nodes[0]!).isolated).toBe(false);
  });

  it("treats a layer with no blendMode as normal", () => {
    const {nodes} = buildLayerTree(psd([leaf({blendMode: undefined})]));
    expect(nodes[0]?.blendMode).toBe("normal");
  });

  it("puts pixels in the store and leaves the node holding only an id", () => {
    const {nodes, pixels: store} = buildLayerTree(psd([leaf()]));
    const node = nodes[0];
    if (node?.kind !== "layer") throw new Error("not a layer");
    expect(node.pixelId).not.toBeNull();
    expect(store.get(node.pixelId!)?.width).toBe(1);
  });

  it("drops a mask whose disabled is true", () => {
    const {nodes} = buildLayerTree(
      psd([
        leaf({
          mask: {left: 0, top: 0, right: 1, bottom: 1, disabled: true, imageData: pixels()},
        }),
      ]),
    );
    expect(nodes[0]?.mask).toBeNull();
  });

  it("keeps a mask's rectangle and defaultColor", () => {
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

describe("unsupported detection", () => {
  it("records a blend mode with no matching operation as unsupported", () => {
    const {nodes} = buildLayerTree(psd([leaf({blendMode: "vivid light"})]));
    expect(nodes[0]?.unsupported).toContainEqual({
      kind: "blend-mode",
      blendMode: "vivid light",
    });
  });

  it("records layer effects as unsupported", () => {
    const {nodes} = buildLayerTree(psd([leaf({effects: {}})]));
    expect(nodes[0]?.unsupported).toContainEqual({kind: "layer-effects"});
  });

  it("records blendClippendElements as unsupported only when explicitly false", () => {
    const on = buildLayerTree(psd([leaf({blendClippendElements: true})]));
    const off = buildLayerTree(psd([leaf({blendClippendElements: false})]));
    expect(on.nodes[0]?.unsupported).toEqual([]);
    expect(off.nodes[0]?.unsupported).toContainEqual({
      kind: "clipped-elements-ungrouped",
    });
  });

  it("counts unsupported nodes inside nested groups", () => {
    const {nodes} = buildLayerTree(
      psd([
        {
          name: "Group",
          children: [leaf({blendMode: "hard mix"}), leaf()],
        },
        leaf({effects: {}}),
      ]),
    );
    expect(countUnsupported(nodes)).toBe(2);
  });
});
