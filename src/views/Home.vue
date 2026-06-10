<template>
  <div class="home-tech-bg">
    <header class="top-toolbar animate__animated animate__fadeInDown">
      <div class="brand">
        <el-icon class="logo"><Compass /></el-icon>
        <span class="title">定向越野绘图笔记</span>
      </div>
      <div class="actions">
        <el-button
          :type="drawing ? 'warning' : 'success'"
          @click="onToggleDrawing"
          class="tb-btn"
        >
          <el-icon><Edit /></el-icon>
          <span>{{ drawing ? '结束绘制' : '开始绘制' }}</span>
        </el-button>
        <el-popconfirm title="确定要清除所有点位吗？" @confirm="clearPoints">
          <template #reference>
            <el-button type="danger" class="tb-btn">
              <el-icon><Delete /></el-icon>
              <span>清除</span>
            </el-button>
          </template>
        </el-popconfirm>
        <el-button type="info" class="tb-btn" @click="triggerImageUpload">
          <el-icon><Picture /></el-icon>
          <span>插图</span>
        </el-button>
        <el-button type="warning" class="tb-btn" @click="rotateImage">
          <el-icon><Refresh /></el-icon>
          <span>旋转</span>
        </el-button>
        <el-button
          class="tb-btn"
          @click="drawMode = drawMode === 'line' ? 'curve' : 'line'"
        >
          <el-icon><Connection /></el-icon>
          <span>{{ drawMode === 'line' ? '曲线' : '直线' }}</span>
        </el-button>
        <el-button
          :type="landmarkMode ? 'primary' : 'default'"
          class="tb-btn"
          @click="toggleLandmarkMode"
        >
          <el-icon><LocationFilled /></el-icon>
          <span>{{ landmarkMode ? '图钉中' : '参照物' }}</span>
        </el-button>
        <el-button type="primary" plain class="tb-btn" @click="addSegmentGroup">
          <el-icon><Plus /></el-icon>
          <span>新增分段</span>
        </el-button>
      </div>
      <div class="toolbar-right">
        <el-button
          :type="panelDrawerVisible ? 'primary' : 'default'"
          class="tb-btn panel-toggle-btn"
          @click="panelDrawerVisible = !panelDrawerVisible"
        >
          <el-icon><Operation /></el-icon>
          <span>面板</span>
        </el-button>
      </div>
    </header>

    <main class="workspace">
      <section class="canvas-stage">
        <Canvas
          :segments="segments"
          :draw-mode="drawMode"
          :width="canvasWidth"
          :height="canvasHeight"
          :current-segment="currentSegment"
          :scale="mapScaleDenominator"
          :pointSizeNuber="pointSizeNuber"
          :landmarkSizeNuber="landmarkSizeNuber"
          :LineWidthNuber="LineWidthNuber"
          :arrowSizeNuber="arrowSizeNuber"
          :markerOpacity="markerOpacity"
          :drawing="drawing"
          :landmark-mode="landmarkMode"
          :image-src="imageSrc"
          :orientation="orientation"
          :image-rotation="imageRotation"
          :edit-mode="editMode"
          @add-point="addPoint"
          @add-marker="onAddMarker"
          class="home-canvas"
          ref="canvasRef"
        />
      </section>

      <div
        v-if="isMobile && panelDrawerVisible"
        class="side-panel-mask"
        @click="panelDrawerVisible = false"
      ></div>

      <aside class="side-panel" :class="{ 'is-collapsed': !panelDrawerVisible }">
        <div class="side-panel-inner">
          <div class="mobile-panel-header">
            <span>记录面板</span>
            <el-button size="small" text type="primary" @click="panelDrawerVisible = false">
              收起
            </el-button>
          </div>
          <ControlPanel
            hide-actions
            :drawing="drawing"
            :draw-mode="drawMode"
            :orientation="orientation"
            :landmark-mode="landmarkMode"
            :current-segment="currentSegment"
            :segment-groups="segmentGroups"
            v-model:scale-enabled="scaleEnabled"
            v-model:map-scale-denominator="mapScaleDenominator"
            :point-size="pointSizeNuber"
            :line-width="LineWidthNuber"
            :landmark-size="landmarkSizeNuber"
            :arrow-size="arrowSizeNuber"
            :marker-opacity="markerOpacity"
            @toggle-drawing="onToggleDrawing"
            @clear-points="clearPoints"
            @upload-image="triggerImageUpload"
            @toggle-orientation="rotateImage"
            @toggle-draw-mode="drawMode = drawMode === 'line' ? 'curve' : 'line'"
            @toggle-landmark-mode="toggleLandmarkMode"
            @add-compare-route="addCompareRoute"
            @add-segment-group="addSegmentGroup"
            @switch-segment="setCurrentSegment"
            @update-segment-color="updateSegmentColor"
            @remove-segment="removeSegmentById"
            @reorder-compares="reorderCompares"
            @update:point-size="pointSizeNuber = $event"
            @update:line-width="LineWidthNuber = $event"
            @update:landmark-size="landmarkSizeNuber = $event"
            @update:arrow-size="arrowSizeNuber = $event"
            @update:marker-opacity="markerOpacity = $event"
          />
          <el-divider class="drawer-divider">点位列表</el-divider>
          <DiaryList
            :segment="segments[currentSegment]"
            :scale-enabled="scaleEnabled"
            :map-scale-denominator="mapScaleDenominator"
            :orientation="orientation"
            :segment-index="currentSegment"
            :all-segments="segments"
            :landmark-size="landmarkSizeNuber"
            :canvas-element="getCanvasElement()"
            @remove-point="removePoint"
            @insert-point-mode="onInsertPointMode"
            @edit-point-mode="onEditPointMode"
            @toggle-type="togglePointType"
            :landmark-mode="landmarkMode"
            :drawing="drawing"
            @update-point-description="updatePointDescription"
            @remove-marker="removeMarker"
            @update-marker-description="updateMarkerDescription"
            @toggle-landmark-mode="toggleLandmarkMode"
          />
        </div>
      </aside>
    </main>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onImageChange"
    />
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Canvas from '../components/Canvas.vue'
import DiaryList from '../components/DiaryList.vue'
import ControlPanel from '../components/ControlPanel.vue'
import { ElMessage } from 'element-plus'
import {
  Compass,
  Menu,
  Edit,
  Delete,
  Picture,
  Refresh,
  Connection,
  LocationFilled,
  Plus,
  Operation
} from '@element-plus/icons-vue'
import type { Segment, Point, Marker } from '../types'
import { MAP_SCALE_PRESETS } from '../utils/mapScale'
import { createSegment, buildSegmentGroups } from '../utils/segment'

