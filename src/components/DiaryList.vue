<template>
  <el-card class="diary-card animate__animated animate__fadeInUp" shadow="hover">
    <template #header>
      <div class="diary-header">
        <el-icon style="color: #409eff; margin-right: 6px"><Document /></el-icon>
        <span>定向日记</span>
        <el-dropdown @command="handleExportCommand" class="export-dropdown">
          <el-button type="primary" size="small" class="export-btn">
            <el-icon><Download /></el-icon>
            导出PDF
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="current-segment">
                <el-icon><Document /></el-icon>
                导出当前分段
              </el-dropdown-item>
              <el-dropdown-item command="all-segments">
                <el-icon><Files /></el-icon>
                导出所有分段
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <!-- 分段描述输入 -->
    <div class="segment-description">
      <el-input
        v-model="segmentDescription"
        type="textarea"
        :rows="3"
        placeholder="描述这段路线的意义、感受或注意事项..."
        @input="updateSegmentDescription"
      />
    </div>

    <!-- 点位列表 -->
    <div class="points-section" v-if="points.length > 0">
      <h4 class="section-title">
        <el-icon><Location /></el-icon>
        轨迹点位 ({{ points.length }}个)
      </h4>
      <el-timeline>
        <el-timeline-item
          v-for="(point, index) in points"
          :key="index"
          :timestamp="`点位 ${index + 1}`"
          :type="point.type === 'curve' ? 'success' : 'primary'"
          size="large"
        >
          <el-card class="point-card" shadow="hover">
            <div class="point-info">
              <div class="point-coords">
                <el-tag size="small" type="info">
                  ({{ point.x.toFixed(1) }}, {{ point.y.toFixed(1) }})
                </el-tag>
                <el-tag :type="point.type === 'curve' ? 'success' : 'warning'" size="small">
                  {{ point.type === 'curve' ? '曲线' : '直线' }}
                </el-tag>
              </div>
              <div class="point-distance" v-if="index > 0">
                <el-text type="info" size="small">
                  距离: {{ (getDistance(points[index - 1], point) * scale).toFixed(2) }}m
                </el-text>
              </div>
              <div class="point-description">
                <el-input
                  v-model="point.description"
                  type="textarea"
                  :rows="2"
                  placeholder="添加点位备注..."
                  @input="updatePointDescription(index)"
                />
              </div>
            </div>
            <div class="point-actions">
              <el-button-group>
                <el-button
                  size="small"
                  type="primary"
                  @click="$emit('edit-point-mode', segmentIndex, index)"
                >
                  编辑
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  @click="$emit('remove-point', segmentIndex, index)"
                >
                  删除
                </el-button>
                <el-button
                  size="small"
                  type="warning"
                  @click="$emit('insert-point-mode', segmentIndex, index)"
                >
                  插入
                </el-button>
                <el-button size="small" @click="$emit('toggle-type', segmentIndex, index)">
                  切换类型
                </el-button>
              </el-button-group>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>

    <!-- 特殊标记列表 -->
    <div class="markers-section" v-if="markers.length > 0">
      <h4 class="section-title">
        <el-icon><Star /></el-icon>
        特殊标记 ({{ markers.length }}个)
      </h4>
      <div class="markers-list">
        <el-card v-for="marker in markers" :key="marker.id" class="marker-card" shadow="hover">
          <div class="marker-header">
            <el-tag :type="getMarkerTypeColor(marker.type)" size="small">
              {{ getMarkerTypeText(marker.type) }}
            </el-tag>
            <el-text type="info" size="small">
              {{ formatTime(marker.timestamp) }}
            </el-text>
          </div>
          <div class="marker-content">
            {{ marker.content }}
          </div>
          <div class="marker-actions">
            <el-button size="small" type="danger" @click="removeMarker(marker.id)">
              删除
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="points.length === 0 && markers.length === 0"
      description="开始绘制轨迹，记录你的定向日记"
    />

    <!-- 添加点位按钮 -->
    <div class="add-point-section" v-if="points.length > 0">
      <el-button
        type="primary"
        size="large"
        @click="$emit('insert-point-mode', segmentIndex, points.length - 1)"
        plain
        style="width: 100%"
      >
        <el-icon><Plus /></el-icon>
        在末尾新增点
      </el-button>
    </div>
  </el-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue'
import { Document, Download, Location, Star, Plus, ArrowDown, Files } from '@element-plus/icons-vue'
import type { Point, Marker, Segment } from '../types'
import { PDFExporter, defaultPDFConfig, defaultProjectConfig } from '../utils/pdfExport'

