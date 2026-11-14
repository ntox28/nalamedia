import {
  type DeferredObjectItem,
  type EfficiencySelectionMode,
  type FinishingSpaceRule,
  type LayoutObjectSpec,
  type LayoutPage,
  type LayoutUnit,
  type MediaMode,
  type NestingAlgorithm,
  type ObjectShape,
  type PlacedLayoutItem,
} from '../types';

export const OBJECT_COLORS = [
  '#db2777', // pink-600
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#dc2626', // red-600
  '#4f46e5', // indigo-600
  '#0d9488', // teal-600
  '#ca8a04', // yellow-600
];

export interface MediaPreset {
  id: string;
  name: string;
  mode: MediaMode;
  widthMm: number;
  heightMm: number;
  defaultMarginMm: number;
  description: string;
}

export const MEDIA_PRESETS: MediaPreset[] = [
  {
    id: 'a3-plus-325',
    name: 'A3+ (325 × 485 mm)',
    mode: 'sheet',
    widthMm: 325,
    heightMm: 485,
    defaultMarginMm: 5,
    description: 'Standar kertas A3+ digital printing',
  },
  {
    id: 'a3-plus-320',
    name: 'A3+ (320 × 480 mm)',
    mode: 'sheet',
    widthMm: 320,
    heightMm: 480,
    defaultMarginMm: 5,
    description: 'A3+ varian 32 × 48 cm',
  },
  {
    id: 'a3-plus-print-area',
    name: 'A3+ Area Cetak (310 × 470 mm)',
    mode: 'sheet',
    widthMm: 310,
    heightMm: 470,
    defaultMarginMm: 0,
    description: 'Area efektif siap cetak mesin A3+',
  },
  {
    id: 'sra3',
    name: 'SRA3 (320 × 450 mm)',
    mode: 'sheet',
    widthMm: 320,
    heightMm: 450,
    defaultMarginMm: 5,
    description: 'Standar SRA3',
  },
  {
    id: 'a3',
    name: 'A3 (297 × 420 mm)',
    mode: 'sheet',
    widthMm: 297,
    heightMm: 420,
    defaultMarginMm: 5,
    description: 'Kertas A3 standar',
  },
  {
    id: 'a4',
    name: 'A4 (210 × 297 mm)',
    mode: 'sheet',
    widthMm: 210,
    heightMm: 297,
    defaultMarginMm: 5,
    description: 'Kertas A4 standar',
  },
  {
    id: 'roll-60',
    name: 'Roll 60 cm',
    mode: 'roll',
    widthMm: 600,
    heightMm: 1000,
    defaultMarginMm: 10,
    description: 'Sticker / vinyl lebar 60 cm',
  },
  {
    id: 'roll-100',
    name: 'Roll 100 cm (1 m)',
    mode: 'roll',
    widthMm: 1000,
    heightMm: 2000,
    defaultMarginMm: 10,
    description: 'Banner / vinyl lebar 1 meter',
  },
  {
    id: 'roll-120',
    name: 'Roll 120 cm (1.2 m)',
    mode: 'roll',
    widthMm: 1200,
    heightMm: 2000,
    defaultMarginMm: 10,
    description: 'Sticker / banner lebar 1.2 meter',
  },
  {
    id: 'roll-150',
    name: 'Roll 150 cm (1.5 m)',
    mode: 'roll',
    widthMm: 1500,
    heightMm: 2000,
    defaultMarginMm: 15,
    description: 'Banner / flexi lebar 1.5 meter',
  },
  {
    id: 'roll-160',
    name: 'Roll 160 cm (1.6 m)',
    mode: 'roll',
    widthMm: 1600,
    heightMm: 2000,
    defaultMarginMm: 15,
    description: 'Outdoor / indoor lebar 1.6 meter',
  },
  {
    id: 'roll-320',
    name: 'Roll 320 cm (3.2 m)',
    mode: 'roll',
    widthMm: 3200,
    heightMm: 3000,
    defaultMarginMm: 20,
    description: 'Large format lebar 3.2 meter',
  },
];

export const DEFAULT_FINISHING_SPACE_RULES: FinishingSpaceRule[] = [
  {
    finishingName: 'SPG',
    extraWidthMm: 50,
    extraHeightMm: 50,
    note: 'Penambahan space +5 cm (+50 mm) total lebar & tinggi',
  },
  {
    finishingName: 'SPK',
    extraWidthMm: 100,
    extraHeightMm: 100,
    note: 'Penambahan space +10 cm (+100 mm) total lebar & tinggi',
  },
  {
    finishingName: 'Tanpa Finishing',
    extraWidthMm: 0,
    extraHeightMm: 0,
    note: 'Tidak ada penambahan ukuran',
  },
];

// --- Unit Conversion Utilities ---
export const UNIT_FACTORS: Record<LayoutUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
};

export function mmToUnit(mm: number, unit: LayoutUnit): number {
  return mm / UNIT_FACTORS[unit];
}

export function unitToMm(val: number, unit: LayoutUnit): number {
  return val * UNIT_FACTORS[unit];
}

