<template>
  <el-card class="diary-card animate__animated animate__fadeInUp" shadow="hover">
    <template #header>
      <div class="diary-header">
        <el-icon style="color: #409eff; margin-right: 6px"><List /></el-icon>
        <span>记录面板</span>
        <el-dropdown @command="handleExportCommand" class="export-dropdown">
          <el-button type="primary" size="small" class="export-btn">
            <el-icon><Download /></el-icon>
            导出
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="current-segment">导出当前分段</el-dropdown-item>
              <el-dropdown-item command="all-segments">导出所有分段</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <el-alert
      v-if="segment.finished && !drawing"
      type="success"
      :closable="false"
      show-icon
      class="finished-tip"
      title="已结束绘制：画布显示轨迹线与方向箭头。点击「开始绘制」可继续编辑点位。"
    />

    <el-tag
      class="role-tag"
      :type="segment.trackRole === 'compare' ? 'warning' : 'primary'"
      effect="dark"
      size="small"
    >
      {{ segment.trackRole === 'compare' ? '对比路线' : '实际跑动' }}
    </el-tag>

    <!-- 本组路线对比（实际 vs 对比路线） -->
    <div v-if="groupCompare" class="group-compare-box">
      <h4 class="section-title">
        <el-icon><DataAnalysis /></el-icon>
        本组路线对比
      </h4>
      <div class="compare-actual">
        <span class="color-dot" :style="{ background: groupCompare.actual.segment.color }" />
        <strong>{{ groupCompare.actual.roleLabel }}</strong>
        <span>{{ formatLen(groupCompare.actual.meters) }}</span>
      </div>
      <div
        v-for="row in groupCompare.compares"
        :key="row.segment.id"
        class="compare-row"
      >
        <span class="color-dot" :style="{ background: row.segment.color }" />
        <span>{{ row.roleLabel }}</span>
        <span>{{ formatLen(row.meters) }}</span>
        <el-tag
          v-if="groupCompare.actual.meters > 0"
          size="small"
          :type="row.meters > groupCompare.actual.meters ? 'danger' : 'success'"
        >
          {{ diffPercent(row.meters, groupCompare.actual.meters) }}
        </el-tag>
      </div>
      <el-empty
        v-if="groupCompare.compares.length === 0"
        description="结束实际路线后，可「新增对比路线」并在本组内对比长度"
        :image-size="48"
      />
    </div>

    <div v-if="points.length >= 2" class="segment-route-length">
      <el-text type="primary">
        本段路线：<strong>{{ currentSegmentLengthText }}</strong>
      </el-text>
    </div>

    <!-- 点位记录 -->
    <div class="points-section" v-if="points.length > 0">
      <h4 class="section-title">
        <el-icon><Location /></el-icon>
        点位记录 ({{ points.length }})
      </h4>
      <div class="point-records">
        <div
          v-for="(point, index) in points"
          :key="index"
          class="point-record-row"
          :class="{ 'is-finished-route': segment.finished && !drawing }"
        >
          <div class="point-record-main">
            <el-tag size="small" type="primary" effect="dark">{{ index + 1 }}</el-tag>
            <el-tag size="small" type="info">
              ({{ point.x.toFixed(0) }}, {{ point.y.toFixed(0) }})
            </el-tag>
            <el-tag
              v-if="point.type"
              size="small"
              :type="point.type === 'curve' ? 'success' : 'warning'"
            >
              {{ point.type === 'curve' ? '曲线' : '直线' }}
            </el-tag>
            <el-text v-if="index > 0" type="info" size="small" class="point-gap-dist">
              ↑ {{ formatPointDistance(points[index - 1], point) }}
            </el-text>
          </div>
          <div class="point-record-actions">
            <el-button
              size="small"
              :type="descOpenIndex === index ? 'primary' : 'default'"
              text
              @click="toggleDesc(index)"
            >
              描述
            </el-button>
            <el-button
              size="small"
              text
              type="primary"
              @click="$emit('edit-point-mode', segmentIndex, index)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              text
              type="danger"
              @click="$emit('remove-point', segmentIndex, index)"
            >
              删除
            </el-button>
            <el-dropdown trigger="click" @command="(cmd: string) => onPointMore(cmd, index)">
              <el-button size="small" text>更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="insert">插入点</el-dropdown-item>
                  <el-dropdown-item command="toggle-type">切换线型</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div v-if="descOpenIndex === index" class="point-desc-input">
            <el-input
              v-model="point.description"
              type="textarea"
              :rows="2"
              placeholder="点位描述（可选）"
              @input="updatePointDescription(index)"
            />
          </div>
        </div>
      </div>
      <el-button
        type="primary"
        size="small"
        plain
        class="append-point-btn"
        @click="$emit('insert-point-mode', segmentIndex, points.length - 1)"
      >
        <el-icon><Plus /></el-icon>
        末尾加点
      </el-button>
    </div>

    <el-empty
      v-else-if="markers.length === 0"
      description="开始绘制轨迹，生成点位记录"
      :image-size="64"
    />

    <el-divider v-if="points.length > 0" />

    <!-- 参照物标记 -->
    <div class="markers-section">
      <h4 class="section-title">
        <el-icon><LocationFilled /></el-icon>
        参照物图钉
      </h4>
      <div class="marker-action-bar">
        <el-button
          :type="landmarkMode ? 'warning' : 'default'"
          size="small"
          @click="$emit('toggle-landmark-mode')"
        >
          <el-icon><LocationFilled /></el-icon>
          {{ landmarkMode ? '点击画布放置' : '标记参照物' }}
        </el-button>
        <el-text type="info" size="small">图钉大小在操作面板调节</el-text>
      </div>

      <div v-if="markers.length > 0" class="markers-list">
        <div v-for="marker in markers" :key="marker.id" class="marker-record-row">
          <span class="pin-icon">📌</span>
          <div class="marker-record-body">
            <el-tag type="warning" size="small">参照物</el-tag>
            <span v-if="markerEditId !== marker.id" class="marker-text">
              {{ marker.content || '（无描述）' }}
            </span>
            <el-input
              v-else
              v-model="markerEditText"
              type="textarea"
              :rows="2"
              size="small"
              @blur="saveMarkerDesc(marker.id)"
            />
            <el-text type="info" size="small">{{ formatTime(marker.timestamp) }}</el-text>
          </div>
          <div class="marker-btns">
            <el-button size="small" text type="primary" @click="startEditMarker(marker)">
              编辑
            </el-button>
            <el-button size="small" text type="danger" @click="removeMarker(marker.id)">
              删除
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无参照物" :image-size="48" />
    </div>
  </el-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue'
