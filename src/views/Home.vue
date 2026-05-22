<template>
  <div class="home-tech-bg">
    <div class="home-header animate__animated animate__fadeInDown">
      <el-icon class="logo"><Compass /></el-icon>
      <span class="title">智能定向绘图系统</span>
    </div>
    <el-container class="home-tech-container">
      <el-aside class="canvas-aside">
        <!-- <el-card class="canvas-card animate__animated animate__fadeInLeft" shadow="hover"> -->
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
          :drawing="drawing"
          :landmark-mode="landmarkMode"
          :image-src="imageSrc"
          :orientation="orientation"
          :edit-mode="editMode"
          @add-point="addPoint"
          @add-marker="onAddMarker"
          class="home-canvas"
          ref="canvasRef"
        />
        <!-- </el-card> -->
      </el-aside>
      <el-main class="panel-main">
        <!-- PC端操作面板 -->
        <el-card
          class="panel-card animate__animated animate__fadeInRight"
          shadow="hover"
          v-if="!isMobile"
        >
          <ControlPanel
            :drawing="drawing"
            :draw-mode="drawMode"
            :orientation="orientation"
            :landmark-mode="landmarkMode"
            :current-segment="currentSegment"
            :segments="segments"
            v-model:scale-enabled="scaleEnabled"
            v-model:map-scale-denominator="mapScaleDenominator"
            :point-size="pointSizeNuber"
            :line-width="LineWidthNuber"
            :landmark-size="landmarkSizeNuber"
            :segment-groups="segmentGroups"
            @toggle-drawing="onToggleDrawing"
            @clear-points="clearPoints"
            @upload-image="triggerImageUpload"
            @toggle-orientation="toggleOrientation"
            @toggle-draw-mode="drawMode = drawMode === 'line' ? 'curve' : 'line'"
            @toggle-landmark-mode="toggleLandmarkMode"
            @add-compare-route="addCompareRoute"
            @add-segment-group="addSegmentGroup"
            @switch-segment="setCurrentSegment"
            @update-segment-color="updateSegmentColor"
            @update:point-size="pointSizeNuber = $event"
            @update:line-width="LineWidthNuber = $event"
            @update:landmark-size="landmarkSizeNuber = $event"
          />
        </el-card>
        <!-- 移动端操作面板Drawer -->
        <el-drawer
          v-model="drawerVisible"
          direction="rtl"
          size="90vw"
          :with-header="false"
          class="panel-drawer animate__animated animate__slideInRight"
        >
          <el-card class="panel-card animate__animated animate__fadeInUp" shadow="hover">
            <ControlPanel
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
              @toggle-drawing="onToggleDrawing"
              @clear-points="clearPoints"
              @upload-image="triggerImageUpload"
              @toggle-orientation="toggleOrientation"
              @toggle-draw-mode="drawMode = drawMode === 'line' ? 'curve' : 'line'"
              @toggle-landmark-mode="toggleLandmarkMode"
              @add-compare-route="addCompareRoute"
              @add-segment-group="addSegmentGroup"
              @switch-segment="setCurrentSegment"
              @update-segment-color="updateSegmentColor"
              @update:point-size="pointSizeNuber = $event"
              @update:line-width="LineWidthNuber = $event"
              @update:landmark-size="landmarkSizeNuber = $event"
            />
          </el-card>
        </el-drawer>
        <!-- 移动端操作按钮 -->
        <el-button
          class="drawer-btn animate__animated animate__bounceIn"
          type="primary"
          icon="Menu"
          circle
          size="large"
          @click="drawerVisible = !drawerVisible"
          v-if="isMobile"
        />
        <!-- 点位列表 -->
        <el-card class="pointlist-card animate__animated animate__fadeInUp" shadow="hover">
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
        </el-card>
      </el-main>
    </el-container>

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
import { Compass, Menu } from '@element-plus/icons-vue'
import type { Segment, Point, Marker } from '../types'
import { MAP_SCALE_PRESETS } from '../utils/mapScale'
import { createSegment, buildSegmentGroups } from '../utils/segment'