export function roundForUnit(val: number, unit: LayoutUnit): number {
  const decimals = unit === 'mm' ? 1 : unit === 'cm' ? 2 : 3;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

export function formatUnitValue(mm: number, unit: LayoutUnit): string {
  const converted = roundForUnit(mmToUnit(mm, unit), unit);
  return converted.toString();
}

export function formatDimensions(
  wMm: number,
  hMm: number,
  unit: LayoutUnit,
  shape: ObjectShape = 'rectangle'
): string {
  if (shape === 'circle') {
    return `Ø ${formatUnitValue(wMm, unit)} ${unit}`;
  }
  if (shape === 'ellipse') {
    return `Oval ${formatUnitValue(wMm, unit)} × ${formatUnitValue(hMm, unit)} ${unit}`;
  }
  return `${formatUnitValue(wMm, unit)} × ${formatUnitValue(hMm, unit)} ${unit}`;
}

export function findFinishingRule(
  finishingName: string | undefined,
  rules: FinishingSpaceRule[]
): FinishingSpaceRule | undefined {
  if (!finishingName) return undefined;
  const trimmed = finishingName.trim().toLowerCase();
  if (!trimmed || trimmed === 'tanpa finishing') {
    return rules.find((r) => r.finishingName.trim().toLowerCase() === 'tanpa finishing');
  }

  const exact = rules.find((r) => r.finishingName.trim().toLowerCase() === trimmed);
  if (exact) return exact;

  return rules.find((r) => {
    const ruleKey = r.finishingName.trim().toLowerCase();
    if (!ruleKey || ruleKey === 'tanpa finishing') return false;
    return trimmed.includes(ruleKey) || ruleKey.includes(trimmed);
  });
}

// --- 2D Bin Packing / Auto Nesting Engine ---
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ExpandedItem {
  instanceId: string;
  specId: string;
  copyIndex: number;
  label: string;
  shape: ObjectShape;
  w: number;
  h: number;
  allowRotate: boolean;
  color: string;
  baseWidthMm?: number;
  baseHeightMm?: number;
  finishingName?: string;
  sourceOrderId?: string;
  sourceCustomer?: string;
}

export interface AutoLayoutConfig {
  mediaMode: MediaMode;
  mediaWidthMm: number;
  mediaHeightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  gapXMm: number;
  gapYMm: number;
  algorithm: NestingAlgorithm;
}

export interface AutoLayoutResult {
  pages: LayoutPage[];
  unplacedItems: { label: string; shape: ObjectShape; widthMm: number; heightMm: number; reason: string }[];
  usedHexagonalCircles?: boolean;
}

export interface SmartLayoutResult extends AutoLayoutResult {
  deferredItems: DeferredObjectItem[];
  overallEfficiency: number;
}

function expandSpecs(specs: LayoutObjectSpec[]): ExpandedItem[] {
  const result: ExpandedItem[] = [];
  specs.forEach((spec) => {
    const count = Math.max(0, Math.floor(spec.qty));
    for (let i = 1; i <= count; i++) {
      result.push({
        instanceId: `${spec.id}__${i}`,
        specId: spec.id,
        copyIndex: i,
        label: spec.label,
        shape: spec.shape,
        w: spec.widthMm,
        h: spec.heightMm,
        allowRotate: spec.shape === 'circle' ? false : spec.allowRotate,
        color: spec.color,
        baseWidthMm: spec.baseWidthMm,
        baseHeightMm: spec.baseHeightMm,
        finishingName: spec.finishingName,
        sourceOrderId: spec.sourceOrderId,
        sourceCustomer: spec.sourceCustomer,
      });
    }
  });
  return result;
}

function rectsOverlap(a: Rect, b: Rect, eps = 0.001): boolean {
  return (
    a.x < b.x + b.w - eps &&
    a.x + a.w > b.x + eps &&
    a.y < b.y + b.h - eps &&
    a.y + a.h > b.y + eps
  );
}

function isContainedIn(inner: Rect, outer: Rect, eps = 0.001): boolean {
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  );
}

class MaxRectsBin {
  public freeRects: Rect[];
  public placed: PlacedLayoutItem[] = [];
  private marginLeft: number;
  private marginTop: number;
  private gapX: number;
  private gapY: number;
  private heuristic: 'bssf' | 'bl' | 'baf';

  constructor(
    usableW: number,
    usableH: number,
    marginLeft: number,
    marginTop: number,
    gapX: number,
    gapY: number,
    heuristic: 'bssf' | 'bl' | 'baf'
  ) {
    this.marginLeft = marginLeft;
    this.marginTop = marginTop;
    this.gapX = gapX;
    this.gapY = gapY;
    this.heuristic = heuristic;
    this.freeRects = [{ x: 0, y: 0, w: usableW + gapX, h: usableH + gapY }];
  }

  private scoreRect(free: Rect, vw: number, vh: number): [number, number] {
    if (this.heuristic === 'bl') {
      return [free.y, free.x];
    }
    if (this.heuristic === 'baf') {
      const areaFit = free.w * free.h - vw * vh;
      const shortSide = Math.min(free.w - vw, free.h - vh);
      return [areaFit, shortSide];
    }
    const leftoverHoriz = Math.abs(free.w - vw);
    const leftoverVert = Math.abs(free.h - vh);
    const shortSide = Math.min(leftoverHoriz, leftoverVert);
    const longSide = Math.max(leftoverHoriz, leftoverVert);
    return [shortSide, longSide];
  }

  public insert(item: ExpandedItem): boolean {
    const vwNormal = item.w + this.gapX;
    const vhNormal = item.h + this.gapY;
    const vwRot = item.h + this.gapX;
    const vhRot = item.w + this.gapY;

    let bestScore1 = Infinity;
    let bestScore2 = Infinity;
    let bestRect: Rect | null = null;
    let bestRotated = false;
    let bestActualW = item.w;
    let bestActualH = item.h;

    for (let i = 0; i < this.freeRects.length; i++) {
      const free = this.freeRects[i];

      if (vwNormal <= free.w + 0.001 && vhNormal <= free.h + 0.001) {
        const [s1, s2] = this.scoreRect(free, vwNormal, vhNormal);
        if (s1 < bestScore1 || (s1 === bestScore1 && s2 < bestScore2)) {
          bestScore1 = s1;
          bestScore2 = s2;
          bestRect = { x: free.x, y: free.y, w: vwNormal, h: vhNormal };
          bestRotated = false;
          bestActualW = item.w;
          bestActualH = item.h;
        }
      }

      if (item.allowRotate && Math.abs(item.w - item.h) > 0.001) {
        if (vwRot <= free.w + 0.001 && vhRot <= free.h + 0.001) {
          const [s1, s2] = this.scoreRect(free, vwRot, vhRot);
          if (s1 < bestScore1 || (s1 === bestScore1 && s2 < bestScore2)) {
            bestScore1 = s1;
            bestScore2 = s2;
            bestRect = { x: free.x, y: free.y, w: vwRot, h: vhRot };
            bestRotated = true;
            bestActualW = item.h;
            bestActualH = item.w;
          }
        }
      }
    }

    if (!bestRect) return false;

    this.placed.push({
      instanceId: item.instanceId,
      specId: item.specId,
      copyIndex: item.copyIndex,
      label: item.label,
      shape: item.shape,
      x: roundForUnit(this.marginLeft + bestRect.x, 'cm'),
      y: roundForUnit(this.marginTop + bestRect.y, 'cm'),
      width: bestActualW,
      height: bestActualH,
      rotated: bestRotated,
      color: item.color,
      baseWidthMm: item.baseWidthMm,
      baseHeightMm: item.baseHeightMm,
      finishingName: item.finishingName,
      sourceOrderId: item.sourceOrderId,
      sourceCustomer: item.sourceCustomer,
    });

    this.splitFreeNode(bestRect);
    this.pruneFreeList();
    return true;
  }

