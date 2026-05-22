// This file defines the types and interfaces used in the project for TypeScript type checking.

export type CanvasSize = 'A4' | 'A5'

export interface Point {
  x: number
  y: number
  type?: 'line' | 'curve'
  description?: string // 点位备注
  timestamp?: Date
}

export interface DistanceData {
  pointA: Point
  pointB: Point
  distance: number
}

// 特殊标记类型
export interface Marker {
  id: string
  x: number
  y: number
  type: 'landmark' | 'note' | 'photo' | 'warning' | 'checkpoint' | 'milestone'
  content: string
  timestamp: Date
  color?: string
}

/** 实际跑动轨迹 | 对比路线 */
export type SegmentTrackRole = 'actual' | 'compare'

// 分段日记类型
export interface Segment {
  id: string
  name: string
  points: Point[]
  markers: Marker[]
  description: string // 线段整体描述
  createdAt: Date
  updatedAt: Date
  distance?: number
  duration?: number
  image?: string // 分段截图
  /** 同组：一条实际路线 + 若干对比路线 */
  groupId: string
  trackRole: SegmentTrackRole
  /** 对比路线所对应的实际分段 id */
  parentActualId?: string
  /** 轨迹线颜色 */
  color: string
  /** 结束后仅显示轨迹线，隐藏点位 */
  finished: boolean
}

// 项目配置类型
export interface ProjectConfig {
  title: string
  author: string
  date: Date
  scale: number
  orientation: 'portrait' | 'landscape'
  imageSrc?: string
}

// 导出PDF配置
export interface PDFConfig {
  includeMap: boolean
  includePoints: boolean
  includeMarkers: boolean
  includeDescriptions: boolean
  pageSize: 'A4' | 'A5' | 'letter'
  orientation: 'portrait' | 'landscape'
}