export default defineComponent({
  components: {
    Canvas,
    DiaryList,
    ControlPanel,
    Compass,
    Menu
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
      const gid =
        groupId || segments.value[currentSegment.value]?.groupId
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
    const scaleEnabled = ref(false)
    const mapScaleDenominator = ref(10000)
    const mapScalePresets = MAP_SCALE_PRESETS
    const landmarkMode = ref(false)
    const pointSizeNuber = ref(2)
    const landmarkSizeNuber = ref(10)
    const LineWidthNuber = ref(2)
    const canvasWidth = computed(() => {
      return orientation.value === 'landscape' ? 842 : 595
    })

    const canvasHeight = computed(() => {
      return orientation.value === 'landscape' ? 595 : 842
    })

    const segmentGroups = computed(() => buildSegmentGroups(segments.value))

    const toggleOrientation = () => {
      orientation.value = orientation.value === 'landscape' ? 'portrait' : 'landscape'
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

    // 横屏检测与自动横屏
    function checkOrientation() {
      if (window.innerWidth < window.innerHeight) {
        showLandscapeTip.value = true
        // 尝试自动横屏
        if (screen.orientation && (screen.orientation as any).lock) {
          ;(screen.orientation as any).lock('landscape').catch(() => {})
        }
      } else {
        showLandscapeTip.value = false
      }
    }
    onMounted(() => {
      checkOrientation()
      window.addEventListener('resize', checkOrientation)
    })
    onUnmounted(() => {
      window.removeEventListener('resize', checkOrientation)
    })

    const drawerVisible = ref(false)
    const isMobile = ref(false)
    // 响应式判断
    const checkMobile = () => {
      isMobile.value = window.innerWidth <= 768
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
      drawing,
      imageSrc,
      clearPoints,
      removePoint,
      addPoint,
      fileInput,
      orientation,
      toggleOrientation,
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
      drawerVisible,
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
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #0f2027 0%, #2c5364 100%);
  padding: 0;
}
.home-header {
  display: flex;
  align-items: center;
  padding: 32px 0 16px 0;
  justify-content: center;
  .logo {
    font-size: 2.5rem;
    color: #409eff;
    margin-right: 12px;
    filter: drop-shadow(0 2px 8px #409eff88);
  }
  .title {
    font-size: 2rem;
    color: #fff;
    font-weight: bold;
    letter-spacing: 2px;
    text-shadow: 0 2px 8px #409eff44;
  }
}
.home-tech-container {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 120px);
  margin: 0 0.8rem;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(64, 158, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  padding: 20px;
}
.canvas-aside {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}
.canvas-card {
  border-radius: 18px;
  box-shadow: 0 4px 24px #409eff22;
  border: 2px solid #409eff44;
  background: #fff;
  padding: 18px 12px;
  width: 100%;
  // max-width: 800px;
}
.panel-main {
  flex: 1;
  flex-shrink: 0;
  padding: 32px 32px 32px 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  // max-height: calc(100vh - 200px);
  overflow-y: auto;
}
.panel-card {
  border-radius: 16px;
  box-shadow: 0 2px 12px #409eff22;
  background: #f7fbff;
  margin-bottom: 18px;
  padding: 14px 12px;
}
.pointlist-card {
  border-radius: 16px;
  box-shadow: 0 2px 12px #409eff22;
  background: #fff;
  margin-bottom: 18px;
  padding: 12px 10px;
  min-height: 280px;
  max-height: min(55vh, 520px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
.drawer-btn {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  box-shadow: 0 2px 8px #409eff44;
}
.panel-drawer {
  background: #f7fbff;
}
@media (max-width: 1400px) {
  .home-tech-container {
    max-width: 100vw;
  }
  .canvas-aside {
    max-width: 100vw;
    min-width: 0;
    padding-left: 8px;
  }
  .panel-main {
    width: 340px;
    min-width: 300px;
    padding-right: 8px;
  }
}
@media (max-width: 900px) {
  .home-tech-container {
    flex-direction: column !important;
    max-width: 100%;
    border-radius: 0;
    box-shadow: none;
    min-height: auto;
    margin: 0;
    padding: 10px;
  }
  .canvas-aside,
  .panel-main {
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    padding: 10px !important;
  }
  .panel-main {
    max-height: none;
    overflow-y: visible;
  }
}
@media (max-width: 768px) {
  .home-header {
    padding: 18px 0 8px 0;
    .logo {
      font-size: 2rem;
    }
    .title {
      font-size: 1.2rem;
    }
  }
  .canvas-card {
    padding: 8px 2px;
    border-radius: 12px;
    max-width: 100vw;
  }
  .panel-main {
    min-width: 0;
    max-width: 100vw;
    padding: 0;
    gap: 12px;
  }
  .panel-card,
  .pointlist-card {
    border-radius: 12px;
    margin-bottom: 10px;
    padding: 10px 4px;
  }
  .drawer-btn {
    bottom: 18px;
    right: 18px;
  }
}
</style>