  private splitFreeNode(usedNode: Rect) {
    const nextFree: Rect[] = [];
    for (let i = 0; i < this.freeRects.length; i++) {
      const free = this.freeRects[i];
      if (!rectsOverlap(free, usedNode)) {
        nextFree.push(free);
        continue;
      }
      if (usedNode.y > free.y + 0.001) {
        nextFree.push({ x: free.x, y: free.y, w: free.w, h: usedNode.y - free.y });
      }
      if (usedNode.y + usedNode.h < free.y + free.h - 0.001) {
        nextFree.push({
          x: free.x,
          y: usedNode.y + usedNode.h,
          w: free.w,
          h: free.y + free.h - (usedNode.y + usedNode.h),
        });
      }
      if (usedNode.x > free.x + 0.001) {
        nextFree.push({ x: free.x, y: free.y, w: usedNode.x - free.x, h: free.h });
      }
      if (usedNode.x + usedNode.w < free.x + free.w - 0.001) {
        nextFree.push({
          x: usedNode.x + usedNode.w,
          y: free.y,
          w: free.x + free.w - (usedNode.x + usedNode.w),
          h: free.h,
        });
      }
    }
    this.freeRects = nextFree;
  }

  private pruneFreeList() {
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        if (isContainedIn(this.freeRects[i], this.freeRects[j])) {
          this.freeRects.splice(i, 1);
          i--;
          break;
        }
        if (isContainedIn(this.freeRects[j], this.freeRects[i])) {
          this.freeRects.splice(j, 1);
          j--;
        }
      }
    }
  }
}

// Hexagonal / Staggered Packing for Uniform Circles (saves ~10-15% space on A3+ / Roll!)
function packHexagonalCircles(
  items: ExpandedItem[],
  config: AutoLayoutConfig,
  usableW: number,
  usableH: number
): LayoutPage[] | null {
  if (items.length === 0) return null;
  const diameter = items[0].w;
  const allUniformCircles = items.every(
    (it) =>
      it.shape === 'circle' &&
      Math.abs(it.w - diameter) < 0.05 &&
      Math.abs(it.h - diameter) < 0.05
  );
  if (!allUniformCircles) return null;

  const { mediaMode, mediaWidthMm, mediaHeightMm, marginLeftMm, marginTopMm, marginBottomMm, gapXMm, gapYMm } = config;
  const minDist = diameter + Math.max(gapXMm, gapYMm);
  const dx = diameter + gapXMm;
  const halfDx = dx / 2;
  const dy =
    halfDx < minDist
      ? Math.max(diameter * 0.5, Math.sqrt(minDist * minDist - halfDx * halfDx))
      : diameter + gapYMm;

  const pages: LayoutPage[] = [];
  let idx = 0;

  while (idx < items.length) {
    const placed: PlacedLayoutItem[] = [];
    let row = 0;

    while (idx < items.length) {
      const yOffset = row * dy;
      if (mediaMode === 'sheet' && yOffset + diameter > usableH + 0.001) {
        break;
      }

      const xStart = row % 2 === 1 ? halfDx : 0;
      let col = 0;

      while (idx < items.length) {
        const xOffset = xStart + col * dx;
        if (xOffset + diameter > usableW + 0.001) {
          break;
        }
        const item = items[idx];
        placed.push({
          instanceId: item.instanceId,
          specId: item.specId,
          copyIndex: item.copyIndex,
          label: item.label,
          shape: 'circle',
          x: roundForUnit(marginLeftMm + xOffset, 'cm'),
          y: roundForUnit(marginTopMm + yOffset, 'cm'),
          width: diameter,
          height: diameter,
          rotated: false,
          color: item.color,
          baseWidthMm: item.baseWidthMm,
          baseHeightMm: item.baseHeightMm,
          finishingName: item.finishingName,
          sourceOrderId: item.sourceOrderId,
          sourceCustomer: item.sourceCustomer,
        });
        idx++;
        col++;
      }

      if (col === 0 && xStart > 0) {
        // Odd row couldn't fit even 1 circle due to stagger offset; try next even row
        row++;
        continue;
      }
      if (col === 0 && xStart === 0) {
        break;
      }
      row++;
    }

    if (placed.length === 0) break;

    const maxY = placed.reduce((m, it) => Math.max(m, it.y + it.height), marginTopMm);
    const pageH =
      mediaMode === 'roll'
        ? Math.max(200, Math.ceil((maxY + marginBottomMm) * 10) / 10)
        : mediaHeightMm;

    pages.push({
      pageNumber: pages.length + 1,
      widthMm: mediaWidthMm,
      heightMm: pageH,
      items: placed,
    });
  }

  return pages.length > 0 ? pages : null;
}

