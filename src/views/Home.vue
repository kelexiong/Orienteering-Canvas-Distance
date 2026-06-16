<template>
  <div class="home-tech-bg">
    <header class="top-toolbar animate__animated animate__fadeInDown">
      <div class="brand">
        <el-icon class="logo"><Compass /></el-icon>
        <span class="title">定向越野绘图笔记</span>
      </div>
      <div class="actions desktop-actions">
        <el-button :type="drawing ? 'warning' : 'success'" @click="onToggleDrawing" class="tb-btn">
          <el-icon><Edit /></el-icon>
          <span>{{ drawing ? '结束绘制' : '开始绘制' }}</span>
        </el-button>
        <el-popconfirm title="确定要清空所有轨迹吗？" @confirm="clearPoints">
          <template #reference>
            <el-button type="danger" class="tb-btn">
              <el-icon><Delete /></el-icon>
              <span>清空</span>
            </el-button>
          </template>
        </el-popconfirm>
        <el-button class="tb-btn" :disabled="!canUndo" title="撤销 Ctrl+Z" @click="undo">
          <el-icon><RefreshLeft /></el-icon>
          <span>撤销</span>
        </el-button>
        <el-button class="tb-btn" :disabled="!canRedo" title="重做 Ctrl+Y" @click="redo">
          <el-icon><RefreshRight /></el-icon>
          <span>重做</span>
        </el-button>
        <el-button type="info" class="tb-btn" @click="triggerImageUpload">
          <el-icon><Picture /></el-icon>
          <span>插图</span>
        </el-button>
        <el-button type="warning" class="tb-btn" @click="rotateImage">
          <el-icon><Refresh /></el-icon>
          <span>旋转</span>
        </el-button>
        <el-button class="tb-btn" @click="drawMode = drawMode === 'line' ? 'curve' : 'line'">
          <el-icon><Connection /></el-icon>
          <span>{{ drawMode === 'line' ? '曲线' : '直线' }}</span>
        </el-button>
        <el-button
          :type="landmarkMode ? 'primary' : 'default'"
          class="tb-btn"
          @click="toggleLandmarkMode"
        >
          <el-icon><LocationFilled /></el-icon>
          <span>{{ landmarkMode ? '图钉中' : '图钉' }}</span>
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
          @click="togglePanel"
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
          :scale-enabled="scaleEnabled"
          :pointSizeNuber="pointSizeNuber"
          :landmarkSizeNuber="landmarkSizeNuber"
          :LineWidthNuber="LineWidthNuber"
          :arrowSizeNuber="arrowSizeNuber"
          :track-opacity="trackOpacity"
          :markerOpacity="markerOpacity"
          :route-distance-opacity="routeDistanceOpacity"
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

      <div v-if="isMobile && panelDrawerVisible" class="side-panel-mask" @click="closePanel"></div>

      <aside
        class="side-panel"
        :class="{
          'is-collapsed': !panelDrawerVisible,
          'is-mobile-full': isMobile && mobilePanelState === 'full'
        }"
      >
        <div class="side-panel-inner">
          <div class="mobile-panel-header">
            <button class="sheet-handle" type="button" @click="toggleMobilePanelSize"></button>
            <span>记录面板</span>
            <div class="mobile-panel-actions">
              <el-button size="small" text type="primary" @click="toggleMobilePanelSize">
                {{ mobilePanelState === 'full' ? '半屏' : '全屏' }}
              </el-button>
              <el-button size="small" text type="primary" @click="closePanel">收起</el-button>
            </div>
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
            :track-opacity="trackOpacity"
            :marker-opacity="markerOpacity"
            :route-distance-opacity="routeDistanceOpacity"
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
            @update:track-opacity="trackOpacity = $event"
            @update:marker-opacity="markerOpacity = $event"
            @update:route-distance-opacity="routeDistanceOpacity = $event"
          />
          <el-divider class="drawer-divider">轨迹记录</el-divider>
          <DiaryList
            :segment="segments[currentSegment]"
            :scale-enabled="scaleEnabled"
            :map-scale-denominator="mapScaleDenominator"
            :orientation="orientation"
            :segment-index="currentSegment"
            :all-segments="segments"
            :landmark-size="landmarkSizeNuber"
            :canvas-element="getCanvasElement()"
            :capture-segment-image="captureSegmentImageForExport"
            :capture-segment-group-image="captureSegmentGroupImageForExport"
            @remove-point="removePoint"
            @insert-point-mode="onInsertPointMode"
            @edit-point-mode="onEditPointMode"
            @toggle-type="togglePointType"
            :landmark-mode="landmarkMode"
            :drawing="drawing"
            @update-segment-description="updateSegmentDescription"
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

    <nav class="mobile-bottom-toolbar" aria-label="移动端绘图工具">
      <button
        type="button"
        class="mobile-tool"
        :class="{ active: activeInteractionMode === 'view' }"
        @click="setInteractionMode('view')"
      >
        <el-icon><View /></el-icon>
        <span>查看</span>
      </button>
      <button
        type="button"
        class="mobile-tool"
        :class="{ active: activeInteractionMode === 'draw' }"
        @click="setInteractionMode('draw')"
      >
        <el-icon><Edit /></el-icon>
        <span>{{ drawing ? '结束' : '绘制' }}</span>
      </button>
      <button
        type="button"
        class="mobile-tool"
        :class="{ active: activeInteractionMode === 'landmark' }"
        @click="setInteractionMode('landmark')"
      >
        <el-icon><LocationFilled /></el-icon>
        <span>图钉</span>
      </button>
      <button type="button" class="mobile-tool" :disabled="!canUndo" @click="undo">
        <el-icon><RefreshLeft /></el-icon>
        <span>撤销</span>
      </button>
      <button type="button" class="mobile-tool" :disabled="!canRedo" @click="redo">
        <el-icon><RefreshRight /></el-icon>
        <span>重做</span>
      </button>
      <button
        type="button"
        class="mobile-tool"
        :class="{ active: panelDrawerVisible }"
        @click="togglePanel"
      >
        <el-icon><Operation /></el-icon>
        <span>记录</span>
      </button>
      <el-dropdown trigger="click" placement="top-end">
        <button type="button" class="mobile-tool">
          <el-icon><MoreFilled /></el-icon>
          <span>更多</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="triggerImageUpload">插入地图</el-dropdown-item>
            <el-dropdown-item @click="rotateImage">旋转地图</el-dropdown-item>
            <el-dropdown-item @click="drawMode = drawMode === 'line' ? 'curve' : 'line'">
              切换为{{ drawMode === 'line' ? '曲线' : '直线' }}
            </el-dropdown-item>
            <el-dropdown-item @click="addSegmentGroup">新增分段</el-dropdown-item>
            <el-dropdown-item divided @click="confirmClearPoints">清空轨迹</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </nav>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted, toRaw } from 'vue'