import {
  Download,
  Location,
  Plus,
  ArrowDown,
  List,
  LocationFilled,
  DataAnalysis
} from '@element-plus/icons-vue'
import type { Point, Marker, Segment } from '../types'
import { PDFExporter, defaultPDFConfig, defaultProjectConfig } from '../utils/pdfExport'
import { calculateDistance } from '../utils/distance'
import { formatDistance, getA4CanvasSize, segmentPixelLength } from '../utils/mapScale'
import type { PaperOrientation } from '../utils/mapScale'
import { buildSegmentGroupCompare, formatLength } from '../utils/segment'

export default defineComponent({
  name: 'DiaryList',
  components: {
    Download,
    Location,
    Plus,
    ArrowDown,
    List,
    LocationFilled,
    DataAnalysis
  },
  props: {
    segment: { type: Object as () => Segment, required: true },
    scaleEnabled: { type: Boolean, required: true },
    mapScaleDenominator: { type: Number, required: true },
    orientation: { type: String as () => PaperOrientation, required: true },
    segmentIndex: { type: Number, required: true },
    allSegments: { type: Array as () => Segment[], required: true },
    canvasElement: { type: Object as () => HTMLCanvasElement | null, required: true },
    landmarkMode: { type: Boolean, required: true },
    landmarkSize: { type: Number, required: true },
    drawing: { type: Boolean, required: true }
  },
  emits: [
    'remove-point',
    'insert-point-mode',
    'edit-point-mode',
    'toggle-type',
    'update-point-description',
    'update-marker-description',
    'remove-marker',
    'toggle-landmark-mode'
  ],
  setup(props, { emit }) {
    const descOpenIndex = ref<number | null>(null)
    const markerEditId = ref<string | null>(null)
    const markerEditText = ref('')

    const points = computed(() => props.segment.points || [])
    const markers = computed(() => props.segment.markers || [])
    const a4Canvas = computed(() => getA4CanvasSize(props.orientation))

    const groupCompare = computed(() =>
      buildSegmentGroupCompare(
        props.allSegments,
        props.segment.groupId,
        props.mapScaleDenominator,
        a4Canvas.value,
        props.scaleEnabled
      )
    )

    const formatPointDistance = (a: Point, b: Point) => {
      const px = calculateDistance(a, b)
      const f = formatDistance(px, props.scaleEnabled, props.mapScaleDenominator, a4Canvas.value)
      return `${f.value} ${f.unit}`
    }

    const currentSegmentLengthText = computed(() => {
      const px = segmentPixelLength(points.value)
      const f = formatDistance(px, props.scaleEnabled, props.mapScaleDenominator, a4Canvas.value)
      return `${f.value} ${f.unit}`
    })

    const formatLen = (meters: number) => {
      const f = formatLength(meters, props.scaleEnabled)
      return `${f.value} ${f.unit}`
    }

    const diffPercent = (compareM: number, actualM: number) => {
      if (actualM <= 0) return '—'
      const diff = ((compareM - actualM) / actualM) * 100
      const sign = diff > 0 ? '+' : ''
      return `${sign}${diff.toFixed(1)}%`
    }

    const toggleDesc = (index: number) => {
      descOpenIndex.value = descOpenIndex.value === index ? null : index
    }

    const onPointMore = (cmd: string, index: number) => {
      if (cmd === 'insert') emit('insert-point-mode', props.segmentIndex, index)
      if (cmd === 'toggle-type') emit('toggle-type', props.segmentIndex, index)
    }

    const updatePointDescription = (index: number) => {
      emit(
        'update-point-description',
        props.segmentIndex,
        index,
        points.value[index].description || ''
      )
    }

    const startEditMarker = (marker: Marker) => {
      markerEditId.value = marker.id
      markerEditText.value = marker.content || ''
    }

    const saveMarkerDesc = (markerId: string) => {
      emit('update-marker-description', props.segmentIndex, markerId, markerEditText.value)
      markerEditId.value = null
    }

    const formatTime = (timestamp: Date) =>
      new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

    const removeMarker = (markerId: string) => {
      emit('remove-marker', props.segmentIndex, markerId)
    }

    const exportSegments = async (list: Segment[]) => {
      const exporter = new PDFExporter(
        {
          ...defaultPDFConfig,
          includeMap: true,
          includePoints: true,
          includeMarkers: true,
          includeDescriptions: true
        },
        { ...defaultProjectConfig, scale: props.mapScaleDenominator, title: '定向轨迹记录' }
      )
      if (props.canvasElement) await exporter.exportPDF(list, props.canvasElement)
    }

    const handleExportCommand = async (command: string) => {
      if (command === 'current-segment') await exportSegments([props.segment])
      else if (command === 'all-segments') await exportSegments(props.allSegments || [props.segment])
    }

    watch(
      () => props.segmentIndex,
      () => {
        descOpenIndex.value = null
        markerEditId.value = null
      }
    )

    return {
      points,
      markers,
      descOpenIndex,
      markerEditId,
      markerEditText,
      groupCompare,
      formatPointDistance,
      currentSegmentLengthText,
      formatLen,
      diffPercent,
      toggleDesc,
      onPointMore,
      updatePointDescription,
      startEditMarker,
      saveMarkerDesc,
      formatTime,
      removeMarker,
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
  .el-card__header {
    font-weight: bold;
    font-size: 15px;
    background: #f5f7fa;
    padding: 10px 14px;
  }
}

.diary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.finished-tip {
  margin-bottom: 10px;
}

.role-tag {
  margin-bottom: 10px;
}

.group-compare-box {
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f5f9ff;
  border: 1px solid #d9ecff;
  border-radius: 8px;
}

.compare-actual,
.compare-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.section-title {
  display: flex;
  align-items: center;
  margin: 12px 0 8px;
  color: #409eff;
  font-size: 14px;
  font-weight: 600;
  .el-icon {
    margin-right: 6px;
  }
}

.segment-route-length {
  margin-bottom: 10px;
  padding: 8px 10px;
  background: #ecf5ff;
  border-radius: 8px;
}

.point-records {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.point-record-row {
  padding: 8px 10px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;

  &.is-finished-route {
    opacity: 0.92;
    background: #f5f7fa;
  }
}

.point-record-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.point-record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.point-desc-input {
  margin-top: 8px;
}

.append-point-btn {
  width: 100%;
  margin-top: 10px;
}

.marker-action-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.markers-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.marker-record-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: #fffbf0;
  border: 1px solid #faecd8;
  border-radius: 8px;
}

.pin-icon {
  font-size: 18px;
}

.marker-record-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.marker-text {
  font-size: 13px;
  color: #606266;
  word-break: break-all;
}

.marker-btns {
  display: flex;
  flex-direction: column;
}
</style>