export function calculateMaxFitPerSheet(
  spec: LayoutObjectSpec,
  config: Pick<
    AutoLayoutConfig,
    'mediaWidthMm' | 'mediaHeightMm' | 'marginLeftMm' | 'marginRightMm' | 'marginTopMm' | 'marginBottomMm' | 'gapXMm' | 'gapYMm' | 'algorithm'
  >
): number {
  const usableW = Math.max(0, config.mediaWidthMm - config.marginLeftMm - config.marginRightMm);
  const usableH = Math.max(0, config.mediaHeightMm - config.marginTopMm - config.marginBottomMm);
  if (spec.widthMm <= 0 || spec.heightMm <= 0) return 0;

  const colsNormal = Math.floor((usableW + config.gapXMm + 0.001) / (spec.widthMm + config.gapXMm));
  const rowsNormal = Math.floor((usableH + config.gapYMm + 0.001) / (spec.heightMm + config.gapYMm));
  let bestCount = Math.max(0, colsNormal) * Math.max(0, rowsNormal);

  if (spec.allowRotate && spec.shape !== 'circle') {
    const colsRot = Math.floor((usableW + config.gapXMm + 0.001) / (spec.heightMm + config.gapXMm));
    const rowsRot = Math.floor((usableH + config.gapYMm + 0.001) / (spec.widthMm + config.gapYMm));
    bestCount = Math.max(bestCount, Math.max(0, colsRot) * Math.max(0, rowsRot));
  }

  if (spec.shape === 'circle' && config.algorithm === 'bestFit' && Math.abs(spec.widthMm - spec.heightMm) < 0.05) {
    const d = spec.widthMm;
    const minDist = d + Math.max(config.gapXMm, config.gapYMm);
    const dx = d + config.gapXMm;
    const halfDx = dx / 2;
    const dy =
      halfDx < minDist
        ? Math.max(d * 0.5, Math.sqrt(minDist * minDist - halfDx * halfDx))
        : d + config.gapYMm;

    let hexCount = 0;
    let row = 0;
    while (row * dy + d <= usableH + 0.001) {
      const xStart = row % 2 === 1 ? halfDx : 0;
      if (xStart + d <= usableW + 0.001) {
        hexCount += Math.floor((usableW - xStart + config.gapXMm + 0.001) / dx);
      }
      row++;
    }
    bestCount = Math.max(bestCount, hexCount);
  }

  return bestCount;
}

function packGuillotineRows(
  items: ExpandedItem[],
  config: AutoLayoutConfig,
  usableW: number,
  usableH: number
): LayoutPage[] {
  const { mediaMode, mediaWidthMm, mediaHeightMm, marginLeftMm, marginTopMm, marginBottomMm, gapXMm, gapYMm } = config;
  const pages: LayoutPage[] = [];

  let currentPlaced: PlacedLayoutItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  const commitPage = () => {
    const maxY = currentPlaced.reduce((m, it) => Math.max(m, it.y + it.height), marginTopMm);
    const pageH =
      mediaMode === 'roll'
        ? Math.max(200, Math.ceil((maxY + marginBottomMm) * 10) / 10)
        : mediaHeightMm;
    pages.push({
      pageNumber: pages.length + 1,
      widthMm: mediaWidthMm,
      heightMm: pageH,
      items: currentPlaced,
    });
    currentPlaced = [];
    cursorX = 0;
    cursorY = 0;
    rowHeight = 0;
  };

  for (const item of items) {
    let w = item.w;
    let h = item.h;
    let rotated = false;

    const fitsNormal = w <= usableW + 0.001 && (mediaMode === 'roll' || h <= usableH + 0.001);
    const fitsRot =
      item.allowRotate && h <= usableW + 0.001 && (mediaMode === 'roll' || w <= usableH + 0.001);

    if (!fitsNormal && fitsRot) {
      w = item.h;
      h = item.w;
      rotated = true;
    } else if (fitsNormal && fitsRot) {
      const remW = usableW - cursorX;
      const normalFitsRow = w <= remW + 0.001;
      const rotFitsRow = h <= remW + 0.001;
      if (rotFitsRow && !normalFitsRow) {
        w = item.h;
        h = item.w;
        rotated = true;
      } else if (normalFitsRow && rotFitsRow && item.w < item.h) {
        w = item.h;
        h = item.w;
        rotated = true;
      }
    }

    if (cursorX > 0 && cursorX + w > usableW + 0.001) {
      cursorX = 0;
      cursorY += rowHeight + gapYMm;
      rowHeight = 0;
    }

    if (mediaMode === 'sheet' && cursorY + h > usableH + 0.001) {
      if (currentPlaced.length > 0) {
        commitPage();
      }
    }

    currentPlaced.push({
      instanceId: item.instanceId,
      specId: item.specId,
      copyIndex: item.copyIndex,
      label: item.label,
      shape: item.shape,
      x: roundForUnit(marginLeftMm + cursorX, 'cm'),
      y: roundForUnit(marginTopMm + cursorY, 'cm'),
      width: w,
      height: h,
      rotated,
      color: item.color,
      baseWidthMm: item.baseWidthMm,
      baseHeightMm: item.baseHeightMm,
      finishingName: item.finishingName,
      sourceOrderId: item.sourceOrderId,
      sourceCustomer: item.sourceCustomer,
    });

    cursorX += w + gapXMm;
    rowHeight = Math.max(rowHeight, h);
  }

  if (currentPlaced.length > 0 || pages.length === 0) {
    commitPage();
  }

  return pages;
}

export function calculateLayoutEfficiency(pages: LayoutPage[]): number {
  const totalMediaArea = pages.reduce((s, pg) => s + pg.widthMm * pg.heightMm, 0);
  if (totalMediaArea <= 0) return 0;
  const totalItemsArea = pages.reduce(
    (s, pg) => s + pg.items.reduce((a, it) => a + it.width * it.height, 0),
    0
  );
  return (totalItemsArea / totalMediaArea) * 100;
}