export default defineComponent({
  components: {
    Canvas,
    DiaryList,
    ControlPanel,
    Compass,
    Menu,
    Edit,
    Delete,
    Picture,
    Refresh,
    Connection,
    LocationFilled,
    Plus,
    Operation
  },
  setup() {
    const drawing = ref(false)
    const imageSrc = ref<string | null>(null)
    const fileInput = ref<HTMLInputElement | null>(null)
    const canvasRef = ref<any>(null)
    const loading = ref(false) // 加载状态
    const drawMode = ref<'line' | 'curve'>('line')
    const showLandscapeTip = ref(false)

    // 自定义Hook管理点位逻辑 - 使用新的Segment数据结构
    const segments = ref<Segment[]>([
      createSegment({
        name: '实际路线1',
        trackRole: 'actual',
        groupId: 'group-1'
      })
    ])
    const currentSegment = ref(0)
    const insertMode = ref<{ segIdx: number; ptIdx: number } | null>(null)
    const editMode = ref<{ segIdx: number; ptIdx: number } | null>(null)

    const resumeSegmentEditing = (segIdx: number) => {
      const seg = segments.value[segIdx]
      if (seg?.finished) {
        seg.finished = false
        seg.updatedAt = new Date()
      }
    }

    const addPoint = (point: { x: number; y: number }) => {
      const cur = segments.value[currentSegment.value]
      if (!cur) return
      if (cur.finished && !drawing.value) return
      const type = drawMode.value // 'line' 或 'curve'
      const newPoint: Point = {
        ...point,
        type,
        timestamp: new Date()
      }

      if (editMode.value) {
        // 编辑模式
        const { segIdx, ptIdx } = editMode.value
        const old = segments.value[segIdx].points[ptIdx]
        segments.value[segIdx].points.splice(ptIdx, 1, { ...newPoint, type: old.type })
        segments.value[segIdx].updatedAt = new Date()
        editMode.value = null
        drawing.value = false
      } else if (insertMode.value) {
        // 插入模式
        const { segIdx, ptIdx } = insertMode.value
        segments.value[segIdx].points.splice(ptIdx, 0, newPoint)
        segments.value[segIdx].updatedAt = new Date()
        insertMode.value = null
        drawing.value = false
      } else {
        // 普通追加
        if (segments.value[currentSegment.value].points.length === 0) {
          segments.value[currentSegment.value].points.push({ ...newPoint, type: undefined })
        } else {
          segments.value[currentSegment.value].points.push(newPoint)
        }
        segments.value[currentSegment.value].updatedAt = new Date()
      }
    }

    const updatePoint = (segIdx: number, ptIdx: number, newPoint: { x: number; y: number }) => {
      const old = segments.value[segIdx].points[ptIdx]
      segments.value[segIdx].points.splice(ptIdx, 1, { ...newPoint, type: old.type })
      segments.value[segIdx].updatedAt = new Date()
      console.log('updatePoint', segments.value)
    }

    const removePoint = (segIdx: number, ptIdx: number) => {
      resumeSegmentEditing(segIdx)
      if (segments.value[segIdx] && segments.value[segIdx].points[ptIdx] !== undefined) {
        segments.value[segIdx].points.splice(ptIdx, 1)
        segments.value[segIdx].updatedAt = new Date()
        // 如果分段被删空，且不是唯一分段，则自动删除该分段
        if (segments.value[segIdx].points.length === 0 && segments.value.length > 1) {
          segments.value.splice(segIdx, 1)
          // 修正 currentSegment
          if (currentSegment.value >= segments.value.length) {
            currentSegment.value = segments.value.length - 1
          }
        }
      }
    }

    const insertPoint = (segIdx: number, ptIdx: number, point: Point) => {
      if (segments.value[segIdx]) {
        segments.value[segIdx].points.splice(ptIdx, 0, point)
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    const clearPoints = () => {
      segments.value = [
        createSegment({
          name: '实际路线1',
          trackRole: 'actual',
          groupId: 'group-1'
        })
      ]
      currentSegment.value = 0
      drawing.value = false
      landmarkMode.value = false
    }

    const cacheSegmentImage = async (idx: number) => {
      if (canvasRef.value?.captureSegmentImage && segments.value[idx]) {
        const image = await canvasRef.value.captureSegmentImage(idx)
        if (image) segments.value[idx].image = image
      }
    }

    const finishCurrentSegment = async () => {
      const seg = segments.value[currentSegment.value]
      if (!seg || seg.finished) return
      if (seg.points.length < 2) {
        ElMessage.warning('至少需要 2 个点才能结束分段')
        return
      }
      await cacheSegmentImage(currentSegment.value)
      seg.finished = true
      seg.updatedAt = new Date()
      drawing.value = false
      landmarkMode.value = false
      ElMessage.success(
        seg.trackRole === 'compare' ? '对比路线已固定为轨迹线' : '实际跑动路线已固定为轨迹线'
      )
    }

    const findFinishedActualInGroup = (groupId: string) =>
      segments.value.find(s => s.groupId === groupId && s.trackRole === 'actual' && s.finished)

    const addCompareRoute = async (groupId?: string) => {
      const gid = groupId || segments.value[currentSegment.value]?.groupId
      if (!gid) return
      const actual = findFinishedActualInGroup(gid)
      if (!actual) {
        ElMessage.warning('请先「结束绘制」实际跑动路线，再添加对比路线')
        return
      }
      const cur = segments.value[currentSegment.value]
      if (cur && drawing.value && cur.points.length > 0) {
        await finishCurrentSegment()
      }
      const compareCount = segments.value.filter(
        s => s.groupId === gid && s.trackRole === 'compare'
      ).length
      const newSeg = createSegment({
        name: `对比路线${compareCount + 1}`,
        trackRole: 'compare',
        groupId: gid,
        parentActualId: actual.id
      })
      segments.value.push(newSeg)
      currentSegment.value = segments.value.length - 1
      drawing.value = false
      landmarkMode.value = false
    }

    const addSegmentGroup = async () => {
      const cur = segments.value[currentSegment.value]
      if (cur && drawing.value && cur.points.length > 0) {
        await finishCurrentSegment()
      } else if (cur && !cur.finished && cur.points.length >= 2) {
        await finishCurrentSegment()
      }
      const groupId = `group-${Date.now()}`
      const groupCount = new Set(segments.value.map(s => s.groupId)).size
      const newSeg = createSegment({
        name: `实际跑动`,
        trackRole: 'actual',
        groupId
      })
      segments.value.push(newSeg)
      currentSegment.value = segments.value.length - 1
      drawing.value = false
      landmarkMode.value = false
      ElMessage.success(`已新增分段${groupCount + 1}`)
    }

    const updateSegmentColor = (segIdx: number, color: string) => {
      if (segments.value[segIdx]) {
        segments.value[segIdx].color = color
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    const removeSegmentById = (segId: string) => {
      const idx = segments.value.findIndex(s => s.id === segId)
      if (idx === -1) return
      const seg = segments.value[idx]
      if (seg.trackRole === 'actual') return
      segments.value.splice(idx, 1)
      if (currentSegment.value >= segments.value.length) {
        currentSegment.value = segments.value.length - 1
      } else if (currentSegment.value === idx) {
        const actual = segments.value.find(
          s => s.groupId === seg.groupId && s.trackRole === 'actual'
        )
        currentSegment.value = actual ? segments.value.indexOf(actual) : 0
      } else if (currentSegment.value > idx) {
        currentSegment.value--
      }
      if (drawing.value) drawing.value = false
    }

    const reorderCompares = (groupId: string, fromIdx: number, toIdx: number) => {
      const compares = segments.value
        .map((s, i) => ({ seg: s, globalIdx: i }))
        .filter(({ seg }) => seg.groupId === groupId && seg.trackRole === 'compare')
      if (fromIdx < 0 || fromIdx >= compares.length || toIdx < 0 || toIdx >= compares.length) return
      const movedGlobalIdx = compares[fromIdx].globalIdx
      const [moved] = segments.value.splice(movedGlobalIdx, 1)
      const targetGlobalIdx =
        fromIdx < toIdx ? compares[toIdx].globalIdx - 1 : compares[toIdx].globalIdx
      segments.value.splice(targetGlobalIdx, 0, moved)
      currentSegment.value = segments.value.findIndex(s => s.id === moved.id)
    }

    const setCurrentSegment = async (idx: number) => {
      await cacheSegmentImage(currentSegment.value)
      if (idx >= 0 && idx < segments.value.length) {
        currentSegment.value = idx
        if (segments.value[idx].finished) {
          drawing.value = false
        }
      }
    }

    // 新增：更新分段描述
    const updateSegmentDescription = (segIdx: number, description: string) => {
      if (segments.value[segIdx]) {
        segments.value[segIdx].description = description
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    // 新增：更新点位描述
    const updateMarkerDescription = (segIdx: number, markerId: string, content: string) => {
      const seg = segments.value[segIdx]
      if (!seg) return
      const m = seg.markers.find(x => x.id === markerId)
      if (m) {
        m.content = content
        seg.updatedAt = new Date()
      }
    }

    const updatePointDescription = (segIdx: number, ptIdx: number, description: string) => {
      if (segments.value[segIdx] && segments.value[segIdx].points[ptIdx]) {
        segments.value[segIdx].points[ptIdx].description = description
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    // 新增：删除标记
    const removeMarker = (segIdx: number, markerId: string) => {
      if (segments.value[segIdx]) {
        const markerIndex = segments.value[segIdx].markers.findIndex(m => m.id === markerId)
        if (markerIndex !== -1) {
          segments.value[segIdx].markers.splice(markerIndex, 1)
          segments.value[segIdx].updatedAt = new Date()
        }
      }
    }

    // 新增：添加标记
    const addMarker = (segIdx: number, marker: Omit<Marker, 'id' | 'timestamp'>) => {
      if (segments.value[segIdx]) {
        const newMarker: Marker = {
          ...marker,
          id: Date.now().toString(),
          timestamp: new Date()
        }
        segments.value[segIdx].markers.push(newMarker)
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    // 自定义Hook管理画布设置
    const orientation = ref<'landscape' | 'portrait'>('landscape')
    const imageRotation = ref(0)
    const scaleEnabled = ref(false)
    const mapScaleDenominator = ref(10000)
    const mapScalePresets = MAP_SCALE_PRESETS
    const landmarkMode = ref(false)
    const pointSizeNuber = ref(2)
    const landmarkSizeNuber = ref(10)
    const LineWidthNuber = ref(2)
    const arrowSizeNuber = ref(1)
    const markerOpacity = ref(0.7)
    const canvasWidth = computed(() => 842)
    const canvasHeight = computed(() => 595)

    const segmentGroups = computed(() => buildSegmentGroups(segments.value))

    const rotateImage = () => {
      imageRotation.value = (imageRotation.value + 90) % 360
    }

    // 监听模式变化，动态修改 body 的 cursor
    const isEditOrInsertMode = computed(() => !!editMode.value || !!insertMode.value)
    watch(isEditOrInsertMode, val => {
      if (!landmarkMode.value) {
        document.body.style.cursor = val ? 'crosshair' : ''
      }
    })

    watch(landmarkMode, val => {
      document.body.style.cursor = val ? 'cell' : ''
      if (val) drawing.value = false
    })

    const onToggleDrawing = async () => {
      const seg = segments.value[currentSegment.value]
      if (!seg) return

      if (drawing.value) {
        drawing.value = false
        landmarkMode.value = false
        editMode.value = null
        insertMode.value = null
        if (seg.points.length >= 2 && !seg.finished) {
          await finishCurrentSegment()
        } else if (seg.points.length > 0 && seg.points.length < 2) {
          ElMessage.warning('至少需要 2 个点；可继续绘制或删除点位')
        }
      } else {
        if (seg.finished) {
          resumeSegmentEditing(currentSegment.value)
          ElMessage.info('已进入编辑模式，修改后请再次「结束绘制」以固化轨迹')
        }
        drawing.value = true
        landmarkMode.value = false
      }
    }

    const toggleLandmarkMode = () => {
      landmarkMode.value = !landmarkMode.value
      if (landmarkMode.value) {
        drawing.value = false
        editMode.value = null
        insertMode.value = null
      }
    }

    const onAddMarker = (marker: Omit<Marker, 'id' | 'timestamp'>) => {
      addMarker(currentSegment.value, marker)
      landmarkMode.value = false
    }

    // 移动端按竖屏正常使用，不再尝试强制横屏
    function checkOrientation() {
      showLandscapeTip.value = false
    }
    onMounted(() => {
      checkOrientation()
      window.addEventListener('resize', checkOrientation)
    })
    onUnmounted(() => {
      window.removeEventListener('resize', checkOrientation)
    })

    const panelDrawerVisible = ref(true)
    const isMobile = ref(false)
    // 响应式判断
    const checkMobile = () => {
      const nextIsMobile = window.innerWidth <= 768
      if (nextIsMobile && !isMobile.value) {
        panelDrawerVisible.value = false
      } else if (!nextIsMobile && isMobile.value) {
        panelDrawerVisible.value = true
      }
      isMobile.value = nextIsMobile
    }
    onMounted(() => {
      checkMobile()
      window.addEventListener('resize', checkMobile)
    })
    onUnmounted(() => {
      window.removeEventListener('resize', checkMobile)
    })

    // 新增：切换type
    const togglePointType = (segIdx: number, ptIdx: number) => {
      resumeSegmentEditing(segIdx)
      const pt = segments.value[segIdx].points[ptIdx]
      if (!pt) return
      const newType = !pt.type || pt.type === 'line' ? 'curve' : 'line'
      segments.value[segIdx].points.splice(ptIdx, 1, { ...pt, type: newType })
      segments.value[segIdx].updatedAt = new Date()
    }

    // 获取canvas元素
    const getCanvasElement = () => {
      // 在选项式API中，通过$refs访问组件实例
      return canvasRef.value?.$refs?.canvas || canvasRef.value?.canvas || null
    }

    // 补全所有分段的image，确保每个分段都有截图
    const fillSegmentImages = async () => {
      if (!canvasRef.value?.captureSegmentImage) return
      for (let idx = 0; idx < segments.value.length; idx++) {
        const seg = segments.value[idx]
        if (!seg.image && seg.points.length > 0) {
          const image = await canvasRef.value.captureSegmentImage(idx)
          if (image) seg.image = image
        }
      }
    }

    // 在返回值中添加_segments用于模板绑定
    return {
      segments,
      currentSegment,
      insertMode,
      editMode,
      loading,
      drawMode,
      scaleEnabled,
      mapScaleDenominator,
      mapScalePresets,
      landmarkMode,
      landmarkSizeNuber,
      segmentGroups,
      finishCurrentSegment,
      addCompareRoute,
      addSegmentGroup,
      updateSegmentColor,
      updateMarkerDescription,
      removeSegmentById,
      reorderCompares,
      onToggleDrawing,
      toggleLandmarkMode,
      onAddMarker,
      triggerImageUpload: () => {
        loading.value = true
        fileInput.value?.click()
      },
      onImageChange: (e: Event) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files[0]) {
          const reader = new FileReader()
          reader.onload = evt => {
            imageSrc.value = evt.target?.result as string
            loading.value = false
          }
          reader.readAsDataURL(files[0])
        } else {
          loading.value = false
        }
      },
      pointSizeNuber,
      LineWidthNuber,
      arrowSizeNuber,
      markerOpacity,
      drawing,
      imageSrc,
      clearPoints,
      removePoint,
      addPoint,
      fileInput,
      orientation,
      imageRotation,
      rotateImage,
      onInsertPointMode: (segIdx: number, ptIdx: number) => {
        resumeSegmentEditing(segIdx)
        insertMode.value = { segIdx, ptIdx: ptIdx + 1 }
        editMode.value = null
        drawing.value = true
      },
      onEditPointMode: (segIdx: number, ptIdx: number) => {
        resumeSegmentEditing(segIdx)
        editMode.value = { segIdx, ptIdx }
        insertMode.value = null
        drawing.value = true
      },
      canvasWidth,
      canvasHeight,
      Canvas,
      DiaryList,
      setCurrentSegment,
      showLandscapeTip,
      panelDrawerVisible,
      isMobile,
      togglePointType,
      updateSegmentDescription,
      updatePointDescription,
      removeMarker,
      addMarker,
      canvasRef,
      getCanvasElement,
      fillSegmentImages
    }
  }
})
</script>

<style scoped lang="scss">
:global(body),
:global(html) {
  height: 100%;
  margin: 0;
  padding: 0;
}
.home-tech-bg {
  height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #0f2027 0%, #2c5364 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 16px;
  background: rgba(15, 32, 39, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(64, 158, 255, 0.25);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
  flex-shrink: 0;
  z-index: 10;

  .brand {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    .logo {
      font-size: 1.5rem;
      color: #409eff;
      margin-right: 8px;
      filter: drop-shadow(0 2px 6px #409eff88);
    }
    .title {
      font-size: 1.1rem;
      color: #fff;
      font-weight: 600;
      letter-spacing: 1px;
      white-space: nowrap;
    }
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    flex-wrap: wrap;
    overflow: hidden;
  }

  .toolbar-right {
    flex-shrink: 0;
  }

  .tb-btn {
    height: 32px;
    padding: 6px 10px;
    font-size: 12px;
    span {
      margin-left: 4px;
    }
  }

  .panel-toggle-btn {
    height: 32px;
  }
}

.workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  position: relative;
}

.canvas-stage {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 6px;
  transition: flex 0.3s ease;
}

.home-canvas {
  width: 100%;
  height: 100%;
}

.side-panel-mask {
  display: none;
}

.side-panel {
  width: 360px;
  flex-shrink: 0;
  overflow: hidden;
  transition:
    width 0.3s ease,
    opacity 0.25s ease,
    transform 0.25s ease;
  border-left: 1px solid rgba(64, 158, 255, 0.2);
  background: #f7fbff;

  &.is-collapsed {
    width: 0;
    opacity: 0;
    border-left: none;
  }
}

.side-panel-inner {
  width: 360px;
  height: 100%;
  min-height: 0;
  padding: 14px;
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

.mobile-panel-header {
  display: none;
}

:deep(.diary-card) {
  width: 100%;
  box-sizing: border-box;
}

.drawer-divider {
  margin: 14px 0 10px 0;
  :deep(.el-divider__text) {
    font-size: 12px;
    font-weight: 600;
    color: #606266;
    background: #f7fbff;
  }
}

@media (max-width: 1200px) {
  .top-toolbar {
    .brand .title {
      display: none;
    }
    .tb-btn {
      padding: 6px 8px;
      span {
        display: none;
      }
    }
    .panel-toggle-btn span {
      display: inline;
    }
  }
  .side-panel {
    width: 300px;
  }
  .side-panel-inner {
    width: 300px;
  }
}

@media (max-width: 768px) {
  .home-tech-bg {
    height: 100dvh;
  }

  .top-toolbar {
    padding: 6px 8px;
    gap: 8px;
    .brand .logo {
      font-size: 1.3rem;
      margin-right: 0;
    }
    .actions {
      gap: 4px;
    }
    .tb-btn {
      height: 30px;
      padding: 4px 6px;
    }
  }

  .canvas-stage {
    padding: 4px;
  }

  .side-panel-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(0, 0, 0, 0.28);
  }

  .side-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(92vw, 420px);
    z-index: 100;
    border-left: 1px solid rgba(64, 158, 255, 0.25);
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    transform: translateX(0);

    &.is-collapsed {
      width: min(92vw, 420px);
      opacity: 0;
      border-left: none;
      transform: translateX(100%);
      pointer-events: none;
    }
  }

  .side-panel-inner {
    width: min(92vw, 420px);
    height: 100dvh;
    padding: 10px;
    padding-top: calc(10px + env(safe-area-inset-top));
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
  }

  .mobile-panel-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: -10px -10px 10px;
    padding: 10px;
    background: #f7fbff;
    border-bottom: 1px solid rgba(64, 158, 255, 0.15);
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .drawer-divider {
    margin: 10px 0 8px;
  }
}
</style>
