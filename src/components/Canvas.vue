<template>
  <el-card class="canvas-card" shadow="hover">
    <div ref="canvasContainer" class="canvas-container">
      <canvas
        ref="canvas"
        :width="width"
        :height="height"
        class="canvas-main"
        :style="{
          aspectRatio: `${width} / ${height}`,
          width: canvasDisplaySize.width ? `${canvasDisplaySize.width}px` : '100%',
          height: canvasDisplaySize.height ? `${canvasDisplaySize.height}px` : 'auto'
        }"
        @click="handleCanvasClick"
        @contextmenu="handleCanvasRightClick"
        @mousedown="onMouseDown"
        @wheel="onWheel"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
      ></canvas>
      <div v-if="isLoading" class="loading-overlay">
        <el-icon><Loading /></el-icon>
        <p>图片加载中...</p>
      </div>
      <div v-if="errorMessage" class="error-overlay">
        <el-alert :title="errorMessage" type="error" show-icon :closable="false" />
      </div>
    </div>

    <!-- 右键标记菜单 -->
    <el-dropdown
      ref="markerDropdown"
      :visible="markerMenuVisible"
      @visible-change="onMarkerMenuVisibleChange"
      trigger="contextmenu"
      placement="bottom-start"
    >
      <span></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="markerType in markerTypes"
            :key="markerType.type"
            @click="selectMarkerType(markerType)"
          >
            <el-icon class="marker-menu-icon">
              <component :is="markerType.icon" />
            </el-icon>
            {{ markerType.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 标记内容输入对话框 -->
    <el-dialog
      v-model="markerDialogVisible"
      :title="`添加${getMarkerTypeText(markerForm.type)}标记`"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="markerForm" label-width="80px">
        <el-form-item label="图钉样式">
          <el-radio-group
            v-model="markerForm.type"
            class="marker-style-group"
            @change="onMarkerTypeChange"
          >
            <el-radio-button
              v-for="markerType in markerTypes"
              :key="markerType.type"
              :label="markerType.type"
            >
              <span class="marker-style-option">
                <el-icon>
                  <component :is="markerType.icon" />
                </el-icon>
                {{ markerType.label }}
              </span>
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="图钉颜色">
          <div class="marker-color-row">
            <el-color-picker
              :model-value="markerForm.color"
              size="small"
              @update:model-value="updateMarkerColor"
            />
            <span
              v-for="preset in markerColorPresets"
              :key="preset"
              class="marker-color-preset"
              :class="{ 'is-selected': markerForm.color.toLowerCase() === preset.toLowerCase() }"
              :style="{ background: preset }"
              @click="updateMarkerColor(preset)"
            ></span>
          </div>
        </el-form-item>
        <el-form-item label="标记内容">
          <el-input
            v-model="markerForm.content"
            type="textarea"
            :rows="3"
            placeholder="请输入标记内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="markerDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAddMarker">确定</el-button>
      </template>
    </el-dialog>

    <template #footer>
      <el-alert
        title="提示：拖动画布、双指缩放；绘制模式点击加点；参考物模式点击画布后选择图钉样式；每段显示 1→2 前进方向"
        type="info"
        show-icon
        :closable="false"
      />
    </template>
  </el-card>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, nextTick, onUnmounted, type Component } from 'vue'
import {
  Loading,
  LocationFilled,
  Memo,
  PictureFilled,
  WarningFilled,
  CircleCheckFilled,
  StarFilled,
  Flag,
  Aim
} from '@element-plus/icons-vue'
import type { Segment } from '../types'
import { getDirectionArrowCount, DEFAULT_ACTUAL_COLOR, DEFAULT_COMPARE_COLOR } from '../utils/segment'
import { formatDistance, getA4CanvasSize, segmentPixelLength } from '../utils/mapScale'

// 分段颜色数组，放在 setup 外部。
const segmentColors = [
  '#409EFF',
  '#67C23A',
  '#E6A23C',
  '#F56C6C',
  '#909399',
  '#1E90FF',
  '#9A60B4',
  '#F78989',
  '#13C2C2',
  '#FFB800'
]

type MarkerType =
  | 'landmark'
  | 'note'
  | 'photo'
  | 'warning'
  | 'checkpoint'
  | 'milestone'
  | 'flag'
  | 'target'

interface MarkerMenuItem {
  type: MarkerType
  label: string
  icon: Component
}

export default defineComponent({
  name: 'Canvas',
  components: {
    Loading
  },
  props: {
    segments: { type: Array, required: true },
    currentSegment: { type: Number, required: true },
    scale: { type: Number, required: true },
    scaleEnabled: { type: Boolean, default: false },
    pointSizeNuber: { type: Number, required: true },
    landmarkSizeNuber: { type: Number, required: true },
    LineWidthNuber: { type: Number, required: true },
    arrowSizeNuber: { type: Number, default: 1 },
    trackOpacity: { type: Number, default: 1 },
    markerOpacity: { type: Number, default: 0.7 },
    routeDistanceOpacity: { type: Number, default: 0.88 },
    drawing: { type: Boolean, required: true },
    landmarkMode: { type: Boolean, default: false },
    imageSrc: { type: [String, null], required: true },
    imageRotation: { type: Number, default: 0 },
    orientation: { type: String, required: true },
    drawMode: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  emits: ['add-point', 'add-marker'],
  setup(props, { emit }) {
    const canvas = ref<HTMLCanvasElement | null>(null)
    const canvasContainer = ref<HTMLElement | null>(null)
    const canvasDisplaySize = ref({ width: 0, height: 0 })
    const isLoading = ref(false)
    const errorMessage = ref('')
    const viewScale = ref(1)
    const offset = ref({ x: 0, y: 0 })
    const viewScaleMin = 0.25
    const viewScaleMax = 10
    let resizeObserver: ResizeObserver | null = null

    function clamp(n: number, min: number, max: number) {
      return Math.min(max, Math.max(min, n))
    }

    function updateCanvasDisplaySize() {
      const container = canvasContainer.value
      if (!container) return

      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      const aspectRatio = props.width / props.height
      let displayHeight = rect.height
      let displayWidth = displayHeight * aspectRatio

      if (displayWidth > rect.width) {
        displayWidth = rect.width
        displayHeight = displayWidth / aspectRatio
      }

      canvasDisplaySize.value = {
        width: Math.floor(displayWidth),
        height: Math.floor(displayHeight)
      }
      drawAll()
    }

    function getCanvasMetrics() {
      const el = canvas.value
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const scaleX = rect.width ? el.width / rect.width : 1
      const scaleY = rect.height ? el.height / rect.height : 1
      return { rect, scaleX, scaleY }
    }

    function clientToCanvasScreen(clientX: number, clientY: number) {
      const m = getCanvasMetrics()
      if (!m) return { x: 0, y: 0 }
      return {
        x: (clientX - m.rect.left) * m.scaleX,
        y: (clientY - m.rect.top) * m.scaleY
      }
    }

    function getImageContainRect(
      img: HTMLImageElement,
      targetW: number,
      targetH: number
    ): { dx: number; dy: number; dw: number; dh: number } {
      const rot = props.imageRotation || 0
      const swapped = rot === 90 || rot === 270
      const iw = swapped ? img.naturalHeight || img.height : img.naturalWidth || img.width
      const ih = swapped ? img.naturalWidth || img.width : img.naturalHeight || img.height
      if (!iw || !ih) return { dx: 0, dy: 0, dw: targetW, dh: targetH }
      const s = Math.min(targetW / iw, targetH / ih)
      const dw = iw * s
      const dh = ih * s
      return {
        dx: (targetW - dw) / 2,
        dy: (targetH - dh) / 2,
        dw,
        dh
      }
    }

    function drawRotatedImage(
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      dx: number,
      dy: number,
      dw: number,
      dh: number
    ) {
      const rot = props.imageRotation || 0
      if (rot === 0) {
        ctx.drawImage(img, dx, dy, dw, dh)
        return
      }
      const cx = dx + dw / 2
      const cy = dy + dh / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((rot * Math.PI) / 180)
      const swapped = rot === 90 || rot === 270
      const drawW = swapped ? dh : dw
      const drawH = swapped ? dw : dh
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()
    }

    let dragging = false
    let lastPos = { x: 0, y: 0 }
    let justDragged = false
    let dragTimeout: number | null = null
    let currentMarkerPosition = { x: 0, y: 0 }

    const markerDropdown = ref(null)
    const markerMenuVisible = ref(false)
    const markerDialogVisible = ref(false)
    const markerForm = ref<{ type: MarkerType | ''; content: string; color: string }>({
      type: '',
      content: '',
      color: '#e6a23c'
    })
    const lastMarkerType = ref<MarkerType>('landmark')
    const lastMarkerColor = ref('#e6a23c')
    const markerTypes: MarkerMenuItem[] = [
      { type: 'landmark', label: '参考物', icon: LocationFilled },
      { type: 'flag', label: '旗标', icon: Flag },
      { type: 'target', label: '目标点', icon: Aim },
      { type: 'note', label: '备注', icon: Memo },
      { type: 'photo', label: '照片', icon: PictureFilled },
      { type: 'warning', label: '警告', icon: WarningFilled },
      { type: 'checkpoint', label: '检查点', icon: CircleCheckFilled },
      { type: 'milestone', label: '里程碑', icon: StarFilled }
    ]
    const markerColorPresets = [
      '#e6a23c',
      '#409eff',
      '#67c23a',
      '#f56c6c',
      '#909399',
      '#00a870',
      '#7c3aed',
      '#d81e5b',
      '#303133'
    ]

    // 移动端触摸事件状态
    let touchStartTime = 0
    let touchTimer: number | null = null
    let isLongPress = false
    let pinchActive = false
    let pinchStartDistance = 0
    let pinchStartScale = 1
    let pinchAnchorLogical = { x: 0, y: 0 }

    function handleCanvasClick(e: MouseEvent) {
      if (justDragged) return
      const { x, y } = clientToCanvasScreen(e.clientX, e.clientY)
      const realX = (x - offset.value.x) / viewScale.value
      const realY = (y - offset.value.y) / viewScale.value

      if (props.landmarkMode) {
        currentMarkerPosition = { x: realX, y: realY }
        markerForm.value.type = lastMarkerType.value
        markerForm.value.content = ''
        markerForm.value.color = lastMarkerColor.value
        markerDialogVisible.value = true
        return
      }

      if (!props.drawing) return
      emit('add-point', { x: realX, y: realY })
    }

    function handleCanvasRightClick(e: MouseEvent) {
      e.preventDefault()
      const { x, y } = clientToCanvasScreen(e.clientX, e.clientY)
      const realX = (x - offset.value.x) / viewScale.value
      const realY = (y - offset.value.y) / viewScale.value

      currentMarkerPosition = { x: realX, y: realY }
      showMarkerMenu(e.clientX, e.clientY)
    }

    function getDefaultMarkerColor(type: string) {
      const colors = {
        landmark: '#e6a23c',
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399',
        flag: '#00a870',
        target: '#7c3aed'
      }
      return colors[type as keyof typeof colors] || '#409eff'
    }

    function normalizeColor(value: string | null | undefined) {
      const color = typeof value === 'string' ? value.trim() : ''
      return color || null
    }

    function updateMarkerColor(value: string | null | undefined) {
      const color = normalizeColor(value)
      if (!color) return
      markerForm.value.color = color
      lastMarkerColor.value = color
    }

    function showMarkerMenu(x: number, y: number) {
      markerForm.value.type = ''
      markerForm.value.content = ''
      markerForm.value.color = lastMarkerColor.value
      markerMenuVisible.value = true
    }

    function selectMarkerType(markerType: MarkerMenuItem) {
      markerForm.value.type = markerType.type
      lastMarkerType.value = markerType.type
      updateMarkerColor(getDefaultMarkerColor(markerType.type))
      markerMenuVisible.value = false
      markerDialogVisible.value = true
    }

    function onMarkerTypeChange(type: MarkerType) {
      updateMarkerColor(getDefaultMarkerColor(type))
    }

    function confirmAddMarker() {
      if (markerForm.value.type) {
        lastMarkerType.value = markerForm.value.type
        lastMarkerColor.value = markerForm.value.color
        emit('add-marker', {
          x: currentMarkerPosition.x,
          y: currentMarkerPosition.y,
          type: markerForm.value.type,
          color: markerForm.value.color,
          content: markerForm.value.content || ''
        })
        markerDialogVisible.value = false
      }
    }

    function getMarkerTypeColor(type: string) {
      const colors = {
        landmark: 'warning',
        note: 'info',
        photo: 'success',
        warning: 'danger',
        checkpoint: 'warning',
        milestone: 'primary',
        flag: 'success',
        target: 'primary'
      }
      return colors[type as keyof typeof colors] || 'info'
    }

    function getMarkerTypeText(type: string) {
      const texts = {
        landmark: '参考物',
        note: '备注',
        photo: '照片',
        warning: '警告',
        checkpoint: '检查点',
        milestone: '里程碑',
        flag: '旗标',
        target: '目标点'
      }
      return texts[type as keyof typeof texts] || '标记'
    }

    function draw() {
      const ctx = canvas.value?.getContext('2d')
      if (!ctx) return

      // 每次重绘前先清空，避免坐标变换影响 clearRect。
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, props.width, props.height)
      ctx.setTransform(viewScale.value, 0, 0, viewScale.value, offset.value.x, offset.value.y)
      if (props.imageSrc) {
        const img = new window.Image()
        img.src = props.imageSrc as string
        isLoading.value = true
        errorMessage.value = ''
        img.onload = () => {
          const { dx, dy, dw, dh } = getImageContainRect(img, props.width, props.height)
          drawRotatedImage(ctx, img, dx, dy, dw, dh)
          drawPointsAndLines(ctx)
          isLoading.value = false
        }
        img.onerror = () => {
          errorMessage.value = '图片加载失败'
          isLoading.value = false
        }
        if (img.complete) {
          const { dx, dy, dw, dh } = getImageContainRect(img, props.width, props.height)
          drawRotatedImage(ctx, img, dx, dy, dw, dh)
          drawPointsAndLines(ctx)
          isLoading.value = false
        }
      } else {
        drawPointsAndLines(ctx)
      }
    }

    function getSegmentColor(segment: Segment, segIdx: number) {
      return (
        segment.color ||
        (segment.trackRole === 'compare' ? DEFAULT_COMPARE_COLOR : DEFAULT_ACTUAL_COLOR) ||
        segmentColors[segIdx % segmentColors.length]
      )
    }

    function pointDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.hypot(b.x - a.x, b.y - a.y)
    }

    function cubicBezierPoint(
      p0: { x: number; y: number },
      cp1: { x: number; y: number },
      cp2: { x: number; y: number },
      p1: { x: number; y: number },
      t: number
    ) {
      const mt = 1 - t
      return {
        x:
          mt * mt * mt * p0.x +
          3 * mt * mt * t * cp1.x +
          3 * mt * t * t * cp2.x +
          t * t * t * p1.x,
        y:
          mt * mt * mt * p0.y +
          3 * mt * mt * t * cp1.y +
          3 * mt * t * t * cp2.y +
          t * t * t * p1.y
      }
    }

    function buildRenderedPathPoints(seg: Array<{ x: number; y: number; type?: 'line' | 'curve' }>) {
      if (seg.length < 2) return [...seg]

      const path: Array<{ x: number; y: number }> = [{ x: seg[0].x, y: seg[0].y }]
      const appendPoint = (point: { x: number; y: number }) => {
        const last = path[path.length - 1]
        if (!last || pointDistance(last, point) > 0.01) path.push({ x: point.x, y: point.y })
      }

      let i = 1
      while (i < seg.length) {
        if (seg[i].type === 'curve') {
          let j = i
          while (j < seg.length && seg[j].type === 'curve') j++
          const curvePoints = [seg[i - 1], ...seg.slice(i, j)]

          if (curvePoints.length >= 3) {
            for (let k = 0; k < curvePoints.length - 1; k++) {
              const p0 = curvePoints[k - 1] || curvePoints[k]
              const p1 = curvePoints[k]
              const p2 = curvePoints[k + 1]
              const p3 = curvePoints[k + 2] || p2
              const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
              const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
              for (let step = 1; step <= 16; step++) {
                appendPoint(cubicBezierPoint(p1, cp1, cp2, p2, step / 16))
              }
            }
          } else {
            appendPoint(curvePoints[curvePoints.length - 1])
          }
          i = j
        } else {
          appendPoint(seg[i])
          i++
        }
      }

      return path
    }

    function getPointOnRenderedPath(
      path: Array<{ x: number; y: number }>,
      t: number
    ): { x: number; y: number; angle: number } | null {
      if (path.length < 2) return null
      const lengths: number[] = []
      let total = 0
      for (let i = 1; i < path.length; i++) {
        const len = pointDistance(path[i - 1], path[i])
        lengths.push(len)
        total += len
      }
      if (total <= 0) return null

      let target = total * t
      for (let i = 0; i < lengths.length; i++) {
        if (target <= lengths[i] || i === lengths.length - 1) {
          const p0 = path[i]
          const p1 = path[i + 1]
          const localT = Math.min(1, target / (lengths[i] || 1))
          return {
            x: p0.x + (p1.x - p0.x) * localT,
            y: p0.y + (p1.y - p0.y) * localT,
            angle: Math.atan2(p1.y - p0.y, p1.x - p0.x)
          }
        }
        target -= lengths[i]
      }
      return null
    }

    function getArrowPositionsForSegment(seg: Array<{ x: number; y: number; type?: 'line' | 'curve' }>) {
      const path = buildRenderedPathPoints(seg)
      let length = 0
      for (let i = 1; i < path.length; i++) length += pointDistance(path[i - 1], path[i])
      const count = getDirectionArrowCount(length)
      const result: Array<{ x: number; y: number; angle: number }> = []
      for (let i = 0; i < count; i++) {
        const point = getPointOnRenderedPath(path, (i + 1) / (count + 1))
        if (point) result.push(point)
      }
      return result
    }

    function drawPointsAndLines(
      ctx: CanvasRenderingContext2D,
      segmentsToDraw: Segment[] = props.segments as Segment[]
    ) {
      segmentsToDraw.forEach((segment, segIdx) => {
        ctx.save()
        const color = getSegmentColor(segment, segIdx)
        ctx.strokeStyle = color
        ctx.lineWidth = props.LineWidthNuber / viewScale.value
        ctx.globalAlpha = props.trackOpacity
        const seg = segment.points
        let i = 1
        while (i < seg.length) {
          if (seg[i].type === 'curve') {
            let j = i
            while (j < seg.length && seg[j].type === 'curve') j++
            const curvePoints = [seg[i - 1], ...seg.slice(i, j)]
            if (curvePoints.length >= 3) {
              drawCatmullRom(ctx, curvePoints)
            } else if (curvePoints.length === 2) {              ctx.beginPath()
              ctx.moveTo(curvePoints[0].x, curvePoints[0].y)
              ctx.lineTo(curvePoints[1].x, curvePoints[1].y)
              ctx.stroke()
            }
            i = j
          } else {
            ctx.beginPath()
            ctx.moveTo(seg[i - 1].x, seg[i - 1].y)
            ctx.lineTo(seg[i].x, seg[i].y)
            ctx.stroke()
            i++
          }
        }
        if (seg.length >= 2) {
          if (segment.finished) {
            drawArrowsAlongPath(ctx, seg, color)
          } else {
            drawSegmentDirectionArrow(ctx, seg, color)
          }
          ctx.globalAlpha = 1
          drawRouteDistanceLabel(ctx, segment, color)
        }

        if (!segment.finished) {
          seg.forEach(p => {
            ctx.save()
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            ctx.beginPath()
            ctx.arc(
              p.x * viewScale.value + offset.value.x,
              p.y * viewScale.value + offset.value.y,
              props.pointSizeNuber,
              0,
              2 * Math.PI
            )
            ctx.fillStyle = color
            ctx.globalAlpha = props.trackOpacity
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.restore()
          })
        }
        ctx.globalAlpha = 1
        if (segment.markers) {
          segment.markers.forEach(marker => {
            drawMarker(ctx, marker)
          })
        }
        ctx.restore()
      })
    }
    function drawSingleSegmentForExport(
      ctx: CanvasRenderingContext2D,
      segment: Segment,
      segIdx: number
    ) {
      const seg = segment.points || []
      if (seg.length > 0) {
        ctx.save()
        const color = getSegmentColor(segment, segIdx)
        ctx.strokeStyle = color
        ctx.lineWidth = props.LineWidthNuber
        ctx.globalAlpha = props.trackOpacity
        let i = 1
        while (i < seg.length) {
          if (seg[i].type === 'curve') {
            let j = i
            while (j < seg.length && seg[j].type === 'curve') j++
            const curvePoints = [seg[i - 1], ...seg.slice(i, j)]
            if (curvePoints.length >= 3) {
              drawCatmullRomForExport(ctx, curvePoints)
            } else if (curvePoints.length === 2) {
              ctx.beginPath()
              ctx.moveTo(curvePoints[0].x, curvePoints[0].y)
              ctx.lineTo(curvePoints[1].x, curvePoints[1].y)
              ctx.stroke()
            }
            i = j
          } else {
            ctx.beginPath()
            ctx.moveTo(seg[i - 1].x, seg[i - 1].y)
            ctx.lineTo(seg[i].x, seg[i].y)
            ctx.stroke()
            i++
          }
        }
        if (seg.length >= 2) {
          if (segment.finished) {
            drawArrowsAlongPath(ctx, seg, color, 1)
          } else {
            drawSegmentDirectionArrow(ctx, seg, color, 1)
          }
          ctx.globalAlpha = 1
          drawRouteDistanceLabelForExport(ctx, segment, color)
        }
        ctx.restore()
      }

      if (segment.markers?.length) {
        segment.markers.forEach(marker => {
          drawMarkerForExport(ctx, marker)
        })
      }
    }

    function drawCatmullRomForExport(
      ctx: CanvasRenderingContext2D,
      points: Array<{ x: number; y: number }>
    ) {
      ctx.save()
      ctx.lineWidth = props.LineWidthNuber
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2] || p2
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
      }
      ctx.stroke()
      ctx.restore()
    }

    function drawMarkerForExport(
      ctx: CanvasRenderingContext2D,
      marker: { x: number; y: number; type: string; content: string; color?: string }
    ) {
      const colors = {
        landmark: '#e6a23c',
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399',
        flag: '#00a870',
        target: '#7c3aed'
      }
      const color = marker.color || colors[marker.type as keyof typeof colors] || '#409eff'
      ctx.save()
      drawMarkerShapeAt(ctx, marker.x, marker.y, marker.type, color, props.landmarkSizeNuber)
      ctx.restore()
    }

    function getSegmentsCaptureRect(segments: Segment[]) {
      const xs: number[] = []
      const ys: number[] = []

      segments.forEach(segment => {
        segment.points.forEach(point => {
          xs.push(point.x)
          ys.push(point.y)
        })
        segment.markers?.forEach(marker => {
          xs.push(marker.x)
          ys.push(marker.y)
        })
      })

      if (!xs.length || !ys.length) {
        return { x: 0, y: 0, width: props.width, height: props.height }
      }

      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const contentWidth = Math.max(1, maxX - minX)
      const contentHeight = Math.max(1, maxY - minY)
      const padding = Math.max(80, Math.min(props.width, props.height) * 0.08)
      const width = Math.min(props.width, Math.max(contentWidth + padding * 2, 260))
      const height = Math.min(props.height, Math.max(contentHeight + padding * 2, 220))
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const x = clamp(centerX - width / 2, 0, props.width - width)
      const y = clamp(centerY - height / 2, 0, props.height - height)

      return { x, y, width, height }
    }

    function getSegmentCaptureRect(segment: Segment) {
      return getSegmentsCaptureRect([segment])
    }

    async function drawExportBaseMap(ctx: CanvasRenderingContext2D) {
      if (!props.imageSrc) return
      const img = new window.Image()
      img.src = props.imageSrc as string
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
      }).catch(() => undefined)
      if (img.complete) {
        const { dx, dy, dw, dh } = getImageContainRect(img, props.width, props.height)
        drawRotatedImage(ctx, img, dx, dy, dw, dh)
      }
    }

    async function captureSegmentImage(segmentIndex: number): Promise<string | null> {
      const segment = (props.segments as Segment[])[segmentIndex]
      if (!segment) return null

      const crop = getSegmentCaptureRect(segment)
      const offscreen = document.createElement('canvas')
      offscreen.width = Math.ceil(crop.width)
      offscreen.height = Math.ceil(crop.height)
      const ctx = offscreen.getContext('2d')
      if (!ctx) return null

      ctx.clearRect(0, 0, offscreen.width, offscreen.height)
      ctx.save()
      ctx.translate(-crop.x, -crop.y)

      await drawExportBaseMap(ctx)
      drawSingleSegmentForExport(ctx, segment, segmentIndex)
      ctx.restore()
      return offscreen.toDataURL('image/png')
    }

    async function captureSegmentGroupImage(groupId: string): Promise<string | null> {
      const segments = (props.segments as Segment[]).filter(segment => segment.groupId === groupId)
      if (!segments.length) return null

      const crop = getSegmentsCaptureRect(segments)
      const offscreen = document.createElement('canvas')
      offscreen.width = Math.ceil(crop.width)
      offscreen.height = Math.ceil(crop.height)
      const ctx = offscreen.getContext('2d')
      if (!ctx) return null

      ctx.clearRect(0, 0, offscreen.width, offscreen.height)
      ctx.save()
      ctx.translate(-crop.x, -crop.y)
      await drawExportBaseMap(ctx)
      segments.forEach(segment => {
        const index = (props.segments as Segment[]).findIndex(item => item.id === segment.id)
        drawSingleSegmentForExport(ctx, segment, index)
      })
      ctx.restore()
      return offscreen.toDataURL('image/png')
    }

    function drawArrowAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      color: string,
      scale = 1 / viewScale.value
    ) {
      const sz = props.arrowSizeNuber || 1
      const len = 10 * scale * sz
      const halfW = 5 * scale * sz
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      const px = -uy
      const py = ux
      const tipX = x + ux * len * 0.5
      const tipY = y + uy * len * 0.5
      const baseX = x - ux * len * 0.5
      const baseY = y - uy * len * 0.5

      ctx.save()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(tipX, tipY)
      ctx.lineTo(baseX + px * halfW, baseY + py * halfW)
      ctx.lineTo(baseX - px * halfW, baseY - py * halfW)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }    function drawSegmentDirectionArrow(
      ctx: CanvasRenderingContext2D,
      seg: Array<{ x: number; y: number }>,
      color: string,
      scale = 1 / viewScale.value
    ) {
      const p0 = seg[0]
      const p1 = seg[1]
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const len = Math.hypot(dx, dy)
      if (len < 2) return
      const angle = Math.atan2(dy, dx)
      const t = getArrowPositionsForSegment(seg)[0] || { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, angle }
      drawArrowAt(ctx, t.x, t.y, t.angle ?? angle, color, scale)
    }    function drawArrowsAlongPath(
      ctx: CanvasRenderingContext2D,
      seg: Array<{ x: number; y: number }>,
      color: string,
      scale = 1 / viewScale.value
    ) {
      getArrowPositionsForSegment(seg).forEach(pos => drawArrowAt(ctx, pos.x, pos.y, pos.angle, color, scale))
    }    function getRouteDistanceText(segment: Segment): string {
      const canvasSize = getA4CanvasSize(props.orientation as 'landscape' | 'portrait')
      const formatted = formatDistance(
        segmentPixelLength(segment.points),
        props.scaleEnabled,
        props.scale,
        canvasSize
      )
      return `${formatted.value} ${formatted.unit}`
    }

    function getRouteLabelPoint(points: Array<{ x: number; y: number }>) {
      if (points.length < 2) return null
      return getPointOnRenderedPath(buildRenderedPathPoints(points), 0.5)
    }

    function drawDistancePill(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      text: string,
      color: string,
      scale = 1
    ) {
      const fontSize = 12 * scale
      const padX = 7 * scale
      const padY = 4 * scale
      const gap = 12 * scale
      ctx.save()
      ctx.font = `600 ${fontSize}px "Microsoft YaHei", Arial`
      const width = ctx.measureText(text).width + padX * 2
      const height = fontSize + padY * 2
      const bx = x - width / 2
      const by = y - gap - height
      ctx.globalAlpha = props.routeDistanceOpacity
      ctx.fillStyle = color
      roundRect(ctx, bx, by, width, height, 4 * scale)
      ctx.fill()
      ctx.globalAlpha = Math.min(1, props.routeDistanceOpacity + 0.12)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1, scale)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x, by + height / 2)
      ctx.restore()
    }

    function drawRouteDistanceLabel(
      ctx: CanvasRenderingContext2D,
      segment: Segment,
      color: string
    ) {
      const point = getRouteLabelPoint(segment.points)
      if (!point) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      drawDistancePill(
        ctx,
        point.x * viewScale.value + offset.value.x,
        point.y * viewScale.value + offset.value.y,
        getRouteDistanceText(segment),
        color
      )
      ctx.restore()
    }

    function drawRouteDistanceLabelForExport(
      ctx: CanvasRenderingContext2D,
      segment: Segment,
      color: string
    ) {
      const point = getRouteLabelPoint(segment.points)
      if (!point) return
      drawDistancePill(ctx, point.x, point.y, getRouteDistanceText(segment), color, 1.15)
    }

    function drawCatmullRom(ctx, points) {
      ctx.save()
      ctx.lineWidth = props.LineWidthNuber / viewScale.value
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2] || p2
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
      }
      ctx.stroke()
      ctx.restore()
    }
    function drawMarker(
      ctx: CanvasRenderingContext2D,
      marker: { x: number; y: number; type: string; content: string; color?: string }
    ) {
      const colors = {
        landmark: '#e6a23c',
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399',
        flag: '#00a870',
        target: '#7c3aed'
      }
      const color = marker.color || colors[marker.type as keyof typeof colors] || '#409eff'
      const sx = marker.x * viewScale.value + offset.value.x
      const sy = marker.y * viewScale.value + offset.value.y

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      const pinTopY = drawMarkerShapeAt(
        ctx,
        sx,
        sy,
        marker.type,
        color,
        props.landmarkSizeNuber
      )

      if (marker.content) {
        drawMarkerLabel(ctx, sx, pinTopY, marker.content, color)
      }
      ctx.restore()
    }

    function drawMarkerLabel(
      ctx: CanvasRenderingContext2D,
      cx: number,
      bottomY: number,
      text: string,
      color: string
    ) {
      const opacity = props.markerOpacity
      const fontSize = 12
      const padX = 6
      const padY = 4
      const gap = 6
      ctx.save()
      ctx.font = `${fontSize}px Arial`
      const metrics = ctx.measureText(text)
      const w = metrics.width + padX * 2
      const h = fontSize + padY * 2
      const x = cx - w / 2
      const y = bottomY - gap - h
      ctx.globalAlpha = opacity
      ctx.fillStyle = color
      roundRect(ctx, x, y, w, h, 4)
      ctx.fill()
      ctx.globalAlpha = Math.min(1, opacity + 0.2)
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, cx, y + h / 2)
      ctx.restore()
    }

    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    function getMarkerVisualSize(size: number) {
      return clamp(size, 12, 96)
    }

    function drawMarkerShapeAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      type: string,
      color: string,
      size: number
    ) {
      if (type === 'flag') {
        return drawFlagMarkerAt(ctx, x, y, color, size)
      }
      if (type === 'target') {
        return drawTargetMarkerAt(ctx, x, y, color, size)
      }
      if (type === 'landmark') {
        return drawPinAt(ctx, x, y, color, size)
      }

      const radius = Math.max(props.pointSizeNuber + 3, getMarkerVisualSize(size) * 0.34)
      ctx.save()
      ctx.globalAlpha = props.markerOpacity
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.shadowColor = 'rgba(0, 0, 0, 0.22)'
      ctx.shadowBlur = 5
      ctx.shadowOffsetY = 2
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      const icons = {
        note: 'i',
        photo: 'P',
        warning: '!',
        checkpoint: '✓',
        milestone: '★'
      }
      const icon = icons[type as keyof typeof icons] || 'i'
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${Math.max(12, radius * 0.9)}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(icon, x, y + 0.5)
      ctx.restore()

      return y - radius
    }

    function drawPinAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      size: number
    ) {
      const markerSize = getMarkerVisualSize(size)
      const r = markerSize * 0.38
      const centerY = y - r * 1.45
      ctx.save()
      ctx.globalAlpha = props.markerOpacity
      ctx.fillStyle = color
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(0, 0, 0, 0.24)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetY = 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(
        x - r * 0.95,
        y - r * 0.75,
        x - r * 1.05,
        centerY + r * 0.32,
        x - r * 0.92,
        centerY
      )
      ctx.bezierCurveTo(x - r * 0.92, centerY - r * 0.72, x - r * 0.45, centerY - r, x, centerY - r)
      ctx.bezierCurveTo(x + r * 0.45, centerY - r, x + r * 0.92, centerY - r * 0.72, x + r * 0.92, centerY)
      ctx.bezierCurveTo(x + r * 1.05, centerY + r * 0.32, x + r * 0.95, y - r * 0.75, x, y)
      ctx.closePath()
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, centerY, r * 0.36, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()
      return centerY - r
    }

    function drawFlagMarkerAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      size: number
    ) {
      const markerSize = getMarkerVisualSize(size)
      const poleHeight = markerSize * 1.25
      const flagW = markerSize * 0.8
      const flagH = markerSize * 0.45
      const topY = y - poleHeight
      ctx.save()
      ctx.globalAlpha = props.markerOpacity
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, topY)
      ctx.stroke()
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, topY)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x, topY)
      ctx.lineTo(x + flagW, topY + flagH * 0.18)
      ctx.lineTo(x, topY + flagH)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 2
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.restore()
      return topY
    }

    function drawTargetMarkerAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      size: number
    ) {
      const markerSize = getMarkerVisualSize(size)
      const radius = markerSize * 0.38
      ctx.save()
      ctx.globalAlpha = props.markerOpacity
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
      ctx.shadowBlur = 5
      ctx.shadowOffsetY = 2
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.52, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - radius * 1.25, y)
      ctx.lineTo(x - radius * 0.72, y)
      ctx.moveTo(x + radius * 0.72, y)
      ctx.lineTo(x + radius * 1.25, y)
      ctx.moveTo(x, y - radius * 1.25)
      ctx.lineTo(x, y - radius * 0.72)
      ctx.moveTo(x, y + radius * 0.72)
      ctx.lineTo(x, y + radius * 1.25)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.restore()
      return y - radius * 1.25
    }

    function drawAll() {
      requestAnimationFrame(draw)
    }
    function onMouseDown(e: MouseEvent) {
      dragging = true
      justDragged = false
      pinchActive = false
      lastPos = clientToCanvasScreen(e.clientX, e.clientY)
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return
      justDragged = true
      const p = clientToCanvasScreen(e.clientX, e.clientY)
      offset.value.x += p.x - lastPos.x
      offset.value.y += p.y - lastPos.y
      lastPos = p
      drawAll()
    }

    function onMouseUp(e: MouseEvent) {
      dragging = false
      if (dragTimeout) clearTimeout(dragTimeout)
      dragTimeout = window.setTimeout(() => {
        justDragged = false
      }, 100)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()

      const scaleDelta = e.deltaY < 0 ? 1.1 : 0.9
      const { x: cursorScreenX, y: cursorScreenY } = clientToCanvasScreen(e.clientX, e.clientY)
      const logicalX = (cursorScreenX - offset.value.x) / viewScale.value
      const logicalY = (cursorScreenY - offset.value.y) / viewScale.value

      const nextScale = clamp(viewScale.value * scaleDelta, viewScaleMin, viewScaleMax)
      offset.value.x = cursorScreenX - logicalX * nextScale
      offset.value.y = cursorScreenY - logicalY * nextScale
      viewScale.value = nextScale
      if (dragTimeout) clearTimeout(dragTimeout)
      drawAll()
    }
    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      touchStartTime = Date.now()
      isLongPress = false
      pinchActive = false

      if (e.touches.length === 1) {
        if (props.drawing) {
          touchTimer = window.setTimeout(() => {
            isLongPress = true
            const touch = e.touches[0]
            const { x, y } = clientToCanvasScreen(touch.clientX, touch.clientY)
            const realX = (x - offset.value.x) / viewScale.value
            const realY = (y - offset.value.y) / viewScale.value
            currentMarkerPosition = { x: realX, y: realY }
            showMarkerMenu(touch.clientX, touch.clientY)
          }, 500)
        }

        dragging = true
        const touch = e.touches[0]
        justDragged = false
        lastPos = clientToCanvasScreen(touch.clientX, touch.clientY)
      }

      if (e.touches.length === 2) {
        dragging = false
        justDragged = true
        isLongPress = false
        if (touchTimer) clearTimeout(touchTimer)
        touchTimer = null

        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const p1 = clientToCanvasScreen(t1.clientX, t1.clientY)
        const p2 = clientToCanvasScreen(t2.clientX, t2.clientY)
        pinchStartDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y)
        pinchStartScale = viewScale.value

        const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        pinchAnchorLogical = {
          x: (center.x - offset.value.x) / viewScale.value,
          y: (center.y - offset.value.y) / viewScale.value
        }
        pinchActive = true
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (e.touches.length === 2) {
        if (!pinchActive) return
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const p1 = clientToCanvasScreen(t1.clientX, t1.clientY)
        const p2 = clientToCanvasScreen(t2.clientX, t2.clientY)
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
        if (!pinchStartDistance) return

        const nextScale = clamp(
          pinchStartScale * (dist / pinchStartDistance),
          viewScaleMin,
          viewScaleMax
        )
        const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
        offset.value.x = center.x - pinchAnchorLogical.x * nextScale
        offset.value.y = center.y - pinchAnchorLogical.y * nextScale
        viewScale.value = nextScale
        drawAll()
        return
      }

      if (!dragging || e.touches.length !== 1) return
      const touch = e.touches[0]
      const p = clientToCanvasScreen(touch.clientX, touch.clientY)
      const moveDistance = Math.hypot(p.x - lastPos.x, p.y - lastPos.y)
      if (moveDistance > 10 && touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
        isLongPress = false
      }
      justDragged = true
      offset.value.x += p.x - lastPos.x
      offset.value.y += p.y - lastPos.y
      lastPos = p
      drawAll()
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault()
      const wasPinching = pinchActive
      pinchActive = false

      if (touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
      }

      if (!wasPinching && !isLongPress && !justDragged && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0]
        const { x, y } = clientToCanvasScreen(touch.clientX, touch.clientY)
        const realX = (x - offset.value.x) / viewScale.value
        const realY = (y - offset.value.y) / viewScale.value
        if (props.landmarkMode) {
          currentMarkerPosition = { x: realX, y: realY }
          markerForm.value.type = lastMarkerType.value
          markerForm.value.content = ''
          markerForm.value.color = lastMarkerColor.value
          markerDialogVisible.value = true
        } else if (props.drawing) {
          emit('add-point', { x: realX, y: realY })
        }
      }

      dragging = false
      isLongPress = false
      if (dragTimeout) clearTimeout(dragTimeout)
      dragTimeout = window.setTimeout(() => {
        justDragged = false
      }, 100)
    }

    function onMarkerMenuVisibleChange(visible: boolean) {
      markerMenuVisible.value = visible
    }

    watch(
      () => props.width,
      () => nextTick(updateCanvasDisplaySize)
    )
    watch(
      () => props.height,
      () => nextTick(updateCanvasDisplaySize)
    )
    watch(
      () => props.segments,
      () => nextTick(drawAll),
      { deep: true }
    )
    watch(
      () => props.scale,
      () => nextTick(drawAll)
    )
    watch(
      () => props.imageSrc,
      () => nextTick(drawAll)
    )
    watch(
      () => props.imageRotation,
      () => nextTick(drawAll)
    )
    watch(viewScale, () => nextTick(drawAll))
    watch(offset, () => nextTick(drawAll))

    onMounted(() => {
      nextTick(updateCanvasDisplaySize)

      if (canvasContainer.value) {
        resizeObserver = new ResizeObserver(() => {
          updateCanvasDisplaySize()
        })
        resizeObserver.observe(canvasContainer.value)
      }      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    onUnmounted(() => {      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      resizeObserver?.disconnect()
      resizeObserver = null
    })

    return {
      canvas,
      canvasContainer,
      canvasDisplaySize,
      isLoading,
      errorMessage,
      handleCanvasClick,
      handleCanvasRightClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      markerDropdown,
      markerMenuVisible,
      markerDialogVisible,
      markerForm,
      markerTypes,
      markerColorPresets,
      showMarkerMenu,
      selectMarkerType,
      onMarkerTypeChange,
      updateMarkerColor,
      confirmAddMarker,
      onMarkerMenuVisibleChange,
      getMarkerTypeColor,
      getMarkerTypeText,
      captureSegmentImage,
      captureSegmentGroupImage
    }
  }
})
</script>