export function computeAutoLayout(
  specs: LayoutObjectSpec[],
  config: AutoLayoutConfig
): AutoLayoutResult {
  const usableW = Math.max(0, config.mediaWidthMm - config.marginLeftMm - config.marginRightMm);
  const usableH =
    config.mediaMode === 'roll'
      ? 1000000
      : Math.max(0, config.mediaHeightMm - config.marginTopMm - config.marginBottomMm);

  const allItems = expandSpecs(specs);
  const placeable: ExpandedItem[] = [];
  const unplacedItems: AutoLayoutResult['unplacedItems'] = [];

  allItems.forEach((item) => {
    if (item.w <= 0 || item.h <= 0) {
      unplacedItems.push({
        label: item.label,
        shape: item.shape,
        widthMm: item.w,
        heightMm: item.h,
        reason: 'Ukuran lebar/tinggi harus lebih besar dari 0.',
      });
      return;
    }

    const fitsNormal =
      item.w <= usableW + 0.001 && (config.mediaMode === 'roll' || item.h <= usableH + 0.001);
    const fitsRotated =
      item.allowRotate &&
      item.h <= usableW + 0.001 &&
      (config.mediaMode === 'roll' || item.w <= usableH + 0.001);

    if (!fitsNormal && !fitsRotated) {
      unplacedItems.push({
        label: item.label,
        shape: item.shape,
        widthMm: item.w,
        heightMm: item.h,
        reason:
          config.mediaMode === 'roll'
            ? 'Lebar objek melebihi lebar area cetak roll.'
            : 'Ukuran objek melebihi area cetak media.',
      });
      return;
    }

    placeable.push(item);
  });

  if (placeable.length === 0) {
    return {
      pages: [
        {
          pageNumber: 1,
          widthMm: config.mediaWidthMm,
          heightMm: config.mediaMode === 'roll' ? Math.max(500, config.mediaHeightMm) : config.mediaHeightMm,
          items: [],
        },
      ],
      unplacedItems,
    };
  }

  const sortVariants: ((a: ExpandedItem, b: ExpandedItem) => number)[] = [
    (a, b) => b.w * b.h - a.w * a.h || Math.max(b.w, b.h) - Math.max(a.w, a.h),
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h,
    (a, b) => b.h - a.h || b.w - a.w,
    (a, b) => b.w - a.w || b.h - a.h,
  ];

  if (config.algorithm === 'guillotineRow') {
    let bestPages: LayoutPage[] | null = null;
    let bestScore = Infinity;

    for (const sortFn of sortVariants) {
      const sorted = [...placeable].sort(sortFn);
      const pages = packGuillotineRows(sorted, config, usableW, usableH);
      const score =
        config.mediaMode === 'roll'
          ? pages[0].heightMm
          : pages.length * 1000000 +
            pages[pages.length - 1].items.reduce((m, it) => Math.max(m, it.y + it.height), 0);
      if (score < bestScore) {
        bestScore = score;
        bestPages = pages;
      }
    }

    return {
      pages: bestPages || [],
      unplacedItems,
    };
  }

  // MaxRects Best-Fit trials
  const heuristics: ('bssf' | 'bl' | 'baf')[] =
    config.mediaMode === 'roll' ? ['bl', 'bssf', 'baf'] : ['bssf', 'baf', 'bl'];

  let bestPages: LayoutPage[] | null = null;
  let bestScore = Infinity;

  for (const heuristic of heuristics) {
    for (const sortFn of sortVariants) {
      const sorted = [...placeable].sort(sortFn);
      const bins: MaxRectsBin[] = [
        new MaxRectsBin(
          usableW,
          usableH,
          config.marginLeftMm,
          config.marginTopMm,
          config.gapXMm,
          config.gapYMm,
          heuristic
        ),
      ];

      for (const item of sorted) {
        let placed = false;
        for (let b = 0; b < bins.length; b++) {
          if (bins[b].insert(item)) {
            placed = true;
            break;
          }
        }
        if (!placed) {
          const newBin = new MaxRectsBin(
            usableW,
            usableH,
            config.marginLeftMm,
            config.marginTopMm,
            config.gapXMm,
            config.gapYMm,
            heuristic
          );
          newBin.insert(item);
          bins.push(newBin);
        }
      }

      const pages: LayoutPage[] = bins.map((bin, idx) => {
        const maxY = bin.placed.reduce(
          (m, it) => Math.max(m, it.y + it.height),
          config.marginTopMm
        );
        const pageH =
          config.mediaMode === 'roll'
            ? Math.max(200, Math.ceil((maxY + config.marginBottomMm) * 10) / 10)
            : config.mediaHeightMm;
        return {
          pageNumber: idx + 1,
          widthMm: config.mediaWidthMm,
          heightMm: pageH,
          items: bin.placed,
        };
      });

      const lastPageUsedH = pages[pages.length - 1].items.reduce(
        (m, it) => Math.max(m, it.y + it.height),
        0
      );
      const score =
        config.mediaMode === 'roll'
          ? pages[0].heightMm
          : pages.length * 1000000 + lastPageUsedH;

      if (score < bestScore) {
        bestScore = score;
        bestPages = pages;
      }
    }
  }

  // Try Hexagonal Staggered Packing for uniform circles and use it if it is more compact!
  let usedHex = false;
  const hexPages = packHexagonalCircles(placeable, config, usableW, usableH);
  if (hexPages && bestPages) {
    const hexEff = calculateLayoutEfficiency(hexPages);
    const rectEff = calculateLayoutEfficiency(bestPages);
    const hexBetter =
      config.mediaMode === 'roll'
        ? hexPages[0].heightMm <= bestPages[0].heightMm
        : hexPages.length < bestPages.length ||
          (hexPages.length === bestPages.length && hexEff >= rectEff);
    if (hexBetter) {
      bestPages = hexPages;
      usedHex = true;
    }
  }

  return {
    pages: bestPages || [],
    unplacedItems,
    usedHexagonalCircles: usedHex,
  };
}

