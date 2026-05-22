import type { Point, Segment } from '../types'
import { calculateDistance } from './distance'

/** A4 纸物理尺寸（毫米） */
export const A4_MM = {
  width: 210,
  height: 297
} as const

export type PaperOrientation = 'landscape' | 'portrait'

export interface A4CanvasSize {
  widthPx: number
  heightPx: number
  orientation: PaperOrientation
}

/** 与 Home.vue 中 canvas 像素尺寸一致 */
export function getA4CanvasSize(orientation: PaperOrientation): A4CanvasSize {
  return orientation === 'landscape'
    ? { widthPx: 842, heightPx: 595, orientation }
    : { widthPx: 595, heightPx: 842, orientation }
}

/**
 * 画布长边对应的纸面毫米长度（横向时宽 297mm，纵向时宽 210mm）
 */
export function getPaperWidthMm(orientation: PaperOrientation): number {
  return orientation === 'landscape' ? A4_MM.height : A4_MM.width
}

/**
 * 地图比例尺 1:N：画布像素距离 → 实地米
 * 公式：实地(m) = 像素距离 × (纸面宽mm / 画布宽px) × (N / 1000)
 */
export function pixelsToMeters(
  pixelDistance: number,
  scaleDenominator: number,
  canvas: A4CanvasSize
): number {
  if (pixelDistance <= 0 || scaleDenominator <= 0) return 0
  const paperWidthMm = getPaperWidthMm(canvas.orientation)
  const metersPerPixel = (paperWidthMm / 1000) * scaleDenominator / canvas.widthPx
  return pixelDistance * metersPerPixel
}

/** 相邻点间直线距离（像素） */
export function segmentPixelLength(points: Point[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(points[i - 1], points[i])
  }
  return total
}

export function segmentLengthMeters(
  points: Point[],
  scaleDenominator: number,
  canvas: A4CanvasSize
): number {
  return pixelsToMeters(segmentPixelLength(points), scaleDenominator, canvas)
}

export interface SegmentRouteStat {
  index: number
  id: string
  name: string
  pointCount: number
  pixelLength: number
  meters: number
  percentOfTotal: number
}

export interface RouteCompareSummary {
  segments: SegmentRouteStat[]
  totalPixels: number
  totalMeters: number
  longestIndex: number | null
  shortestIndex: number | null
}

export function buildRouteCompare(
  segments: Segment[],
  scaleDenominator: number,
  canvas: A4CanvasSize
): RouteCompareSummary {
  const rows: SegmentRouteStat[] = segments.map((seg, index) => {
    const pixelLength = segmentPixelLength(seg.points)
    const meters = pixelsToMeters(pixelLength, scaleDenominator, canvas)
    return {
      index,
      id: seg.id,
      name: seg.name || `分段${index + 1}`,
      pointCount: seg.points.length,
      pixelLength,
      meters,
      percentOfTotal: 0
    }
  })

  const totalPixels = rows.reduce((s, r) => s + r.pixelLength, 0)
  const totalMeters = rows.reduce((s, r) => s + r.meters, 0)

  rows.forEach(r => {
    r.percentOfTotal = totalMeters > 0 ? (r.meters / totalMeters) * 100 : 0
  })

  const withPoints = rows.filter(r => r.pointCount >= 2)
  let longestIndex: number | null = null
  let shortestIndex: number | null = null
  if (withPoints.length > 0) {
    const sorted = [...withPoints].sort((a, b) => b.meters - a.meters)
    longestIndex = sorted[0].index
    shortestIndex = sorted[sorted.length - 1].index
  }

  return { segments: rows, totalPixels, totalMeters, longestIndex, shortestIndex }
}

export const MAP_SCALE_PRESETS = [5000, 10000, 15000, 20000, 25000] as const

export function formatDistance(
  pixelDistance: number,
  scaleEnabled: boolean,
  scaleDenominator: number,
  canvas: A4CanvasSize
): { value: string; unit: string } {
  if (!scaleEnabled) {
    return { value: pixelDistance.toFixed(1), unit: 'px' }
  }
  const m = pixelsToMeters(pixelDistance, scaleDenominator, canvas)
  if (m >= 1000) {
    return { value: (m / 1000).toFixed(2), unit: 'km' }
  }
  return { value: m.toFixed(2), unit: 'm' }
}
