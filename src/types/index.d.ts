// 项目类型定义

export type CanvasSize = 'A4' | 'A5'

export interface Point {
  x: number
  y: number
  type?: 'line' | 'curve'
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
  type:
    | 'landmark'
    | 'note'
    | 'photo'
    | 'warning'
    | 'checkpoint'
    | 'milestone'
    | 'flag'
    | 'target'
  content: string
  timestamp: Date
  color?: string
}

/** 实际跑动轨迹 | 对比路线 */
export type SegmentTrackRole = 'actual' | 'compare'

// 分段记录类型
export interface Segment {
  id: string
  name: string
  points: Point[]
  markers: Marker[]
  description: string // 分段整体描述
  createdAt: Date
  updatedAt: Date
  distance?: number
  duration?: number
  image?: string // 分段截图
  groupImage?: string // 同组实际/对比路线截图
  /** 同组：一条实际路线 + 若干对比路线 */
  groupId: string
  trackRole: SegmentTrackRole
  /** 对比路线对应的实际分段 id */
  parentActualId?: string
  /** 轨迹线颜色 */
  color: string
  /** 结束后仅显示轨迹线，隐藏控制点 */
  finished: boolean
}

// 项目配置类型
export interface ProjectConfig {
  title: string
  author: string
  date: Date
  scale: number
  scaleEnabled?: boolean
  orientation: 'portrait' | 'landscape'
  imageSrc?: string
}

// 导出 PDF 配置
export interface PDFConfig {
  includeMap: boolean
  includeMarkers: boolean
  includeDescriptions: boolean
  pageSize: 'A4' | 'A5' | 'letter'
  orientation: 'portrait' | 'landscape'
}
