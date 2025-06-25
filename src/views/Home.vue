<template>
  <div class="home-tech-bg">
    <div class="home-header animate__animated animate__fadeInDown">
      <el-icon class="logo"><Compass /></el-icon>
      <span class="title">智能定向绘图系统</span>
    </div>
    <el-container class="home-tech-container">
      <el-aside class="canvas-aside">
        <el-card class="canvas-card animate__animated animate__fadeInLeft" shadow="hover">
          <Canvas
            :segments="segments"
            :draw-mode="drawMode"
            :size="canvasSize"
            :width="canvasWidth"
            :height="canvasHeight"
            :current-segment="currentSegment"
            :scale="scale"
            :drawing="drawing"
            :image-src="imageSrc"
            :orientation="orientation"
            :edit-mode="editMode"
            @add-point="addPoint"
            class="home-canvas"
          />
        </el-card>
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
          <PointList
            :points="segments[currentSegment]"
            :scale="scale"
            :segment-index="currentSegment"
            @remove-point="removePoint"
            @insert-point-mode="onInsertPointMode"
            @edit-point-mode="onEditPointMode"
            @toggle-type="togglePointType"
          />
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Canvas from '../components/Canvas.vue'
import PointList from '../components/PointList.vue'
import { Compass, Edit, Delete, Picture, Refresh, Connection, Menu } from '@element-plus/icons-vue'

export default defineComponent({
  components: { Canvas, PointList, Compass, Edit, Delete, Picture, Refresh, Connection, Menu },
  setup() {
    const drawing = ref(false)
    const imageSrc = ref<string | null>(null)
    const fileInput = ref<HTMLInputElement | null>(null)
    const loading = ref(false) // 加载状态
    const drawMode = ref<'line' | 'curve'>('line')
    const showLandscapeTip = ref(false)

    // 自定义Hook管理点位逻辑
    const segments = ref<Array<Array<{ x: number; y: number; type?: string }>>>([[]]) // 至少有一个分段
    const currentSegment = ref(0)
    const insertMode = ref<{ segIdx: number; ptIdx: number } | null>(null)
    const editMode = ref<{ segIdx: number; ptIdx: number } | null>(null)

    const addPoint = (point: { x: number; y: number }) => {
      const type = drawMode.value // 'line' 或 'curve'
      if (editMode.value) {
        // 编辑模式
        const { segIdx, ptIdx } = editMode.value
        const old = segments.value[segIdx][ptIdx]
        segments.value[segIdx].splice(ptIdx, 1, { ...point, type: old.type })
        editMode.value = null
        drawing.value = false
      } else if (insertMode.value) {
        // 插入模式
        const { segIdx, ptIdx } = insertMode.value
        segments.value[segIdx].splice(ptIdx, 0, { ...point, type })
        insertMode.value = null
        drawing.value = false
      } else {
        // 普通追加
        if (!segments.value[currentSegment.value]) {
          segments.value[currentSegment.value] = []
        }
        if (segments.value[currentSegment.value].length === 0) {
          segments.value[currentSegment.value].push({ ...point })
        } else {
          segments.value[currentSegment.value].push({ ...point, type })
        }
      }
    }

    const updatePoint = (segIdx: number, ptIdx: number, newPoint: { x: number; y: number }) => {
      const old = segments.value[segIdx][ptIdx]
      segments.value[segIdx].splice(ptIdx, 1, { ...newPoint, type: old.type })
      console.log('updatePoint', segments.value)
    }

    const removePoint = (segIdx, ptIdx) => {
      if (segments.value[segIdx] && segments.value[segIdx][ptIdx] !== undefined) {
        segments.value[segIdx].splice(ptIdx, 1)
        // 如果分段被删空，且不是唯一分段，则自动删除该分段
        if (segments.value[segIdx].length === 0 && segments.value.length > 1) {
          segments.value.splice(segIdx, 1)
          // 修正 currentSegment
          if (currentSegment.value >= segments.value.length) {
            currentSegment.value = segments.value.length - 1
          }
        }
      }
    }

    const insertPoint = (segIdx, ptIdx, point) => {
      if (segments.value[segIdx]) {
        segments.value[segIdx].splice(ptIdx, 0, point)
      }
    }

    const clearPoints = () => {
      segments.value = [[]]
      currentSegment.value = 0
    }

    const addSegment = () => {
      segments.value.push([])
      currentSegment.value = segments.value.length - 1
    }

    const setCurrentSegment = idx => {
      if (idx >= 0 && idx < segments.value.length) {
        currentSegment.value = idx
      }
    }

    // 自定义Hook管理画布设置
    const canvasSize = ref<'A4' | 'A5'>('A4')
    const orientation = ref<'landscape' | 'portrait'>('landscape')
    const scale = ref(1)

    const canvasWidth = computed(() => {
      if (canvasSize.value === 'A4') {
        return orientation.value === 'landscape' ? 842 : 595
      } else {
        return orientation.value === 'landscape' ? 595 : 420
      }
    })

    const canvasHeight = computed(() => {
      if (canvasSize.value === 'A4') {
        return orientation.value === 'landscape' ? 595 : 842
      } else {
        return orientation.value === 'landscape' ? 420 : 595
      }
    })

    const setCanvasSize = (size: 'A4' | 'A5') => {
      canvasSize.value = size
    }

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
        if (screen.orientation && screen.orientation.lock) {
          // @ts-ignore
          screen.orientation.lock('landscape').catch(() => {})
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
      const pt = segments.value[segIdx][ptIdx]
      if (!pt) return
      const newType = !pt.type || pt.type === 'line' ? 'curve' : 'line'
      segments.value[segIdx].splice(ptIdx, 1, { ...pt, type: newType })
    }

    // 在返回值中添加_segments用于模板绑定
    return {
      segments,
      currentSegment,
      insertMode,
      editMode,
      loading,
      canvasSize,
      drawMode,
      scale,
      drawing,
      imageSrc,
      setCanvasSize,
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
      PointList,
      setCurrentSegment,
      showLandscapeTip,
      drawerVisible,
      isMobile,
      togglePointType
    }
  }
})
</script>

<style scoped lang="scss">
:global(body),
:global(html) {
  overflow: hidden;
  height: 100%;
}
.home-tech-bg {
  min-height: 100vh;
  width: 100vw;
  overflow: hidden;
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
  align-items: center;
  min-height: 90vh;
  max-width: 1400px;
  margin: 0 auto;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(64, 158, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  overflow: visible;
}
.canvas-aside {
  flex: 2;
  min-width: 500px;
  max-width: 900px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0 32px 32px;
}
.canvas-card {
  border-radius: 18px;
  box-shadow: 0 4px 24px #409eff22;
  border: 2px solid #409eff44;
  background: #fff;
  padding: 18px 12px;
  width: 100%;
  max-width: 800px;
}
.panel-main {
  width: 400px;
  flex-shrink: 0;
  padding: 32px 32px 32px 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
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
    max-width: 100vw;
    border-radius: 0;
    box-shadow: none;
    min-height: 100vh;
  }
  .canvas-aside,
  .panel-main {
    width: 100vw !important;
    min-width: 0 !important;
    max-width: 100vw !important;
    padding: 0 !important;
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
