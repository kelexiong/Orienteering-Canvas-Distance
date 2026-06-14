import type { Point, Segment, SegmentTrackRole } from '../types'
import { calculateDistance } from './distance'
import { pixelsToMeters, segmentPixelLength, type A4CanvasSize } from './mapScale'

export const DEFAULT_ACTUAL_COLOR = '#409EFF'
export const DEFAULT_COMPARE_COLOR = '#E6A23C'
export const MAX_DIRECTION_ARROWS = 5

export function createSegment(partial: {
  name: string
  trackRole: SegmentTrackRole
  groupId: string
  parentActualId?: string
  color?: string
  finished?: boolean
}): Segment {
  const now = new Date()
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    name: partial.name,
    points: [],
    markers: [],
    description: '',
    createdAt: now,
    updatedAt: now,
    trackRole: partial.trackRole,
    groupId: partial.groupId,
    parentActualId: partial.parentActualId,
    color:
      partial.color ??
      (partial.trackRole === 'compare' ? DEFAULT_COMPARE_COLOR : DEFAULT_ACTUAL_COLOR),
    finished: partial.finished ?? false
  }
}

export function segmentPathLength(points: Point[]): number {
  return segmentPixelLength(points)
}

/** 根据路径长度决定方向箭头数量，范围 0 到 5。 */
export function getDirectionArrowCount(pathLengthPx: number): number {
  if (pathLengthPx < 40) return 0
  if (pathLengthPx < 120) return 1
  if (pathLengthPx < 240) return 2
  if (pathLengthPx < 400) return 3
  if (pathLengthPx < 600) return 4
  return MAX_DIRECTION_ARROWS
}

/** 获取折线上参数 t 属于 [0, 1] 位置的点和切线方向角。 */
export function getPointOnPolyline(
  points: Point[],
  t: number
): { x: number; y: number; angle: number } | null {
  if (points.length < 2) return null
  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const d = calculateDistance(points[i - 1], points[i])
    segLens.push(d)
    total += d
  }
  if (total <= 0) return { x: points[0].x, y: points[0].y, angle: 0 }

  let target = t * total
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const p0 = points[i]
      const p1 = points[i + 1]
      const segLen = segLens[i] || 1
      const localT = Math.min(1, target / segLen)
      const x = p0.x + (p1.x - p0.x) * localT
      const y = p0.y + (p1.y - p0.y) * localT
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x)
      return { x, y, angle }
    }
    target -= segLens[i]
  }
  const last = points.length - 1
  return {
    x: points[last].x,
    y: points[last].y,
    angle: Math.atan2(
      points[last].y - points[last - 1].y,
      points[last].x - points[last - 1].x
    )
  }
}

export function getArrowPositions(points: Point[]): Array<{ x: number; y: number; angle: number }> {
  const len = segmentPathLength(points)
  const count = getDirectionArrowCount(len)
  if (count <= 0) return []
  const result: Array<{ x: number; y: number; angle: number }> = []
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / (count + 1)
    const p = getPointOnPolyline(points, t)
    if (p) result.push(p)
  }
  return result
}

export interface GroupRouteRow {
  segment: Segment
  index: number
  meters: number
  pixelLength: number
  roleLabel: string
}

export interface SegmentGroupCompare {
  groupId: string
  actual: GroupRouteRow | null
  compares: GroupRouteRow[]
}

export function buildSegmentGroupCompare(
  segments: Segment[],
  groupId: string,
  scaleDenominator: number,
  canvas: A4CanvasSize,
  scaleEnabled: boolean
): SegmentGroupCompare | null {
  const inGroup = segments
    .map((seg, index) => ({ seg, index }))
    .filter(({ seg }) => seg.groupId === groupId)

  const actualEntry = inGroup.find(({ seg }) => seg.trackRole === 'actual')
  if (!actualEntry) return null

  const toMeters = (px: number) =>
    scaleEnabled ? pixelsToMeters(px, scaleDenominator, canvas) : px

  const actual: GroupRouteRow = {
    segment: actualEntry.seg,
    index: actualEntry.index,
    pixelLength: segmentPathLength(actualEntry.seg.points),
    meters: toMeters(segmentPathLength(actualEntry.seg.points)),
    roleLabel: '实际跑动'
  }

  const compares = inGroup
    .filter(({ seg }) => seg.trackRole === 'compare' && seg.parentActualId === actualEntry.seg.id)
    .map(({ seg, index }) => ({
      segment: seg,
      index,
      pixelLength: segmentPathLength(seg.points),
      meters: toMeters(segmentPathLength(seg.points)),
      roleLabel: seg.name
    }))

  return { groupId, actual, compares }
}

export function formatLength(
  meters: number,
  scaleEnabled: boolean
): { value: string; unit: string } {
  if (!scaleEnabled) return { value: meters.toFixed(1), unit: 'px' }
  if (meters >= 1000) return { value: (meters / 1000).toFixed(2), unit: 'km' }
  return { value: meters.toFixed(2), unit: 'm' }
}

export function getSegmentLabel(seg: Segment, index: number): string {
  if (seg.trackRole === 'compare') return seg.name || `对比${index + 1}`
  return seg.name || `实际${index + 1}`
}

export interface SegmentRouteRef {
  segment: Segment
  flatIndex: number
}

export interface SegmentGroupView {
  groupId: string
  groupIndex: number
  actual: SegmentRouteRef | null
  compares: SegmentRouteRef[]
  /** 实际路线已经结束绘制时，可以添加对比路线。 */
  canAddCompare: boolean
}

/** 分段到实际/对比路线的层级视图。 */
export function buildSegmentGroups(segments: Segment[]): SegmentGroupView[] {
  const groupIds = [...new Set(segments.map(s => s.groupId))]
  return groupIds.map((groupId, groupIndex) => {
    const inGroup = segments
      .map((seg, index) => ({ seg, index }))
      .filter(({ seg }) => seg.groupId === groupId)
    const actualEntry = inGroup.find(({ seg }) => seg.trackRole === 'actual')
    const compares = inGroup.filter(({ seg }) => seg.trackRole === 'compare')
    const actualSeg = actualEntry?.seg
    return {
      groupId,
      groupIndex,
      actual: actualEntry
        ? { segment: actualEntry.seg, flatIndex: actualEntry.index }
        : null,
      compares: compares.map(c => ({ segment: c.seg, flatIndex: c.index })),
      canAddCompare: !!(
        actualSeg &&
        actualSeg.finished &&
        actualSeg.points.length >= 2
      )
    }
  })
}