// --- Smart Efficiency Subset Selection & Packing ---
export function computeSmartLayout(
  specs: LayoutObjectSpec[],
  config: AutoLayoutConfig,
  efficiencyMode: EfficiencySelectionMode,
  minEfficiencyPercent: number,
  forceIncludedIds: Set<string>,
  manualDeferredIds: Set<string>
): SmartLayoutResult {
  const deferredItems: DeferredObjectItem[] = [];
  const candidateSpecs: LayoutObjectSpec[] = [];

  specs.forEach((spec) => {
    if (manualDeferredIds.has(spec.id) && !forceIncludedIds.has(spec.id)) {
      deferredItems.push({
        specId: spec.id,
        label: spec.label,
        shape: spec.shape,
        widthMm: spec.widthMm,
        heightMm: spec.heightMm,
        qty: spec.qty,
        reason: 'Disisihkan manual oleh operator.',
      });
    } else {
      candidateSpecs.push(spec);
    }
  });

  if (efficiencyMode === 'all' || candidateSpecs.length <= 1) {
    const res = computeAutoLayout(candidateSpecs, config);
    return {
      ...res,
      deferredItems,
      overallEfficiency: calculateLayoutEfficiency(res.pages),
    };
  }

  // First check full candidate batch
  const fullRes = computeAutoLayout(candidateSpecs, config);
  const fullEff = calculateLayoutEfficiency(fullRes.pages);

  // Separate specs that are completely unplaceable so they don't confuse subset search
  const unplaceableSpecLabels = new Set(fullRes.unplacedItems.map((u) => u.label));
  const validSpecs = candidateSpecs.filter(
    (s) => s.widthMm > 0 && s.heightMm > 0 && s.qty > 0 && !unplaceableSpecLabels.has(s.label)
  );

  if (fullEff >= minEfficiencyPercent || validSpecs.length <= 1) {
    return {
      ...fullRes,
      deferredItems,
      overallEfficiency: fullEff,
    };
  }

  // Subset optimization: start with forced specs or best seed (single/pair)
  const mandatorySpecs = validSpecs.filter((s) => forceIncludedIds.has(s.id));
  const optionalSpecs = validSpecs.filter((s) => !forceIncludedIds.has(s.id));

  let chosenSpecs: LayoutObjectSpec[] = [];

  if (mandatorySpecs.length > 0) {
    chosenSpecs = [...mandatorySpecs];
  } else {
    // Evaluate all singles and pairs (cap pair search to top 16 largest/widest if huge list)
    const searchPool = optionalSpecs.slice(0, 16);
    let bestSeed: LayoutObjectSpec[] = [optionalSpecs[0]];
    let bestSeedMeets = false;
    let bestSeedEff = -1;
    let bestSeedArea = -1;

    const evaluateSeed = (seed: LayoutObjectSpec[]) => {
      const res = computeAutoLayout(seed, config);
      const eff = calculateLayoutEfficiency(res.pages);
      const area = seed.reduce((s, sp) => s + sp.widthMm * sp.heightMm * sp.qty, 0);
      const meets = eff >= minEfficiencyPercent;

      if (meets && !bestSeedMeets) {
        bestSeed = seed;
        bestSeedMeets = true;
        bestSeedEff = eff;
        bestSeedArea = area;
      } else if (meets === bestSeedMeets) {
        if (meets) {
          // Both meet threshold: prefer larger printed area, tiebreak higher efficiency
          if (area > bestSeedArea || (area === bestSeedArea && eff > bestSeedEff)) {
            bestSeed = seed;
            bestSeedEff = eff;
            bestSeedArea = area;
          }
        } else {
          // Neither meets threshold: prefer highest efficiency
          if (eff > bestSeedEff || (eff === bestSeedEff && area > bestSeedArea)) {
            bestSeed = seed;
            bestSeedEff = eff;
            bestSeedArea = area;
          }
        }
      }
    };

    for (let i = 0; i < searchPool.length; i++) {
      evaluateSeed([searchPool[i]]);
      for (let j = i + 1; j < searchPool.length; j++) {
        evaluateSeed([searchPool[i], searchPool[j]]);
      }
    }

    chosenSpecs = [...bestSeed];
  }

  // Greedily add remaining optional specs that keep efficiency >= target (or improve it)
  const chosenIds = new Set(chosenSpecs.map((s) => s.id));
  let currentRes = computeAutoLayout(chosenSpecs, config);
  let currentEff = calculateLayoutEfficiency(currentRes.pages);

  while (true) {
    let bestAdd: LayoutObjectSpec | null = null;
    let bestAddEff = -1;
    let bestAddArea = -1;

    for (const cand of optionalSpecs) {
      if (chosenIds.has(cand.id)) continue;
      const trialSpecs = [...chosenSpecs, cand];
      const trialRes = computeAutoLayout(trialSpecs, config);
      const trialEff = calculateLayoutEfficiency(trialRes.pages);
      const candArea = cand.widthMm * cand.heightMm * cand.qty;

      const acceptable =
        trialEff >= minEfficiencyPercent ||
        (currentEff < minEfficiencyPercent && trialEff > currentEff + 0.5);

      if (acceptable) {
        if (
          trialEff > bestAddEff ||
          (Math.abs(trialEff - bestAddEff) < 0.2 && candArea > bestAddArea)
        ) {
          bestAdd = cand;
          bestAddEff = trialEff;
          bestAddArea = candArea;
        }
      }
    }

    if (!bestAdd) break;
    chosenSpecs.push(bestAdd);
    chosenIds.add(bestAdd.id);
    currentRes = computeAutoLayout(chosenSpecs, config);
    currentEff = calculateLayoutEfficiency(currentRes.pages);
  }

  // Build deferred list for specs excluded by smart efficiency filter
  optionalSpecs.forEach((spec) => {
    if (chosenIds.has(spec.id)) return;
    const trialRes = computeAutoLayout([...chosenSpecs, spec], config);
    const trialEff = calculateLayoutEfficiency(trialRes.pages);

    deferredItems.push({
      specId: spec.id,
      label: spec.label,
      shape: spec.shape,
      widthMm: spec.widthMm,
      heightMm: spec.heightMm,
      qty: spec.qty,
      reason:
        config.mediaMode === 'roll'
          ? `Jika digabung, efisiensi roll turun ke ${trialEff.toFixed(1)}% (target ${minEfficiencyPercent}%). Cocok dipindah ke ukuran roll lain atau tunggu pasangan.`
          : `Jika digabung, efisiensi lembar turun ke ${trialEff.toFixed(1)}% (target ${minEfficiencyPercent}%) karena menyisakan ruang kosong berlebih.`,
    });
  });

  // Keep unplaceable items in final result so warning still shows
  const finalPack = computeAutoLayout(
    [
      ...chosenSpecs,
      ...candidateSpecs.filter((s) => unplaceableSpecLabels.has(s.label)),
    ],
    config
  );

  return {
    ...finalPack,
    deferredItems,
    overallEfficiency: calculateLayoutEfficiency(finalPack.pages),
  };
}

