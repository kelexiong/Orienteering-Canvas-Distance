<template>
  <el-card class="canvas-card" shadow="hover">
    <div class="canvas-container">
      <canvas
        ref="canvas"
        :width="width"
        :height="height"
        class="canvas-main"
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
      title="添加标记"
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
        title="提示：可拖动画布、滚轮缩放、点击添加点，支持移动端手势操作"
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
    drawing: { type: Boolean, required: true },
    imageSrc: { type: [String, null], required: true },
    orientation: { type: String, required: true },
    drawMode: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  emits: ['add-point', 'add-marker'],
  setup(props, { emit }) {
    const canvas = ref<HTMLCanvasElement | null>(null)
    const isLoading = ref(false)
    const errorMessage = ref('')
    const viewScale = ref(1)
    const offset = ref({ x: 0, y: 0 })
    let dragging = false
    let lastPos = { x: 0, y: 0 }
    let justDragged = false
    let dragTimeout: number | null = null
    let currentMarkerPosition = { x: 0, y: 0 }

    const markerDropdown = ref(null)
    const markerMenuVisible = ref(false)
    const markerDialogVisible = ref(false)
    const markerForm = ref({ type: '', content: '' })
    const markerTypes = [
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

    function handleCanvasClick(e: MouseEvent) {
      if (!props.drawing) return
      if (justDragged) return
      const rect = canvas.value!.getBoundingClientRect()
      const scaleX = canvas.value!.width / canvas.value!.clientWidth
      const scaleY = canvas.value!.height / canvas.value!.clientHeight
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
      const realX = (x - offset.value.x) / viewScale.value
      const realY = (y - offset.value.y) / viewScale.value
      emit('add-point', { x: realX, y: realY })
    }

    function handleCanvasRightClick(e: MouseEvent) {
      e.preventDefault()
      const rect = canvas.value!.getBoundingClientRect()
      const scaleX = canvas.value!.width / canvas.value!.clientWidth
      const scaleY = canvas.value!.height / canvas.value!.clientHeight
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
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
      if (markerForm.value.type && markerForm.value.content) {
        emit('add-marker', {
          x: currentMarkerPosition.x,
          y: currentMarkerPosition.y,
          type: markerForm.value.type,
          content: markerForm.value.content
        })
        markerDialogVisible.value = false
      }
    }

    function getMarkerTypeColor(type: string) {
      const colors = {
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
      ctx.setTransform(viewScale.value, 0, 0, viewScale.value, offset.value.x, offset.value.y)
      ctx.clearRect(
        -offset.value.x / viewScale.value,
        -offset.value.y / viewScale.value,
        props.width / viewScale.value,
        props.height / viewScale.value
      )
      if (props.imageSrc) {
        const img = new window.Image()
        img.src = props.imageSrc as string
        isLoading.value = true
        errorMessage.value = ''
        img.onload = () => {
          ctx.drawImage(img, 0, 0, props.width, props.height)
          drawPointsAndLines(ctx)
          isLoading.value = false
        }
        img.onerror = () => {
          errorMessage.value = '图片加载失败'
          isLoading.value = false
        }
        if (img.complete) {
          ctx.drawImage(img, 0, 0, props.width, props.height)
          drawPointsAndLines(ctx)
          isLoading.value = false
        }
      } else {
        drawPointsAndLines(ctx)
      }
    }

    function drawPointsAndLines(ctx: CanvasRenderingContext2D) {
      ;(
        props.segments as Array<{
          points: Array<{ x: number; y: number; type?: 'line' | 'curve' }>
          markers: Array<{ x: number; y: number; type: string; content: string }>
        }>
      ).forEach((segment, segIdx) => {
        ctx.save()
        ctx.strokeStyle = segmentColors[segIdx % segmentColors.length]
        ctx.lineWidth = 2 / viewScale.value // 线宽固定为2像素
        const seg = segment.points as Array<{ x: number; y: number; type?: 'line' | 'curve' }>
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
        // 画点
        seg.forEach(p => {
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.beginPath()
          ctx.arc(
            p.x * viewScale.value + offset.value.x,
            p.y * viewScale.value + offset.value.y,
            5,
            0,
            2 * Math.PI
          )
          ctx.fillStyle = 'red'
          ctx.fill()
          ctx.restore()
        })

        // 画标记点
        if (segment.markers) {
          segment.markers.forEach(marker => {
            drawMarker(ctx, marker)
          })
        }
        ctx.restore()
      })
    }

    // Catmull-Rom样条转三次贝塞尔
    function drawCatmullRom(ctx, points) {
      ctx.save()
      ctx.lineWidth = 2 / viewScale.value // 线宽固定为2像素
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
        note: '#409eff',
        photo: '#67c23a',
        warning: '#f56c6c',
        checkpoint: '#e6a23c',
        milestone: '#909399'
      }
      const color = colors[marker.type as keyof typeof colors] || '#409eff'

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.beginPath()
      ctx.arc(
        marker.x * viewScale.value + offset.value.x,
        marker.y * viewScale.value + offset.value.y,
        8,
        0,
        2 * Math.PI
      )
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()

      // 绘制标记图标
      ctx.fillStyle = '#fff'
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const icons = {
        note: '📝',
        photo: '📷',
        warning: '⚠️',
        checkpoint: '✓',
        milestone: '⭐'
      }
      const icon = icons[marker.type as keyof typeof icons] || '📍'
      ctx.fillText(
        icon,
        marker.x * viewScale.value + offset.value.x,
        marker.y * viewScale.value + offset.value.y
      )
      ctx.restore()
    }

    function drawAll() {
      requestAnimationFrame(draw)
    }

    // 拖拽与缩放
    function onMouseDown(e: MouseEvent) {
      console.log('Mouse down:', e.clientX, e.clientY)
      dragging = true
      lastPos = { x: e.clientX, y: e.clientY }
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return
      console.log('Mouse move:', e.clientX, e.clientY, 'dragging:', dragging)
      justDragged = true
      offset.value.x += e.clientX - lastPos.x
      offset.value.y += e.clientY - lastPos.y
      lastPos = { x: e.clientX, y: e.clientY }
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
      const rect = canvas.value!.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const x = (mouseX - offset.value.x) / viewScale.value
      const y = (mouseY - offset.value.y) / viewScale.value
      viewScale.value *= scaleDelta
      offset.value.x = mouseX - x * viewScale.value
      offset.value.y = mouseY - y * viewScale.value
      if (dragTimeout) clearTimeout(dragTimeout)
    }

    // 移动端触摸事件
    function onTouchStart(e: TouchEvent) {
      e.preventDefault()
      touchStartTime = Date.now()
      isLongPress = false

      if (e.touches.length === 1) {
        // 单指触摸
        if (props.drawing) {
          // 长按检测
          touchTimer = window.setTimeout(() => {
            isLongPress = true
            const touch = e.touches[0]
            const rect = canvas.value!.getBoundingClientRect()
            const scaleX = canvas.value!.width / canvas.value!.clientWidth
            const scaleY = canvas.value!.height / canvas.value!.clientHeight
            const x = (touch.clientX - rect.left) * scaleX
            const y = (touch.clientY - rect.top) * scaleY
            const realX = (x - offset.value.x) / viewScale.value
            const realY = (y - offset.value.y) / viewScale.value

            currentMarkerPosition = { x: realX, y: realY }
            showMarkerMenu(touch.clientX, touch.clientY)
          }, 500) // 500ms长按
        }

        // 拖拽检测
        dragging = true
        const touch = e.touches[0]
        lastPos = { x: touch.clientX, y: touch.clientY }
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault()
      if (!dragging || e.touches.length !== 1) return

      const touch = e.touches[0]
      const moveDistance = Math.sqrt(
        Math.pow(touch.clientX - lastPos.x, 2) + Math.pow(touch.clientY - lastPos.y, 2)
      )

      // 如果移动距离超过阈值，取消长按
      if (moveDistance > 10 && touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
        isLongPress = false
      }

      justDragged = true
      offset.value.x += touch.clientX - lastPos.x
      offset.value.y += touch.clientY - lastPos.y
      lastPos = { x: touch.clientX, y: touch.clientY }
      drawAll() // 拖动时立即重绘
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault()

      // 清理长按定时器
      if (touchTimer) {
        clearTimeout(touchTimer)
        touchTimer = null
      }

      // 如果不是长按且没有拖拽，则添加点位
      if (!isLongPress && !justDragged && props.drawing && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0]
        const rect = canvas.value!.getBoundingClientRect()
        const scaleX = canvas.value!.width / canvas.value!.clientWidth
        const scaleY = canvas.value!.height / canvas.value!.clientHeight
        const x = (touch.clientX - rect.left) * scaleX
        const y = (touch.clientY - rect.top) * scaleY
        const realX = (x - offset.value.x) / viewScale.value
        const realY = (y - offset.value.y) / viewScale.value
        emit('add-point', { x: realX, y: realY })
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
      () => nextTick(drawAll)
    )
    watch(
      () => props.height,
      () => nextTick(drawAll)
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
    watch(viewScale, () => nextTick(drawAll))
    watch(offset, () => nextTick(drawAll))

    onMounted(() => {
      drawAll()

      // 添加全局鼠标事件监听器，确保拖拽功能正常工作
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })

    onUnmounted(() => {
      // 清理全局事件监听器
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    })

    return {
      canvas,
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
      getMarkerTypeText
    }
  }
})
</script>

<style scoped lang="scss">
.canvas-card {
  margin: 0 auto;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(64, 158, 255, 0.1);
  .el-card__footer {
    padding: 8px 16px 0 16px;
    background: transparent;
    border-top: none;
  }
}
.canvas-container {
  width: 100%;
  min-height: 220px;
  position: relative;
  background: #f6f8fa;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-main {
  display: block;
  background: #fff;
  border: 2px solid #409eff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.08);
  width: 100%;
  max-width: 100%;
  max-height: 60vw;
  margin: 0 auto;
  touch-action: none;
  transition: box-shadow 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.16);
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