import Canvas from '../components/Canvas.vue'
import DiaryList from '../components/DiaryList.vue'
import ControlPanel from '../components/ControlPanel.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Compass,
  Menu,
  Edit,
  Delete,
  Picture,
  Refresh,
  RefreshLeft,
  RefreshRight,
  Connection,
  LocationFilled,
  Plus,
  Operation,
  View,
  MoreFilled
} from '@element-plus/icons-vue'
import type { Segment, Point, Marker } from '../types'
import { MAP_SCALE_PRESETS } from '../utils/mapScale'
import { createSegment, buildSegmentGroups } from '../utils/segment'

type DrawMode = 'line' | 'curve'

interface HistorySnapshot {
  segments: Segment[]
  currentSegment: number
  drawing: boolean
  landmarkMode: boolean
  insertMode: { segIdx: number; ptIdx: number } | null
  editMode: { segIdx: number; ptIdx: number } | null
  drawMode: DrawMode
  imageSrc: string | null
  imageRotation: number
}

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
    RefreshLeft,
    RefreshRight,
    Connection,
    LocationFilled,
    Plus,
    Operation,
    View,
    MoreFilled
  },
  setup() {
    const drawing = ref(false)
    const imageSrc = ref<string | null>(null)
    const fileInput = ref<HTMLInputElement | null>(null)
    const canvasRef = ref<any>(null)
    const loading = ref(false)
    const drawMode = ref<DrawMode>('line')
    const showLandscapeTip = ref(false)

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
    const historyLimit = 80
    const undoStack = ref<HistorySnapshot[]>([])
    const redoStack = ref<HistorySnapshot[]>([])
    const lastHistoryKey = ref<string | null>(null)

    const cloneValue = <T,>(value: T): T => structuredClone(toRaw(value))

    const createHistorySnapshot = (): HistorySnapshot => ({
      segments: cloneValue(segments.value),
      currentSegment: currentSegment.value,
      drawing: drawing.value,
      landmarkMode: landmarkMode.value,
      insertMode: cloneValue(insertMode.value),
      editMode: cloneValue(editMode.value),
      drawMode: drawMode.value,
      imageSrc: imageSrc.value,
      imageRotation: imageRotation.value
    })

    const restoreHistorySnapshot = (snapshot: HistorySnapshot) => {
      segments.value = cloneValue(snapshot.segments)
      currentSegment.value = Math.min(
        Math.max(snapshot.currentSegment, 0),
        Math.max(segments.value.length - 1, 0)
      )
      drawing.value = snapshot.drawing
      landmarkMode.value = snapshot.landmarkMode
      insertMode.value = cloneValue(snapshot.insertMode)
      editMode.value = cloneValue(snapshot.editMode)
      drawMode.value = snapshot.drawMode
      imageSrc.value = snapshot.imageSrc
      imageRotation.value = snapshot.imageRotation
    }

    const recordHistory = (key?: string, mergeConsecutive = false) => {
      if (mergeConsecutive && key && lastHistoryKey.value === key) return
      undoStack.value.push(createHistorySnapshot())
      if (undoStack.value.length > historyLimit) undoStack.value.shift()
      redoStack.value = []
      lastHistoryKey.value = mergeConsecutive ? (key ?? null) : null
    }

    const canUndo = computed(() => undoStack.value.length > 0)
    const canRedo = computed(() => redoStack.value.length > 0)

    const undo = () => {
      const snapshot = undoStack.value.pop()
      if (!snapshot) return
      redoStack.value.push(createHistorySnapshot())
      restoreHistorySnapshot(snapshot)
      lastHistoryKey.value = null
    }

    const redo = () => {
      const snapshot = redoStack.value.pop()
      if (!snapshot) return
      undoStack.value.push(createHistorySnapshot())
      restoreHistorySnapshot(snapshot)
      lastHistoryKey.value = null
    }

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
      recordHistory('add-point')
      const type = drawMode.value
      const newPoint: Point = {
        ...point,
        type,
        timestamp: new Date()
      }

      if (editMode.value) {
        const { segIdx, ptIdx } = editMode.value
        const old = segments.value[segIdx].points[ptIdx]
        segments.value[segIdx].points.splice(ptIdx, 1, { ...newPoint, type: old.type })
        segments.value[segIdx].updatedAt = new Date()
        editMode.value = null
        drawing.value = false
      } else if (insertMode.value) {
        const { segIdx, ptIdx } = insertMode.value
        segments.value[segIdx].points.splice(ptIdx, 0, newPoint)
        segments.value[segIdx].updatedAt = new Date()
        insertMode.value = null
        drawing.value = false
      } else if (segments.value[currentSegment.value].points.length === 0) {
        segments.value[currentSegment.value].points.push({ ...newPoint, type: undefined })
        segments.value[currentSegment.value].updatedAt = new Date()
      } else {
        segments.value[currentSegment.value].points.push(newPoint)
        segments.value[currentSegment.value].updatedAt = new Date()
      }
    }

    const removePoint = (segIdx: number, ptIdx: number) => {
      if (segments.value[segIdx] && segments.value[segIdx].points[ptIdx] !== undefined) {
        recordHistory('remove-point')
        resumeSegmentEditing(segIdx)
        segments.value[segIdx].points.splice(ptIdx, 1)
        segments.value[segIdx].updatedAt = new Date()
        if (segments.value[segIdx].points.length === 0 && segments.value.length > 1) {
          segments.value.splice(segIdx, 1)
          if (currentSegment.value >= segments.value.length) {
            currentSegment.value = segments.value.length - 1
          }
        }
      }
    }

    const clearPoints = () => {
      recordHistory('clear-points')
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

    const confirmClearPoints = async () => {
      try {
        await ElMessageBox.confirm('确定要清空所有轨迹吗？', '清空轨迹', {
          confirmButtonText: '清空',
          cancelButtonText: '取消',
          type: 'warning'
        })
        clearPoints()
      } catch {
        // 用户取消时不做处理。
      }
    }

    const cacheSegmentImage = async (idx: number) => {
      if (canvasRef.value?.captureSegmentImage && segments.value[idx]) {
        const image = await canvasRef.value.captureSegmentImage(idx)
        if (image) segments.value[idx].image = image
      }
    }

    const finishCurrentSegment = async (shouldRecordHistory = true) => {
      const seg = segments.value[currentSegment.value]
      if (!seg || seg.finished) return
      if (seg.points.length < 2) {
        ElMessage.warning('至少需要 2 个点才能结束分段')
        return
      }
      if (shouldRecordHistory) recordHistory('finish-segment')
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
        ElMessage.warning('请先结束实际跑动路线，再添加对比路线')
        return
      }
      const cur = segments.value[currentSegment.value]
      if (cur && drawing.value && cur.points.length > 0) {
        recordHistory('add-compare-route')
        await finishCurrentSegment(false)
      } else {
        recordHistory('add-compare-route')
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
      recordHistory('add-segment-group')
      if (cur && drawing.value && cur.points.length > 0) {
        await finishCurrentSegment(false)
      } else if (cur && !cur.finished && cur.points.length >= 2) {
        await finishCurrentSegment(false)
      }
      const groupId = `group-${Date.now()}`
      const groupCount = new Set(segments.value.map(s => s.groupId)).size
      const newSeg = createSegment({
        name: `实际路线${groupCount + 1}`,
        trackRole: 'actual',
        groupId
      })
      segments.value.push(newSeg)
      currentSegment.value = segments.value.length - 1
      drawing.value = false
      landmarkMode.value = false
      ElMessage.success(`已新增分段 ${groupCount + 1}`)
    }

    const updateSegmentColor = (segIdx: number, color: string) => {
      if (segments.value[segIdx]) {
        recordHistory(`segment-color-${segIdx}`)
        segments.value[segIdx].color = color
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    const removeSegmentById = (segId: string) => {
      const idx = segments.value.findIndex(s => s.id === segId)
      if (idx === -1) return
      const seg = segments.value[idx]
      if (seg.trackRole === 'actual') return
      recordHistory('remove-segment')
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
      recordHistory('reorder-compares')
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

    const updateSegmentDescription = (segIdx: number, description: string) => {
      if (segments.value[segIdx]) {
        recordHistory(`segment-description-${segIdx}`, true)
        segments.value[segIdx].description = description
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    const updateMarkerDescription = (segIdx: number, markerId: string, content: string) => {
      const seg = segments.value[segIdx]
      if (!seg) return
      const m = seg.markers.find(x => x.id === markerId)
      if (m) {
        recordHistory(`marker-description-${segIdx}-${markerId}`, true)
        m.content = content
        seg.updatedAt = new Date()
      }
    }

    const removeMarker = (segIdx: number, markerId: string) => {
      if (segments.value[segIdx]) {
        const markerIndex = segments.value[segIdx].markers.findIndex(m => m.id === markerId)
        if (markerIndex !== -1) {
          recordHistory('remove-marker')
          segments.value[segIdx].markers.splice(markerIndex, 1)
          segments.value[segIdx].updatedAt = new Date()
        }
      }
    }

    const addMarker = (segIdx: number, marker: Omit<Marker, 'id' | 'timestamp'>) => {
      if (segments.value[segIdx]) {
        recordHistory('add-marker')
        const newMarker: Marker = {
          ...marker,
          id: Date.now().toString(),
          timestamp: new Date()
        }
        segments.value[segIdx].markers.push(newMarker)
        segments.value[segIdx].updatedAt = new Date()
      }
    }

    const orientation = ref<'landscape' | 'portrait'>('landscape')
    const imageRotation = ref(0)
    const scaleEnabled = ref(false)
    const mapScaleDenominator = ref(10000)
    const mapScalePresets = MAP_SCALE_PRESETS
    const landmarkMode = ref(false)
    const pointSizeNuber = ref(2)
    const landmarkSizeNuber = ref(28)
    const LineWidthNuber = ref(2)
    const arrowSizeNuber = ref(1)
    const trackOpacity = ref(1)
    const markerOpacity = ref(0.7)
    const routeDistanceOpacity = ref(0.88)
    const canvasWidth = computed(() => 842)
    const canvasHeight = computed(() => 595)

    const segmentGroups = computed(() => buildSegmentGroups(segments.value))

    const rotateImage = () => {
      recordHistory('rotate-image')
      imageRotation.value = (imageRotation.value + 90) % 360
    }

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
          recordHistory('resume-segment-editing')
          resumeSegmentEditing(currentSegment.value)
          ElMessage.info('已进入编辑模式，修改后请再次结束绘制以固定轨迹')
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
    const mobilePanelState = ref<'closed' | 'half' | 'full'>('closed')
    const activeInteractionMode = computed<'view' | 'draw' | 'landmark'>(() => {
      if (landmarkMode.value) return 'landmark'
      if (drawing.value) return 'draw'
      return 'view'
    })

    const openPanel = () => {
      panelDrawerVisible.value = true
      if (isMobile.value && mobilePanelState.value === 'closed') {
        mobilePanelState.value = 'half'
      }
    }

    const closePanel = () => {
      panelDrawerVisible.value = false
      if (isMobile.value) mobilePanelState.value = 'closed'
    }

    const togglePanel = () => {
      if (panelDrawerVisible.value) {
        closePanel()
      } else {
        openPanel()
      }
    }

    const toggleMobilePanelSize = () => {
      if (!isMobile.value) return
      if (!panelDrawerVisible.value) {
        openPanel()
        return
      }
      mobilePanelState.value = mobilePanelState.value === 'full' ? 'half' : 'full'
    }

    const setInteractionMode = async (mode: 'view' | 'draw' | 'landmark') => {
      if (mode === 'view') {
        if (drawing.value) {
          await onToggleDrawing()
        } else {
          landmarkMode.value = false
          editMode.value = null
          insertMode.value = null
        }
        return
      }

      if (mode === 'draw') {
        if (landmarkMode.value) landmarkMode.value = false
        await onToggleDrawing()
        return
      }

      if (mode === 'landmark') {
        if (drawing.value) await onToggleDrawing()
        if (!landmarkMode.value) toggleLandmarkMode()
      }
    }

    const checkMobile = () => {
      const nextIsMobile = window.innerWidth <= 768
      if (nextIsMobile && !isMobile.value) {
        closePanel()
      } else if (!nextIsMobile && isMobile.value) {
        panelDrawerVisible.value = true
        mobilePanelState.value = 'closed'
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

    const togglePointType = (segIdx: number, ptIdx: number) => {
      const pt = segments.value[segIdx].points[ptIdx]
      if (!pt) return
      recordHistory('toggle-point-type')
      resumeSegmentEditing(segIdx)
      const newType = !pt.type || pt.type === 'line' ? 'curve' : 'line'
      segments.value[segIdx].points.splice(ptIdx, 1, { ...pt, type: newType })
      segments.value[segIdx].updatedAt = new Date()
    }

    const triggerImageUpload = () => {
      loading.value = true
      fileInput.value?.click()
    }

    const onImageChange = (e: Event) => {
      const input = e.target as HTMLInputElement
      const files = input.files
      if (files && files[0]) {
        const reader = new FileReader()
        reader.onload = evt => {
          recordHistory('upload-image')
          imageSrc.value = evt.target?.result as string
          loading.value = false
          input.value = ''
        }
        reader.onerror = () => {
          loading.value = false
          input.value = ''
        }
        reader.readAsDataURL(files[0])
      } else {
        loading.value = false
      }
    }

    const onInsertPointMode = (segIdx: number, ptIdx: number) => {
      if (!segments.value[segIdx]) return
      recordHistory('insert-point-mode')
      resumeSegmentEditing(segIdx)
      insertMode.value = { segIdx, ptIdx: ptIdx + 1 }
      editMode.value = null
      drawing.value = true
    }

    const onEditPointMode = (segIdx: number, ptIdx: number) => {
      if (!segments.value[segIdx]?.points[ptIdx]) return
      recordHistory('edit-point-mode')
      resumeSegmentEditing(segIdx)
      editMode.value = { segIdx, ptIdx }
      insertMode.value = null
      drawing.value = true
    }

    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      const tag = el.tagName?.toLowerCase()
      return tag === 'input' || tag === 'textarea' || el.isContentEditable
    }

    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.metaKey || isTypingTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          if (canRedo.value) redo()
        } else if (canUndo.value) {
          undo()
        }
      } else if (key === 'y') {
        event.preventDefault()
        if (canRedo.value) redo()
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', handleHistoryShortcut)
    })
    onUnmounted(() => {
      window.removeEventListener('keydown', handleHistoryShortcut)
    })

    const getCanvasElement = () => {
      return canvasRef.value?.$refs?.canvas || canvasRef.value?.canvas || null
    }

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

    const captureSegmentImageForExport = async (idx: number) => {
      if (!canvasRef.value?.captureSegmentImage) return null
      return canvasRef.value.captureSegmentImage(idx)
    }

    const captureSegmentGroupImageForExport = async (groupId: string) => {
      if (!canvasRef.value?.captureSegmentGroupImage) return null
      return canvasRef.value.captureSegmentGroupImage(groupId)
    }

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
      triggerImageUpload,
      onImageChange,
      pointSizeNuber,
      LineWidthNuber,
      arrowSizeNuber,
      trackOpacity,
      markerOpacity,
      routeDistanceOpacity,
      drawing,
      imageSrc,
      clearPoints,
      confirmClearPoints,
      removePoint,
      addPoint,
      fileInput,
      orientation,
      imageRotation,
      rotateImage,
      onInsertPointMode,
      onEditPointMode,
      canvasWidth,
      canvasHeight,
      Canvas,
      DiaryList,
      setCurrentSegment,
      showLandscapeTip,
      panelDrawerVisible,
      isMobile,
      mobilePanelState,
      activeInteractionMode,
      setInteractionMode,
      togglePanel,
      closePanel,
      toggleMobilePanelSize,
      togglePointType,
      updateSegmentDescription,
      removeMarker,
      addMarker,
      canvasRef,
      getCanvasElement,
      fillSegmentImages,
      captureSegmentImageForExport,
      captureSegmentGroupImageForExport,
      canUndo,
      canRedo,
      undo,
      redo
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

.sheet-handle,
.mobile-bottom-toolbar {
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
    justify-content: space-between;
    .brand .logo {
      font-size: 1.3rem;
      margin-right: 0;
    }
    .brand .title {
      display: inline;
      max-width: 42vw;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .desktop-actions,
    .toolbar-right {
      display: none;
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
    padding: 4px 4px 76px;
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
    left: 0;
    right: 0;
    bottom: 0;
    top: auto;
    width: 100%;
    height: min(72dvh, 620px);
    bottom: 0;
    z-index: 100;
    border-left: none;
    border-top: 1px solid rgba(64, 158, 255, 0.25);
    border-radius: 14px 14px 0 0;
    box-shadow: 0 -4px 22px rgba(0, 0, 0, 0.3);
    transform: translateY(0);

    &.is-mobile-full {
      height: calc(100dvh - 8px);
    }

    &.is-collapsed {
      width: 100%;
      opacity: 0;
      border-top: none;
      transform: translateY(100%);
      pointer-events: none;
    }
  }

  .side-panel-inner {
    width: 100%;
    height: 100%;
    padding: 10px;
    padding-top: 8px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
  }

  .mobile-panel-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: -10px -10px 10px;
    padding: 8px 10px 10px;
    background: #f7fbff;
    border-bottom: 1px solid rgba(64, 158, 255, 0.15);
    font-size: 14px;
    font-weight: 600;
    color: #303133;
  }

  .sheet-handle {
    position: absolute;
    top: 5px;
    left: 50%;
    display: block;
    width: 42px;
    height: 4px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: #c0c4cc;
    transform: translateX(-50%);
  }

  .mobile-panel-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .drawer-divider {
    margin: 10px 0 8px;
  }

  .mobile-bottom-toolbar {
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    z-index: 80;
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    padding: 6px;
    border: 1px solid rgba(64, 158, 255, 0.22);
    border-radius: 12px;
    background: rgba(18, 32, 39, 0.92);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(10px);
  }

  .mobile-tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 52px;
    padding: 4px 2px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    color: #dcecff;
    font-size: 11px;
    line-height: 1.1;
    touch-action: manipulation;

    .el-icon {
      margin-bottom: 3px;
      font-size: 18px;
    }

    span {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &.active {
      border-color: rgba(64, 158, 255, 0.55);
      background: rgba(64, 158, 255, 0.2);
      color: #ffffff;
    }

    &:disabled {
      color: rgba(220, 236, 255, 0.38);
    }
  }
}
</style>
