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
          :scale="scale"
          :drawing="drawing"
          :image-src="imageSrc"
          :orientation="orientation"
          :edit-mode="editMode"
          @add-point="addPoint"
          @add-marker="addMarker"
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
          <div class="panel-section">
            <el-button
              size="large"
              type="success"
              @click="drawing = !drawing"
              class="animate__animated animate__pulse animate__infinite"
            >
              <el-icon><Edit /></el-icon>
              {{ drawing ? '结束绘制' : '开始绘制' }}
            </el-button>
            <el-popconfirm title="确定要清除所有点位吗？" @confirm="clearPoints">
              <template #reference>
                <el-button size="large" type="danger">
                  <el-icon><Delete /></el-icon>
                  清除点位
                </el-button>
              </template>
            </el-popconfirm>
            <el-button size="large" type="info" @click="triggerImageUpload">
              <el-icon><Picture /></el-icon>
              插入图片
            </el-button>
            <el-button size="large" type="warning" @click="toggleOrientation">
              <el-icon><Refresh /></el-icon>
              切换为{{ orientation === 'landscape' ? '纵向' : '横向' }}
            </el-button>
            <el-button size="large" @click="drawMode = drawMode === 'line' ? 'curve' : 'line'">
              <el-icon><Connection /></el-icon>
              切换为{{ drawMode === 'line' ? '曲线' : '直线' }}
            </el-button>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="onImageChange"
            />
          </div>
          <el-divider />
          <div class="segment-toolbar">
            <el-button type="primary" @click="addSegment" plain>新增分段</el-button>
            <el-button
              v-for="(seg, idx) in segments"
              :key="idx"
              :type="idx === currentSegment ? 'primary' : 'default'"
              @click="setCurrentSegment(idx)"
              style="margin-left: 8px"
            >
              分段{{ idx + 1 }}
            </el-button>
          </div>
          <el-form class="home-scale-input" inline>
            <el-form-item label="比例尺">
              <el-input-number v-model="scale" :min="0.01" :step="0.01" />
            </el-form-item>
          </el-form>
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
            <div class="panel-section">
              <el-button
                size="large"
                type="success"
                @click="drawing = !drawing"
                class="animate__animated animate__pulse animate__infinite"
              >
                <el-icon><Edit /></el-icon>
                {{ drawing ? '结束绘制' : '开始绘制' }}
              </el-button>
              <el-popconfirm title="确定要清除所有点位吗？" @confirm="clearPoints">
                <template #reference>
                  <el-button size="large" type="danger">
                    <el-icon><Delete /></el-icon>
                    清除点位
                  </el-button>
                </template>
              </el-popconfirm>
              <el-button size="large" type="info" @click="triggerImageUpload">
                <el-icon><Picture /></el-icon>
                插入图片
              </el-button>
              <el-button size="large" type="warning" @click="toggleOrientation">
                <el-icon><Refresh /></el-icon>
                切换为{{ orientation === 'landscape' ? '纵向' : '横向' }}
              </el-button>
              <el-button size="large" @click="drawMode = drawMode === 'line' ? 'curve' : 'line'">
                <el-icon><Connection /></el-icon>
                切换为{{ drawMode === 'line' ? '曲线' : '直线' }}
              </el-button>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onImageChange"
              />
            </div>
            <el-divider />
            <div class="segment-toolbar">
              <el-button type="primary" @click="addSegment" plain>新增分段</el-button>
              <el-button
                v-for="(seg, idx) in segments"
                :key="idx"
                :type="idx === currentSegment ? 'primary' : 'default'"
                @click="setCurrentSegment(idx)"
                style="margin-left: 8px"
              >
                分段{{ idx + 1 }}
              </el-button>
            </div>
            <el-form class="home-scale-input" inline>
              <el-form-item label="比例尺">
                <el-input-number v-model="scale" :min="0.01" :step="0.01" />
              </el-form-item>
            </el-form>
          </el-card>
        </el-drawer>
        <!-- 移动端操作按钮 -->
        <el-button
          class="drawer-btn animate__animated animate__bounceIn"
          type="primary"
          icon="Menu"
          circle
          size="large"
          @click="drawerVisible = true"
          v-if="isMobile"
        />
        <!-- 点位列表 -->
        <el-card class="pointlist-card animate__animated animate__fadeInUp" shadow="hover">
          <DiaryList
            :segment="segments[currentSegment]"
            :scale="scale"
            :segment-index="currentSegment"
            :all-segments="segments"
            :canvas-element="getCanvasElement()"
            @remove-point="removePoint"
            @insert-point-mode="onInsertPointMode"
            @edit-point-mode="onEditPointMode"
            @toggle-type="togglePointType"
            @update-segment-description="updateSegmentDescription"
            @update-point-description="updatePointDescription"
            @remove-marker="removeMarker"
          />
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Canvas from '../components/Canvas.vue'
import DiaryList from '../components/DiaryList.vue'
import { Compass, Edit, Delete, Picture, Refresh, Connection, Menu } from '@element-plus/icons-vue'
import type { Segment, Point, Marker } from '../types'

