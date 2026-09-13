import type {BlendMode} from "ag-psd";

/**
 * Every string the app shows a user.
 *
 * Entries that interpolate a value are functions rather than strings with placeholders, so the
 * compiler checks their arguments and no format language has to be parsed at run time.
 *
 * **Do not write `as const`.** It narrows every entry to its own literal type, so `Dictionary`
 * would then demand that a second locale repeat the Japanese verbatim — every correctly
 * translated line would fail to compile.
 *
 * Internal `throw` messages are deliberately absent. A localized invariant message is harder to
 * trace than the original, and the user can act on neither. See docs/design/ui-text-dictionary.md.
 */
export const ja = {
  filePicker: {
    label: "ファイルを選択",
  },
  viewer: {
    empty: "PSDファイルを選ぶか、ここへドロップする",
    loading: (fileName: string) => `${fileName}を読み込んでいる…`,
  },
  layerPanel: {
    heading: "レイヤー",
    empty: "レイヤーがない",
    unsupportedCount: (count: number) => `未対応${count}件`,
    /** Shown in place of the name when a layer carries none */
    unnamedLayer: "（名称未設定）",
    unsupportedBadge: "未対応の要素がある",
  },
  /** One entry per `UnsupportedReason`, formatted in LayerRow */
  unsupported: {
    adjustmentLayer: "調整レイヤーは描画しない。下のレイヤーの色は変わらない",
    layerEffects: "レイヤー効果は再現しない。効果を除いたピクセルだけを描く",
    blendMode: (blendMode: BlendMode) =>
      `描画モード「${blendMode}」に対応していない。「通常」として合成する`,
    clippedElementsUngrouped:
      "クリッピングマスクをグループとして合成しない設定には対応していない",
    vectorMask: "ベクトルマスクは適用しない",
  },
  loadError: {
    /** The frame around a reason. `message` is already formatted, or came through raw */
    frame: (fileName: string, message: string) =>
      `⚠ ${fileName}を読み込めなかった: ${message}`,
    workerError: "読み込み中にエラーが起きた",
    memoryLimit: "PSDが大きすぎて読み込めない",
    edge: (edge: number, limit: number) =>
      `ドキュメントの長辺が${edge}pxで、上限の${limit}pxを超えている`,
    area: (area: number, limit: number) =>
      `ドキュメントの面積が${area.toLocaleString()}pxで、上限の${limit.toLocaleString()}pxを超えている`,
    bitsPerChannel: (bitsPerChannel: number) =>
      `${bitsPerChannel}bit/チャンネルのPSDには対応していない（8bitのみ）`,
  },
};