export default defineComponent({
  name: 'DiaryList',
  components: {
    Document,
    Download,
    Location,
    Star,
    Plus,
    ArrowDown,
    Files
  },
  props: {
    segment: { type: Object as () => Segment, required: true },
    scale: { type: Number, required: true },
    segmentIndex: { type: Number, required: true },
    allSegments: { type: Array as () => Segment[], required: true },
    canvasElement: { type: Object as () => HTMLCanvasElement | null, required: true }
  },
  emits: [
    'remove-point',
    'insert-point-mode',
    'edit-point-mode',
    'toggle-type',
    'update-segment-description',
    'update-point-description',
    'remove-marker'
  ],
  setup(props, { emit }) {
    const segmentDescription = ref(props.segment.description || '')

    const points = computed(() => props.segment.points || [])
    const markers = computed(() => props.segment.markers || [])

    const getDistance = (a: Point, b: Point) => {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return Math.sqrt(dx * dx + dy * dy)
    }

    const getMarkerTypeColor = (type: string) => {
      const colors = {
        note: 'info',
        photo: 'success',
        warning: 'danger',
        checkpoint: 'warning',
        milestone: 'primary'
      }
      return colors[type as keyof typeof colors] || 'info'
    }

    const getMarkerTypeText = (type: string) => {
      const texts = {
        note: '备注',
        photo: '照片',
        warning: '警告',
        checkpoint: '检查点',
        milestone: '里程碑'
      }
      return texts[type as keyof typeof texts] || '标记'
    }

    const formatTime = (timestamp: Date) => {
      return new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const updateSegmentDescription = () => {
      emit('update-segment-description', props.segmentIndex, segmentDescription.value)
    }

    const updatePointDescription = (index: number) => {
      emit('update-point-description', props.segmentIndex, index, points.value[index].description)
    }

    const removeMarker = (markerId: string) => {
      emit('remove-marker', props.segmentIndex, markerId)
    }

    const exportPDF = async () => {
      try {
        const projectConfig = {
          ...defaultProjectConfig,
          scale: props.scale,
          title: '我的定向运动轨迹日记'
        }

        const pdfConfig = {
          ...defaultPDFConfig,
          includeMap: true,
          includePoints: true,
          includeMarkers: true,
          includeDescriptions: true
        }

        const exporter = new PDFExporter(pdfConfig, projectConfig)

        if (props.canvasElement) {
          await exporter.exportPDF(props.allSegments, props.canvasElement)
        } else {
          console.error('画布元素未找到')
        }
      } catch (error) {
        console.error('PDF导出失败:', error)
        // 这里可以添加错误提示
      }
    }

    const exportAllSegments = async () => {
      try {
        const projectConfig = {
          ...defaultProjectConfig,
          scale: props.scale,
          title: '我的定向运动完整轨迹日记'
        }

        const pdfConfig = {
          ...defaultPDFConfig,
          includeMap: true,
          includePoints: true,
          includeMarkers: true,
          includeDescriptions: true
        }

        const exporter = new PDFExporter(pdfConfig, projectConfig)

        if (props.canvasElement) {
          // 传递所有分段数据
          await exporter.exportPDF(props.allSegments || [props.segment], props.canvasElement)
        } else {
          console.error('画布元素未找到')
        }
      } catch (error) {
        console.error('PDF导出失败:', error)
      }
    }

    const handleExportCommand = async (command: string) => {
      if (command === 'current-segment') {
        await exportPDF()
      } else if (command === 'all-segments') {
        await exportAllSegments()
      }
    }

    // 监听segment变化
    watch(
      () => props.segment.description,
      newDesc => {
        segmentDescription.value = newDesc || ''
      }
    )

    return {
      points,
      markers,
      segmentDescription,
      getDistance,
      getMarkerTypeColor,
      getMarkerTypeText,
      formatTime,
      updateSegmentDescription,
      updatePointDescription,
      removeMarker,
      exportPDF,
      handleExportCommand
    }
  }
})
</script>

<style scoped lang="scss">
.diary-card {
  margin: 0 auto;
  max-width: 700px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.08);

  .el-card__header {
    font-weight: bold;
    font-size: 16px;
    background: #f5f7fa;
    border-radius: 12px 12px 0 0;
  }
}

.diary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .export-btn {
    margin-left: auto;
  }
}

.segment-description {
  margin-bottom: 20px;

  .el-textarea {
    border-radius: 8px;
  }
}

.section-title {
  display: flex;
  align-items: center;
  margin: 20px 0 12px 0;
  color: #409eff;
  font-size: 16px;
  font-weight: 600;

  .el-icon {
    margin-right: 6px;
  }
}

.point-card {
  border-radius: 8px;
  margin-bottom: 8px;

  .point-info {
    margin-bottom: 12px;
  }

  .point-coords {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .point-distance {
    margin-bottom: 8px;
  }

  .point-description {
    .el-textarea {
      border-radius: 6px;
    }
  }

  .point-actions {
    display: flex;
    justify-content: flex-end;
  }
}

.markers-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.marker-card {
  border-radius: 8px;

  .marker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .marker-content {
    color: #606266;
    line-height: 1.5;
    margin-bottom: 12px;
  }

  .marker-actions {
    display: flex;
    justify-content: flex-end;
  }
}

.add-point-section {
  margin-top: 20px;
}

.el-timeline {
  padding-left: 0;

  .el-timeline-item {
    padding-bottom: 20px;
  }
}
</style>