export default defineComponent({
  components: {
    Canvas,
    DiaryList,
    Compass,
    Edit,
    Delete,
    Picture,
    Refresh,
    Connection,
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
      {
        id: '1',
        name: '分段1',
        points: [],
        markers: [],
        description: '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])
    const currentSegment = ref(0)
    const insertMode = ref<{ segIdx: number; ptIdx: number } | null>(null)
    const editMode = ref<{ segIdx: number; ptIdx: number } | null>(null)

    const addPoint = (point: { x: number; y: number }) => {
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
        if (!segments.value[currentSegment.value]) {
          segments.value[currentSegment.value] = {
            id: Date.now().toString(),
            name: `分段${currentSegment.value + 1}`,
            points: [],
            markers: [],
            description: '',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }
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
        {
          id: '1',
          name: '分段1',
          points: [],
          markers: [],
          description: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      currentSegment.value = 0
    }

    const addSegment = () => {
      // 缓存当前画布截图到当前分段
      const canvasEl = getCanvasElement()
      if (canvasEl && segments.value[currentSegment.value]) {
        segments.value[currentSegment.value].image = canvasEl.toDataURL('image/png')
      }
      // 新增分段
      const newSegment: Segment = {
        id: Date.now().toString(),
        name: `分段${segments.value.length + 1}`,
        points: [],
        markers: [],
        description: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        image: '' // 新分段初始无截图
      }
      segments.value.push(newSegment)
      currentSegment.value = segments.value.length - 1
    }

    const setCurrentSegment = (idx: number) => {
      // 切换前，缓存当前分段的 image
      const canvasEl = getCanvasElement()
      if (canvasEl && segments.value[currentSegment.value]) {
        segments.value[currentSegment.value].image = canvasEl.toDataURL('image/png')
      }
      if (idx >= 0 && idx < segments.value.length) {
        currentSegment.value = idx
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
    const scale = ref(1)

    const canvasWidth = computed(() => {
      return orientation.value === 'landscape' ? 842 : 595
    })

    const canvasHeight = computed(() => {
      return orientation.value === 'landscape' ? 595 : 842
    })

    const toggleOrientation = () => {
      orientation.value = orientation.value === 'landscape' ? 'portrait' : 'landscape'
    }

    // 监听模式变化，动态修改 body 的 cursor
    const isEditOrInsertMode = computed(() => !!editMode.value || !!insertMode.value)
    watch(isEditOrInsertMode, val => {
      document.body.style.cursor = val ? 'crosshair' : ''
    })

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
      const pt = segments.value[segIdx].points[ptIdx]
      if (!pt) return
      const newType = !pt.type || pt.type === 'line' ? 'curve' : 'line'
      segments.value[segIdx].points.splice(ptIdx, 1, { ...pt, type: newType })
    }

    // 获取canvas元素
    const getCanvasElement = () => {
      // 在选项式API中，通过$refs访问组件实例
      return canvasRef.value?.$refs?.canvas || canvasRef.value?.canvas || null
    }

    // 补全所有分段的image，确保每个分段都有截图
    const fillSegmentImages = () => {
      const canvasEl = getCanvasElement()
      if (!canvasEl) return
      segments.value.forEach((seg, idx) => {
        if (!seg.image && seg.points.length > 0) {
          seg.image = canvasEl.toDataURL('image/png')
        }
      })
    }

    // 在返回值中添加_segments用于模板绑定
    return {
      segments,
      currentSegment,
      insertMode,
      editMode,
      loading,
      drawMode,
      scale,
      drawing,
      imageSrc,
      clearPoints,
      removePoint,
      addSegment,
      addPoint,
      triggerImageUpload: () => {
        fileInput.value?.click()
        loading.value = true // 激活加载状态
      },
      onImageChange: (e: Event) => {
        const files = (e.target as HTMLInputElement).files
        if (files && files[0]) {
          const reader = new FileReader()
          reader.onload = evt => {
            imageSrc.value = evt.target?.result as string
            loading.value = false // 图片加载完成，关闭加载状态
          }
          reader.readAsDataURL(files[0])
        }
      },
      fileInput,
      orientation,
      toggleOrientation,
      onInsertPointMode: (segIdx: number, ptIdx: number) => {
        insertMode.value = { segIdx, ptIdx: ptIdx + 1 }
        editMode.value = null
        drawing.value = true // 可选，自动开启绘制
      },
      onEditPointMode: (segIdx: number, ptIdx: number) => {
        editMode.value = { segIdx, ptIdx }
        insertMode.value = null
        drawing.value = true // 可选，自动开启绘制
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
  padding: 18px 12px;
}
.panel-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.segment-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.home-scale-input {
  margin-top: 12px;
  .el-input-number {
    width: 100%;
    font-size: 16px;
  }
}
.pointlist-card {
  border-radius: 16px;
  box-shadow: 0 2px 12px #409eff22;
  background: #fff;
  margin-bottom: 18px;
  padding: 18px 12px;
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
    width: 320px;
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
  .panel-section {
    gap: 10px;
  }
  .segment-toolbar {
    gap: 4px;
    .el-button {
      width: 48%;
      min-width: 90px;
      font-size: 14px;
    }
  }
  .drawer-btn {
    bottom: 18px;
    right: 18px;
  }
}
</style>
