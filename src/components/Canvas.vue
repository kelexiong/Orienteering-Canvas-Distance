<template>
  <el-card class="canvas-card" shadow="hover">
    <div class="canvas-container">
      <canvas
        ref="canvas"
        :width="width"
        :height="height"
        class="canvas-main"
        @click="handleCanvasClick"
      ></canvas>
      <div v-if="isLoading" class="loading-overlay">
        <el-icon><Loading /></el-icon>
        <p>图片加载中...</p>
      </div>
      <div v-if="errorMessage" class="error-overlay">
        <el-alert :title="errorMessage" type="error" show-icon :closable="false" />
      </div>
    </div>
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
import { defineComponent, ref, watch, onMounted, nextTick } from 'vue'
import { Loading } from '@element-plus/icons-vue'
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
  emits: ['add-point'],
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
      ;(props.segments as Array<{ x: number; y: number; type?: 'line' | 'curve' }[]>).forEach(
        segment => {
          const seg = segment as Array<{ x: number; y: number; type?: 'line' | 'curve' }>
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
            ctx.beginPath()
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI)
            ctx.fillStyle = 'red'
            ctx.fill()
          })
        }
      )
    }

    // Catmull-Rom样条转三次贝塞尔
    function drawCatmullRom(ctx, points) {
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
    }

    function drawAll() {
      requestAnimationFrame(draw)
    }

    // 拖拽与缩放
    function onMouseDown(e: MouseEvent) {
      dragging = true
      lastPos = { x: e.clientX, y: e.clientY }
    }
    // // Catmull-Rom样条/二次贝塞尔
    // const p0 = seg[i - 2] || seg[i - 1]
    // const p1 = seg[i - 1]
    // const p2 = seg[i]
    // // 控制点为p1和p2中点
    // const cpx = (p1.x + p2.x) / 2
    // const cpy = (p1.y + p2.y) / 2
    // ctx.quadraticCurveTo(cpx, cpy, p2.x, p2.y)
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return
      justDragged = true
      offset.value.x += e.clientX - lastPos.x
      offset.value.y += e.clientY - lastPos.y
      lastPos = { x: e.clientX, y: e.clientY }
    }
    function onMouseUp() {
      dragging = false
      if (dragTimeout) clearTimeout(dragTimeout)
      dragTimeout = window.setTimeout(() => {
        justDragged = false
      }, 100)
    }
    function onWheel(e: WheelEvent) {
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
    // 移动端略

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
    })

    return {
      canvas,
      isLoading,
      errorMessage,
      handleCanvasClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onWheel
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