// --- Validation / Overlap Detection ---
export interface PageIssues {
  overlappingIds: Set<string>;
  outOfBoundsIds: Set<string>;
}

export function checkPageIssues(
  page: LayoutPage,
  margins: { left: number; right: number; top: number; bottom: number }
): PageIssues {
  const overlappingIds = new Set<string>();
  const outOfBoundsIds = new Set<string>();
  const eps = 0.05;

  for (let i = 0; i < page.items.length; i++) {
    const a = page.items[i];
    if (
      a.x < margins.left - eps ||
      a.y < margins.top - eps ||
      a.x + a.width > page.widthMm - margins.right + eps ||
      a.y + a.height > page.heightMm - margins.bottom + eps
    ) {
      outOfBoundsIds.add(a.instanceId);
    }

    for (let j = i + 1; j < page.items.length; j++) {
      const b = page.items[j];
      if (a.shape === 'circle' && b.shape === 'circle') {
        const ax = a.x + a.width / 2;
        const ay = a.y + a.height / 2;
        const bx = b.x + b.width / 2;
        const by = b.y + b.height / 2;
        const dist = Math.hypot(ax - bx, ay - by);
        const minSumR = a.width / 2 + b.width / 2 - eps;
        if (dist < minSumR) {
          overlappingIds.add(a.instanceId);
          overlappingIds.add(b.instanceId);
        }
      } else {
        const overlapX = a.x < b.x + b.width - eps && a.x + a.width > b.x + eps;
        const overlapY = a.y < b.y + b.height - eps && a.y + a.height > b.y + eps;
        if (overlapX && overlapY) {
          overlappingIds.add(a.instanceId);
          overlappingIds.add(b.instanceId);
        }
      }
    }
  }

  return { overlappingIds, outOfBoundsIds };
}

// --- CorelDRAW 1:1 SVG Export ---
export interface SvgExportOptions {
  unit: LayoutUnit;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  includeLabels: boolean;
  includeCropMarks: boolean;
  includeBaseDesignOutline: boolean;
  includePageHeader: boolean;
  storeName?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generatePageSvg(page: LayoutPage, options: SvgExportOptions): string {
  const {
    unit,
    marginLeftMm,
    marginRightMm,
    marginTopMm,
    marginBottomMm,
    includeLabels,
    includeCropMarks,
    includeBaseDesignOutline,
    includePageHeader,
    storeName,
  } = options;

  const w = page.widthMm;
  const h = page.heightMm;
  const usableW = Math.max(0, w - marginLeftMm - marginRightMm);
  const usableH = Math.max(0, h - marginTopMm - marginBottomMm);
  const hasMargins =
    marginLeftMm > 0 || marginRightMm > 0 || marginTopMm > 0 || marginBottomMm > 0;

  const maxDim = Math.max(w, h);
  const hairline = maxDim > 1000 ? 0.5 : 0.25;
  const cropMarkLen = maxDim > 1000 ? 8 : 3;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">`
  );
  lines.push(
    `  <title>${escapeXml(
      `Template Layout Hal-${page.pageNumber} (${formatDimensions(w, h, unit)})`
    )}</title>`
  );

  // Layer 1: Media & Margins
  lines.push(`  <g id="01_Media_dan_Margin">`);
  lines.push(
    `    <rect id="Batas_Media" x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#94a3b8" stroke-width="${hairline}" />`
  );
  if (hasMargins && usableW > 0 && usableH > 0) {
    lines.push(
      `    <rect id="Batas_Area_Cetak" x="${marginLeftMm}" y="${marginTopMm}" width="${usableW}" height="${usableH}" fill="none" stroke="#38bdf8" stroke-width="${hairline}" stroke-dasharray="${
        hairline * 6
      },${hairline * 4}" />`
    );
  }
  lines.push(`  </g>`);

