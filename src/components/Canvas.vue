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

    <!-- 右键菜单 -->
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
            <span style="margin-right: 8px">{{ markerType.icon }}</span>
            {{ markerType.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 标记内容输入对话框 -->
    <el-dialog
      v-model="markerDialogVisible"
      :title="markerForm.type === 'landmark' ? '添加参照物标记' : '添加标记'"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form :model="markerForm" label-width="80px">
        <el-form-item label="标记类型">
          <el-tag :type="getMarkerTypeColor(markerForm.type)" size="large">
            {{ getMarkerTypeText(markerForm.type) }}
          </el-tag>
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
        title="提示：拖动画布、双指缩放；绘制模式点击加点；参照物模式点击画布添加图钉标记；每段显示 1→2 前进方向"
        type="info"
        show-icon
        :closable="false"
      />
    </template>
  </el-card>
</template>

<script lang="ts">
import { defineComponent, ref, watch, onMounted, nextTick, onUnmounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { Segment } from '../types'
import { getArrowPositions, DEFAULT_ACTUAL_COLOR, DEFAULT_COMPARE_COLOR } from '../utils/segment'

// 分段颜色数组，放在setup外部
const segmentColors = [
  '#409EFF', // 蓝
  '#67C23A', // 绿
  '#E6A23C', // 橙
  '#F56C6C', // 红
  '#909399', // 灰
  '#1E90FF', // 深蓝
  '#9A60B4', // 紫
  '#F78989', // 粉
  '#13C2C2', // 青
  '#FFB800' // 黄
]

export default defineComponent({
  name: 'Canvas',
  components: {
    Loading
  },
  props: {
    segments: { type: Array, required: true },
    currentSegment: { type: Number, required: true },
    scale: { type: Number, required: true },
    pointSizeNuber: { type: Number, required: true },
    landmarkSizeNuber: { type: Number, required: true },
    LineWidthNuber: { type: Number, required: true },
    arrowSizeNuber: { type: Number, default: 1 },
    markerOpacity: { type: Number, default: 0.7 },
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
    const offset = ref({ x: 0, y: 0 }) // 以“canvas内部坐标(屏幕像素等价)”为单位的平移
    const viewScaleMin = 0.2
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

    // 将浏览器 clientX/clientY 转成“canvas内部像素体系下的屏幕坐标”
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
    let lastPos = { x: 0, y: 0 } // 以 canvas内部“屏幕像素体系”为单位
    let justDragged = false
    let dragTimeout: number | null = null
    let currentMarkerPosition = { x: 0, y: 0 }

    const markerDropdown = ref(null)
    const markerMenuVisible = ref(false)
    const markerDialogVisible = ref(false)
    const markerForm = ref({ type: '', content: '' })
    const markerTypes = [
      { type: 'landmark', label: '参照物', icon: '📌' },
      { type: 'note', label: '备注', icon: '📝' },
      { type: 'photo', label: '照片', icon: '📷' },
      { type: 'warning', label: '警告', icon: '⚠️' },
      { type: 'checkpoint', label: '检查点', icon: '✓' },
      { type: 'milestone', label: '里程碑', icon: '⭐' }
    ]

    // 移动端触摸事件
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
        markerForm.value.type = 'landmark'
        markerForm.value.content = ''
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

      // 保存当前位置并显示标记菜单
      currentMarkerPosition = { x: realX, y: realY }
      showMarkerMenu(e.clientX, e.clientY)
    }

    function showMarkerMenu(x: number, y: number) {
      markerForm.value.type = ''
      markerForm.value.content = ''
      markerMenuVisible.value = true
    }

    function selectMarkerType(markerType: { type: string; label: string; icon: string }) {
      markerForm.value.type = markerType.type
      markerMenuVisible.value = false
      markerDialogVisible.value = true
    }

    function confirmAddMarker() {
      if (markerForm.value.type) {
        emit('add-marker', {
          x: currentMarkerPosition.x,
          y: currentMarkerPosition.y,
          type: markerForm.value.type,
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
        milestone: 'primary'
      }
      return colors[type as keyof typeof colors] || 'info'
    }

    function getMarkerTypeText(type: string) {
      const texts = {
        landmark: '参照物',
        note: '备注',
        photo: '照片',
        warning: '警告',
        checkpoint: '检查点',
        milestone: '里程碑'
      }
      return texts[type as keyof typeof texts] || '标记'
    }

    function draw() {
      const ctx = canvas.value?.getContext('2d')
      if (!ctx) return

      // 每次重绘时先清空，避免 setTransform 后 clearRect 坐标体系混乱
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, props.width, props.height)

      // 统一由 viewScale/offset 控制视口变换
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

    function drawPointsAndLines(
      ctx: CanvasRenderingContext2D,
      segmentsToDraw: Segment[] = props.segments as Segment[]
    ) {
      segmentsToDraw.forEach((segment, segIdx) => {
        ctx.save()
        const color = getSegmentColor(segment, segIdx)
        ctx.strokeStyle = color
        ctx.lineWidth = props.LineWidthNuber / viewScale.value
        const seg = segment.points
        let i = 1
        while (i < seg.length) {
          // 检查连续curve段
          if (seg[i].type === 'curve') {
            let j = i
            while (j < seg.length && seg[j].type === 'curve') j++
            // 取前一个点和连续的curve点
            const curvePoints = [seg[i - 1], ...seg.slice(i, j)]
            if (curvePoints.length >= 3) {
              drawCatmullRom(ctx, curvePoints)
            } else if (curvePoints.length === 2) {
              // 只有两个点时，降级为直线
              ctx.beginPath()
              ctx.moveTo(curvePoints[0].x, curvePoints[0].y)
              ctx.lineTo(curvePoints[1].x, curvePoints[1].y)
              ctx.stroke()
            }
            i = j
          } else {
            // 直线段
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
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 1.5
            ctx.stroke()
            ctx.restore()
          })
        }

        // 画标记点
        if (segment.markers) {
          segment.markers.forEach(marker => {
            drawMarker(ctx, marker)
          })
        }
        ctx.restore()
      })
    }

    // 导出用：在未缩放未平移坐标系下绘制单分段，避免分段互相覆盖
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
        }
        if (!segment.finished) {
          seg.forEach(p => {
            ctx.beginPath()
            ctx.arc(p.x, p.y, props.pointSizeNuber, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
          })
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
      marker: { x: number; y: number; type: string; content: string }
    ) {
      const colors = {
        landmark: '#e6a23c',
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399'
      }
      const color = colors[marker.type as keyof typeof colors] || '#409eff'
      ctx.save()
      if (marker.type === 'landmark') {
        drawPinAt(ctx, marker.x, marker.y, color, props.landmarkSizeNuber)
      } else {
        ctx.beginPath()
        ctx.arc(marker.x, marker.y, props.pointSizeNuber, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = props.LineWidthNuber
        ctx.stroke()
      }
      ctx.restore()
    }

    async function captureSegmentImage(segmentIndex: number): Promise<string | null> {
      const segment = (props.segments as Segment[])[segmentIndex]
      if (!segment) return null

      const offscreen = document.createElement('canvas')
      offscreen.width = props.width
      offscreen.height = props.height
      const ctx = offscreen.getContext('2d')
      if (!ctx) return null

      ctx.clearRect(0, 0, props.width, props.height)

      if (props.imageSrc) {
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

      drawSingleSegmentForExport(ctx, segment, segmentIndex)
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
    }

    /** 绘制中：点1→点2 单箭头 */
    function drawSegmentDirectionArrow(
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
      const t = getArrowPositions(seg)[0] || { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, angle }
      drawArrowAt(ctx, t.x, t.y, t.angle ?? angle, color, scale)
    }

    /** 已结束分段：沿路径分布最多 5 个方向箭头 */
    function drawArrowsAlongPath(
      ctx: CanvasRenderingContext2D,
      seg: Array<{ x: number; y: number }>,
      color: string,
      scale = 1 / viewScale.value
    ) {
      getArrowPositions(seg).forEach(pos => drawArrowAt(ctx, pos.x, pos.y, pos.angle, color, scale))
    }

    // Catmull-Rom样条转三次贝塞尔
    function drawCatmullRom(ctx, points) {
      ctx.save()
      ctx.lineWidth = props.LineWidthNuber / viewScale.value // 线宽固定为2像素
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

    // 绘制标记点
    function drawMarker(
      ctx: CanvasRenderingContext2D,
      marker: { x: number; y: number; type: string; content: string }
    ) {
      const colors = {
        landmark: '#e6a23c',
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399'
      }
      const color = colors[marker.type as keyof typeof colors] || '#409eff'
      const sx = marker.x * viewScale.value + offset.value.x
      const sy = marker.y * viewScale.value + offset.value.y

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)

      let pinTopY = sy
      if (marker.type === 'landmark') {
        drawPinAt(ctx, sx, sy, color, props.landmarkSizeNuber)
        const r = props.landmarkSizeNuber * 0.4
        const pinHeight = r * 2.2
        pinTopY = sy - pinHeight - r
      } else {
        ctx.beginPath()
        ctx.arc(sx, sy, props.pointSizeNuber, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = props.LineWidthNuber
        ctx.stroke()
        const icons = {
          note: '📝',
          photo: '📷',
          warning: '⚠️',
          checkpoint: '✓',
          milestone: '⭐'
        }
        const icon = icons[marker.type as keyof typeof icons] || '📍'
        ctx.fillStyle = '#fff'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(icon, sx, sy)
        pinTopY = sy - props.pointSizeNuber
      }

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

    function drawPinAt(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      size: number
    ) {
      const r = size * 0.4
      const pinHeight = r * 2.2
      ctx.save()
      ctx.fillStyle = color
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.bezierCurveTo(
        x - r * 0.8,
        y - r * 1.2,
        x - r,
        y - pinHeight + r * 0.3,
        x,
        y - pinHeight + r
      )
      ctx.arc(x, y - pinHeight + r, r, Math.PI, 0, false)
      ctx.bezierCurveTo(x + r, y - pinHeight + r * 0.3, x + r * 0.8, y - r * 1.2, x, y)
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(x, y - pinHeight + r, r * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.restore()
    }

    function drawAll() {
      requestAnimationFrame(draw)
    }

    // 拖拽与缩放
    function onMouseDown(e: MouseEvent) {
      console.log('Mouse down:', e.clientX, e.clientY)
      dragging = true
      justDragged = false
      pinchActive = false
      lastPos = clientToCanvasScreen(e.clientX, e.clientY)
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return
      console.log('Mouse move:', e.clientX, e.clientY, 'dragging:', dragging)
      justDragged = true
      const p = clientToCanvasScreen(e.clientX, e.clientY)
      offset.value.x += p.x - lastPos.x
      offset.value.y += p.y - lastPos.y
      lastPos = p
      drawAll() // 拖动时立即重绘
    }

    function onMouseUp(e: MouseEvent) {
      console.log('Mouse up')
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

      // 以光标位置为缩放中心：让缩放前后该点的“逻辑坐标”保持不变
      const logicalX = (cursorScreenX - offset.value.x) / viewScale.value
      const logicalY = (cursorScreenY - offset.value.y) / viewScale.value

      const nextScale = clamp(viewScale.value * scaleDelta, viewScaleMin, viewScaleMax)
      offset.value.x = cursorScreenX - logicalX * nextScale
      offset.value.y = cursorScreenY - logicalY * nextScale
      viewScale.value = nextScale
      if (dragTimeout) clearTimeout(dragTimeout)
      drawAll()
    }

    // 移动端触摸事件
    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      touchStartTime = Date.now()
      isLongPress = false
      pinchActive = false
      if (e.touches.length === 1) {
        // 单指触摸
        if (props.drawing) {
          // 长按检测
          touchTimer = window.setTimeout(() => {
            isLongPress = true
            const touch = e.touches[0]
            const { x, y } = clientToCanvasScreen(touch.clientX, touch.clientY)
            const realX = (x - offset.value.x) / viewScale.value
            const realY = (y - offset.value.y) / viewScale.value

            currentMarkerPosition = { x: realX, y: realY }
            showMarkerMenu(touch.clientX, touch.clientY)
          }, 500) // 500ms长按
        }

        // 拖拽检测
        dragging = true
        const touch = e.touches[0]
        justDragged = false
        lastPos = clientToCanvasScreen(touch.clientX, touch.clientY)
      }
      if (e.touches.length === 2) {
        // 双指捏合缩放
        dragging = false
        justDragged = true // 避免松手时误触发“添加点”
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

      // 如果移动距离超过阈值，取消长按
      if (moveDistance > 10 && touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
        isLongPress = false
      }

      justDragged = true
      offset.value.x += p.x - lastPos.x
      offset.value.y += p.y - lastPos.y
      lastPos = p
      drawAll() // 拖动时立即重绘
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault()
      const wasPinching = pinchActive
      pinchActive = false

      // 清理长按定时器
      if (touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
      }

      // 如果不是长按且没有拖拽，则添加点位
      if (!wasPinching && !isLongPress && !justDragged && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0]
        const { x, y } = clientToCanvasScreen(touch.clientX, touch.clientY)
        const realX = (x - offset.value.x) / viewScale.value
        const realY = (y - offset.value.y) / viewScale.value
        if (props.landmarkMode) {
          currentMarkerPosition = { x: realX, y: realY }
          markerForm.value.type = 'landmark'
          markerForm.value.content = ''
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
      }

      // 添加全局鼠标事件监听器，确保拖拽功能正常工作
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    onUnmounted(() => {
      // 清理全局鼠标和容器尺寸监听器
      document.removeEventListener('mousemove', onMouseMove)
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
      showMarkerMenu,
      selectMarkerType,
      confirmAddMarker,
      onMarkerMenuVisibleChange,
      getMarkerTypeColor,
      getMarkerTypeText,
      captureSegmentImage
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
</style>