<style scoped lang="scss">
.canvas-card {
  margin: 0 auto;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(64, 158, 255, 0.1);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    padding: 12px;
  }
  .el-card__footer {
    padding: 8px 16px 0 16px;
    background: transparent;
    border-top: none;
  }
}
.canvas-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  position: relative;
  background:
    linear-gradient(rgba(64, 158, 255, 0.04), rgba(64, 158, 255, 0.04)),
    #f6f8fa;
  border-radius: 14px;
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.canvas-main {
  display: block;
  background: #fff;
  border: 1px solid rgba(64, 158, 255, 0.45);
  border-radius: 12px;
  box-shadow:
    0 0 0 4px rgba(64, 158, 255, 0.08),
    0 8px 24px rgba(64, 158, 255, 0.16);
  max-width: 100%;
  max-height: 100%;
  margin: 0 auto;
  touch-action: none;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  &:hover {
    border-color: #409eff;
    box-shadow:
      0 0 0 5px rgba(64, 158, 255, 0.12),
      0 12px 32px rgba(64, 158, 255, 0.22);
  }
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 2;
  border-radius: 12px;
  p {
    margin-top: 10px;
    color: #409eff;
    font-size: 16px;
  }
}

.marker-menu-icon {
  margin-right: 8px;
  vertical-align: -2px;
}

.marker-style-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.el-radio-button__inner) {
    border-left: 1px solid var(--el-border-color) !important;
    border-radius: 6px !important;
    padding: 7px 10px;
  }
}

.marker-style-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.marker-color-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.marker-color-preset {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #dcdfe6;
  cursor: pointer;

  &.is-selected {
    box-shadow:
      0 0 0 2px #303133,
      0 0 0 4px #fff;
  }
}
</style>