  // Layer 2: Object Vector Outlines (Rectangle, Circle, Ellipse - PowerClip Ready)
  lines.push(`  <g id="02_Template_Objek">`);
  page.items.forEach((item, idx) => {
    const safeId = `Objek_${idx + 1}_${item.label.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;

    if (item.shape === 'circle') {
      const r = Math.min(item.width, item.height) / 2;
      lines.push(
        `    <circle id="${escapeXml(safeId)}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${
          item.color
        }" stroke-width="${hairline}" />`
      );
    } else if (item.shape === 'ellipse') {
      lines.push(
        `    <ellipse id="${escapeXml(safeId)}" cx="${cx}" cy="${cy}" rx="${
          item.width / 2
        }" ry="${item.height / 2}" fill="none" stroke="${
          item.color
        }" stroke-width="${hairline}" />`
      );
    } else {
      lines.push(
        `    <rect id="${escapeXml(safeId)}" x="${item.x}" y="${item.y}" width="${
          item.width
        }" height="${item.height}" fill="none" stroke="${
          item.color
        }" stroke-width="${hairline}" />`
      );
    }

    if (
      includeBaseDesignOutline &&
      item.baseWidthMm &&
      item.baseHeightMm &&
      (Math.abs((item.rotated ? item.baseHeightMm : item.baseWidthMm) - item.width) > 0.1 ||
        Math.abs((item.rotated ? item.baseWidthMm : item.baseHeightMm) - item.height) > 0.1)
    ) {
      const innerW = item.rotated ? item.baseHeightMm : item.baseWidthMm;
      const innerH = item.rotated ? item.baseWidthMm : item.baseHeightMm;
      if (innerW > 0 && innerH > 0 && innerW <= item.width && innerH <= item.height) {
        if (item.shape === 'circle') {
          lines.push(
            `    <circle id="${escapeXml(
              `${safeId}_Area_Desain`
            )}" cx="${cx}" cy="${cy}" r="${Math.min(innerW, innerH) / 2}" fill="none" stroke="${
              item.color
            }" stroke-width="${hairline * 0.8}" stroke-dasharray="${hairline * 5},${hairline * 3}" />`
          );
        } else if (item.shape === 'ellipse') {
          lines.push(
            `    <ellipse id="${escapeXml(
              `${safeId}_Area_Desain`
            )}" cx="${cx}" cy="${cy}" rx="${innerW / 2}" ry="${innerH / 2}" fill="none" stroke="${
              item.color
            }" stroke-width="${hairline * 0.8}" stroke-dasharray="${hairline * 5},${hairline * 3}" />`
          );
        } else {
          const innerX = item.x + (item.width - innerW) / 2;
          const innerY = item.y + (item.height - innerH) / 2;
          lines.push(
            `    <rect id="${escapeXml(
              `${safeId}_Area_Desain`
            )}" x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" fill="none" stroke="${
              item.color
            }" stroke-width="${hairline * 0.8}" stroke-dasharray="${hairline * 5},${hairline * 3}" />`
          );
        }
      }
    }
  });
  lines.push(`  </g>`);

  // Layer 3: Crop Marks (for rectangular items)
  if (includeCropMarks) {
    lines.push(`  <g id="03_Crop_Marks" stroke="#0f172a" stroke-width="${hairline}">`);
    page.items.forEach((item) => {
      if (item.shape !== 'rectangle') return;
      const x1 = item.x;
      const y1 = item.y;
      const x2 = item.x + item.width;
      const y2 = item.y + item.height;
      const d = cropMarkLen;
      lines.push(`    <line x1="${x1 - d}" y1="${y1}" x2="${x1}" y2="${y1}" />`);
      lines.push(`    <line x1="${x1}" y1="${y1 - d}" x2="${x1}" y2="${y1}" />`);
      lines.push(`    <line x1="${x2}" y1="${y1}" x2="${x2 + d}" y2="${y1}" />`);
      lines.push(`    <line x1="${x2}" y1="${y1 - d}" x2="${x2}" y2="${y1}" />`);
      lines.push(`    <line x1="${x1 - d}" y1="${y2}" x2="${x1}" y2="${y2}" />`);
      lines.push(`    <line x1="${x1}" y1="${y2}" x2="${x1}" y2="${y2 + d}" />`);
      lines.push(`    <line x1="${x2}" y1="${y2}" x2="${x2 + d}" y2="${y2}" />`);
      lines.push(`    <line x1="${x2}" y1="${y2}" x2="${x2}" y2="${y2 + d}" />`);
    });
    lines.push(`  </g>`);
  }

  // Layer 4: Labels inside objects
  if (includeLabels) {
    lines.push(`  <g id="04_Label_Keterangan" font-family="Arial, Helvetica, sans-serif">`);
    page.items.forEach((item) => {
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const minSide = Math.min(item.width, item.height);
      const fontSize = Math.max(2.0, Math.min(minSide * 0.11, item.width * 0.055, 18));
      const smallFont = Math.max(1.6, fontSize * 0.72);
      const dimLabel = `${formatDimensions(item.width, item.height, unit, item.shape)}${
        item.rotated ? ' (Putar 90°)' : ''
      }`;
      const hasExtra =
        item.baseWidthMm &&
        item.baseHeightMm &&
        (Math.abs((item.rotated ? item.baseHeightMm : item.baseWidthMm) - item.width) > 0.1 ||
          Math.abs((item.rotated ? item.baseWidthMm : item.baseHeightMm) - item.height) > 0.1);
      const finishingSub = hasExtra
        ? `Desain: ${formatDimensions(
            item.baseWidthMm!,
            item.baseHeightMm!,
            unit,
            item.shape
          )}${item.finishingName ? ` | ${item.finishingName}` : ''}`
        : '';

      const titleText =
        item.label.length > 32 ? item.label.slice(0, 30) + '..' : item.label;

      lines.push(
        `    <text x="${cx}" y="${
          finishingSub ? cy - fontSize * 0.55 : cy - fontSize * 0.2
        }" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-weight="bold" fill="${
          item.color
        }">${escapeXml(titleText)}</text>`
      );
      lines.push(
        `    <text x="${cx}" y="${
          finishingSub ? cy + fontSize * 0.45 : cy + fontSize * 0.85
        }" text-anchor="middle" dominant-baseline="middle" font-size="${smallFont}" fill="#334155">${escapeXml(
          dimLabel
        )}</text>`
      );
      if (finishingSub) {
        lines.push(
          `    <text x="${cx}" y="${
            cy + fontSize * 1.45
          }" text-anchor="middle" dominant-baseline="middle" font-size="${
            smallFont * 0.88
          }" fill="#64748b">${escapeXml(finishingSub)}</text>`
        );
      }
    });
    lines.push(`  </g>`);
  }

  // Layer 5: Page Info Header
  if (includePageHeader) {
    const infoFontSize = maxDim > 1000 ? 10 : 3;
    const infoY = Math.max(
      infoFontSize + 1,
      marginTopMm > infoFontSize + 2 ? marginTopMm - 1.5 : infoFontSize + 1.5
    );
    const infoX = Math.max(2, marginLeftMm);
    const headerText = `${storeName ? storeName + ' | ' : ''}Hal ${
      page.pageNumber
    } | Media: ${formatDimensions(w, h, unit)} | Total Objek: ${page.items.length} pcs`;
    lines.push(`  <g id="05_Info_Halaman" font-family="Arial, Helvetica, sans-serif">`);
    lines.push(
      `    <text x="${infoX}" y="${infoY}" font-size="${infoFontSize}" fill="#475569">${escapeXml(
        headerText
      )}</text>`
    );
    lines.push(`  </g>`);
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}
