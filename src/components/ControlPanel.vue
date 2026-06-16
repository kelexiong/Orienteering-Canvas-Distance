<template>
  <div class="control-panel">
    <div v-if="!hideActions" class="panel-actions-grid">
      <el-button
        :type="drawing ? 'warning' : 'success'"
        class="grid-btn"
        @click="$emit('toggle-drawing')"
      >
        <el-icon><Edit /></el-icon>
        <span>{{ drawing ? '结束绘制' : '开始绘制' }}</span>
      </el-button>

      <el-popconfirm title="确定要清空所有轨迹吗？" @confirm="$emit('clear-points')">
        <template #reference>
          <el-button type="danger" class="grid-btn">
            <el-icon><Delete /></el-icon>
            <span>清空</span>
          </el-button>
        </template>
      </el-popconfirm>

      <el-button type="info" class="grid-btn" @click="$emit('upload-image')">
        <el-icon><Picture /></el-icon>
        <span>插入图片</span>
      </el-button>

      <el-button type="warning" class="grid-btn" @click="$emit('toggle-orientation')">
        <el-icon><Refresh /></el-icon>
        <span>旋转地图</span>
      </el-button>

      <el-button class="grid-btn" @click="$emit('toggle-draw-mode')">
        <el-icon><Connection /></el-icon>
        <span>{{ drawMode === 'line' ? '曲线' : '直线' }}</span>
      </el-button>

      <el-button
        :type="landmarkMode ? 'primary' : 'default'"
        class="grid-btn"
        @click="$emit('toggle-landmark-mode')"
      >
        <el-icon><LocationFilled /></el-icon>
        <span>{{ landmarkMode ? '图钉中' : '参考物' }}</span>
      </el-button>
    </div>

    <el-divider v-if="!hideActions" class="panel-divider" />

    <div class="segment-groups-header">
      <span class="segment-groups-title">分段列表</span>
      <el-button type="primary" size="small" plain @click="$emit('add-segment-group')">
        新增分段
      </el-button>
    </div>

    <div class="segment-groups">
      <div
        v-for="group in segmentGroups"
        :key="group.groupId"
        class="segment-group-block"
        :class="{ 'is-active-group': group.groupId === activeGroupId }"
      >
        <div class="group-title">分段 {{ group.groupIndex + 1 }}</div>
        <div class="group-routes">
          <el-button
            v-if="group.actual"
            size="small"
            :type="currentSegment === group.actual.flatIndex ? 'primary' : 'default'"
            class="route-btn"
            @click="$emit('switch-segment', group.actual.flatIndex)"
          >
            <span class="seg-color-dot" :style="{ background: group.actual.segment.color }" />
            实际跑动
            <el-tag v-if="group.actual.segment.finished" size="small" type="info" effect="plain">
              轨迹
            </el-tag>
          </el-button>

          <el-tag
            v-for="(cmp, cIdx) in group.compares"
            :key="cmp.segment.id"
            :effect="currentSegment === cmp.flatIndex ? 'dark' : 'light'"
            :type="currentSegment === cmp.flatIndex ? 'primary' : 'info'"
            closable
            draggable="true"
            class="compare-tag"
            :class="{
              'is-dragging': dragFromKey === group.groupId + '-' + cIdx,
              'is-drag-over': dragOverKey === group.groupId + '-' + cIdx
            }"
            @click="$emit('switch-segment', cmp.flatIndex)"
            @close="onRemoveCompare(cmp.segment)"
            @dragstart="onDragStart($event, group.groupId, cIdx)"
            @dragenter.prevent="onDragEnter(group.groupId, cIdx)"
            @dragover.prevent="onDragOver($event, group.groupId)"
            @drop.prevent.stop="onDrop(group.groupId, cIdx)"
            @dragend="onDragEnd"
          >
            <span class="seg-color-dot" :style="{ background: cmp.segment.color }" />
            对比{{ cIdx + 1 }}
            <span v-if="cmp.segment.finished" class="track-badge">轨迹</span>
          </el-tag>

          <el-button
            v-if="group.canAddCompare"
            size="small"
            text
            type="success"
            class="route-btn-add"
            @click="$emit('add-compare-route', group.groupId)"
          >
            + 对比路线
          </el-button>
        </div>
      </div>
    </div>

    <el-collapse
      v-model="activeCollapse"
      class="param-collapse"
      :class="{ 'is-open': activeCollapse.includes('params') }"
    >
      <el-collapse-item name="params">
        <template #title>
          <div class="collapse-title-row">
            <span class="collapse-title">参数设置</span>
            <el-tag
              size="small"
              :type="activeCollapse.includes('params') ? 'primary' : 'info'"
              effect="plain"
            >
              {{ activeCollapse.includes('params') ? '已展开' : '点击展开' }}
            </el-tag>
          </div>
        </template>
        <div v-if="activeSegment" class="color-panel">
          <el-form-item
            :label="activeSegment.trackRole === 'compare' ? '对比路线颜色' : '实际路线颜色'"
            class="color-form-item"
          >
            <el-color-picker
              :model-value="activeSegment.color"
              size="small"
              @update:model-value="updateRouteColor"
            />
            <el-button
              v-for="preset in colorPresets"
              :key="preset"
              size="small"
              circle
              class="color-preset"
              :class="{
                'is-selected': activeSegment.color?.toLowerCase() === preset.toLowerCase()
              }"
              :style="{ background: preset }"
              @click="updateRouteColor(preset)"
            />
          </el-form-item>
        </div>

        <el-form class="panel-form" label-position="top">
          <div class="form-row">
            <el-form-item label="比例尺换算" class="form-item-compact">
              <el-switch v-model="scaleEnabledProxy" active-text="开" inactive-text="关" />
            </el-form-item>
            <el-form-item
              v-if="scaleEnabledProxy"
              label="地图比例 1:N"
              class="form-item-compact form-item-grow"
            >
              <div class="scale-input-row">
                <el-select v-model="mapScaleProxy" size="small" style="flex: 1">
                  <el-option v-for="n in mapScalePresets" :key="n" :label="`1 : ${n}`" :value="n" />
                </el-select>
                <el-input-number
                  v-model="mapScaleProxy"
                  :min="100"
                  :max="100000"
                  :step="500"
                  size="small"
                  controls-position="right"
                  style="width: 110px"
                />
              </div>
            </el-form-item>
          </div>
          <div class="form-row form-row-nums">
            <el-form-item label="画点" class="form-item-compact">
              <el-input-number
                :model-value="pointSize"
                :min="6"
                :step="1"
                size="small"
                controls-position="right"
                @update:model-value="$emit('update:pointSize', $event)"
              />
            </el-form-item>
            <el-form-item label="连线" class="form-item-compact">
              <el-input-number
                :model-value="lineWidth"
                :min="6"
                :step="1"
                size="small"
                controls-position="right"
                @update:model-value="$emit('update:lineWidth', $event)"
              />
            </el-form-item>
            <el-form-item label="图钉" class="form-item-compact">
              <el-input-number
                :model-value="landmarkSize"
                :min="12"
                :max="96"
                :step="1"
                size="small"
                controls-position="right"
                @update:model-value="$emit('update:landmarkSize', $event)"
              />
            </el-form-item>
            <el-form-item label="箭头" class="form-item-compact">
              <el-input-number
                :model-value="arrowSize"
                :min="1"
                :max="10"
                :step="1"
                size="small"
                controls-position="right"
                @update:model-value="$emit('update:arrowSize', $event)"
              />
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item label="轨迹透明度" class="form-item-compact form-item-grow">
              <el-slider
                :model-value="trackOpacity"
                :min="0.1"
                :max="1"
                :step="0.1"
                :show-tooltip="true"
                size="small"
                @update:model-value="$emit('update:trackOpacity', $event)"
              />
            </el-form-item>
            <el-form-item label="参照物图钉透明度" class="form-item-compact form-item-grow">
              <el-slider
                :model-value="markerOpacity"
                :min="0.1"
                :max="1"
                :step="0.1"
                :show-tooltip="true"
                size="small"
                @update:model-value="$emit('update:markerOpacity', $event)"
              />
            </el-form-item>
            <el-form-item label="路线距离透明度" class="form-item-compact form-item-grow">
              <el-slider
                :model-value="routeDistanceOpacity"
                :min="0.1"
                :max="1"
                :step="0.1"
                :show-tooltip="true"
                size="small"
                @update:model-value="$emit('update:routeDistanceOpacity', $event)"
              />
            </el-form-item>
          </div>
        </el-form>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue'
import { Edit, Delete, Picture, Refresh, Connection, LocationFilled } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { MAP_SCALE_PRESETS } from '../utils/mapScale'
import type { Segment } from '../types'
import type { SegmentGroupView } from '../utils/segment'

export default defineComponent({
  name: 'ControlPanel',
  components: { Edit, Delete, Picture, Refresh, Connection, LocationFilled },
  props: {
    drawing: { type: Boolean, required: true },
    drawMode: { type: String, required: true },
    orientation: { type: String, required: true },
    landmarkMode: { type: Boolean, required: true },
    currentSegment: { type: Number, required: true },
    segmentGroups: { type: Array as () => SegmentGroupView[], required: true },
    scaleEnabled: { type: Boolean, required: true },
    mapScaleDenominator: { type: Number, required: true },
    pointSize: { type: Number, required: true },
    lineWidth: { type: Number, required: true },
    landmarkSize: { type: Number, required: true },
    arrowSize: { type: Number, default: 1 },
    trackOpacity: { type: Number, default: 1 },
    markerOpacity: { type: Number, default: 0.7 },
    routeDistanceOpacity: { type: Number, default: 0.88 },
    hideActions: { type: Boolean, default: false }
  },
  emits: [
    'toggle-drawing',
    'clear-points',
    'upload-image',
    'toggle-orientation',
    'toggle-draw-mode',
    'toggle-landmark-mode',
    'add-compare-route',
    'add-segment-group',
    'switch-segment',
    'update-segment-color',
    'remove-segment',
    'reorder-compares',
    'update:scaleEnabled',
    'update:mapScaleDenominator',
    'update:pointSize',
    'update:lineWidth',
    'update:landmarkSize',
    'update:arrowSize',
    'update:trackOpacity',
    'update:markerOpacity',
    'update:routeDistanceOpacity'
  ],
  setup(props, { emit }) {
    const mapScalePresets = MAP_SCALE_PRESETS
    const activeCollapse = ref<string[]>([])

    const dragFromKey = ref<string | null>(null)
    const dragOverKey = ref<string | null>(null)
    const dragSource = ref<{ groupId: string; index: number } | null>(null)

    const onDragStart = (e: DragEvent, groupId: string, index: number) => {
      dragSource.value = { groupId, index }
      dragFromKey.value = `${groupId}-${index}`
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `${groupId}:${index}`)
      }
    }

    const onDragEnter = (groupId: string, index: number) => {
      if (!dragSource.value || dragSource.value.groupId !== groupId) return
      dragOverKey.value = `${groupId}-${index}`
    }

    const onDragOver = (e: DragEvent, groupId: string) => {
      if (!dragSource.value || dragSource.value.groupId !== groupId) return
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    }

    const onDrop = (groupId: string, toIndex: number) => {
      const src = dragSource.value
      if (src && src.groupId === groupId && src.index !== toIndex) {
        emit('reorder-compares', groupId, src.index, toIndex)
      }
      dragSource.value = null
      dragFromKey.value = null
      dragOverKey.value = null
    }

    const onDragEnd = () => {
      dragSource.value = null
      dragFromKey.value = null
      dragOverKey.value = null
    }

    const onRemoveCompare = async (segment: Segment) => {
      const hasContent = segment.points.length > 0 || segment.markers.length > 0
      if (hasContent) {
        try {
          await ElMessageBox.confirm(
            `确定删除「${segment.name}」？该路线包含 ${segment.points.length} 个点位、${segment.markers.length} 个标记，删除后无法恢复。`,
            '删除对比路线',
            { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
          )
        } catch {
          return
        }
      }
      emit('remove-segment', segment.id)
    }

    const activeSegment = computed(
      () =>
        props.segmentGroups
          .flatMap(g => [
            ...(g.actual ? [{ segment: g.actual.segment, flatIndex: g.actual.flatIndex }] : []),
            ...g.compares
          ])
          .find(r => r.flatIndex === props.currentSegment)?.segment
    )

    const activeGroupId = computed(
      () =>
        props.segmentGroups.find(
          g =>
            g.actual?.flatIndex === props.currentSegment ||
            g.compares.some(c => c.flatIndex === props.currentSegment)
        )?.groupId
    )

    const colorPresets = computed(() =>
      activeSegment.value?.trackRole === 'compare'
        ? [
            '#E6A23C',
            '#F56C6C',
            '#9A60B4',
            '#67C23A',
            '#13C2C2',
            '#F97316',
            '#D946EF',
            '#2F54EB',
            '#8C6D1F',
            '#606266'
          ]
        : [
            '#409EFF',
            '#67C23A',
            '#1E90FF',
            '#13C2C2',
            '#F56C6C',
            '#00A870',
            '#D81E5B',
            '#8B5CF6',
            '#2F54EB',
            '#303133'
          ]
    )

    const scaleEnabledProxy = computed({
      get: () => props.scaleEnabled,
      set: (v: boolean) => emit('update:scaleEnabled', v)
    })
    const mapScaleProxy = computed({
      get: () => props.mapScaleDenominator,
      set: (v: number) => emit('update:mapScaleDenominator', v)
    })

    const normalizeColor = (value: string | null | undefined) => {
      const color = typeof value === 'string' ? value.trim() : ''
      return color || null
    }

    const updateRouteColor = (value: string | null | undefined) => {
      const color = normalizeColor(value)
      if (!color || !activeSegment.value) return
      emit('update-segment-color', props.currentSegment, color)
    }

    return {
      mapScalePresets,
      colorPresets,
      activeSegment,
      activeGroupId,
      activeCollapse,
      scaleEnabledProxy,
      mapScaleProxy,
      dragFromKey,
      dragOverKey,
      onDragStart,
      onDragEnter,
      onDragOver,
      onDrop,
      onDragEnd,
      onRemoveCompare,
      updateRouteColor
    }
  }
})
</script>

<style scoped lang="scss">
.control-panel {
  width: 100%;
}

.param-collapse {
  margin-top: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fafafa;
  overflow: hidden;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s;

  &.is-open {
    border-color: #409eff;
    background: #f0f7ff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
  }

  :deep(.el-collapse-item__header) {
    font-size: 12px;
    font-weight: 600;
    color: #303133;
    height: 38px;
    line-height: 38px;
    padding: 0 10px;
    background: transparent;
    border-bottom: none;
  }
  :deep(.el-collapse-item__arrow) {
    color: #409eff;
    font-weight: 700;
  }
  :deep(.el-collapse-item__wrap) {
    border: none;
    background: transparent;
  }
  :deep(.el-collapse-item__content) {
    padding: 0 10px 8px;
  }
}

.collapse-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.collapse-title {
  font-size: 13px;
  font-weight: 700;
}

.panel-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@media (min-width: 900px) {
  .panel-actions-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.grid-btn {
  width: 100%;
  margin: 0 !important;
  height: 36px;
  padding: 8px 6px;
  font-size: 13px;
  span {
    margin-left: 4px;
  }
}

.panel-divider {
  margin: 12px 0;
}

.segment-groups-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.segment-groups-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.segment-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 10px;
  max-height: 200px;
  overflow-y: auto;
}

.segment-group-block {
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fafafa;

  &.is-active-group {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.group-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}

.group-routes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 8px;
  border-left: 3px solid #dcdfe6;
}

.route-btn {
  margin: 0 !important;
}

.route-btn-compare {
  border-style: dashed;
}

.route-btn-add {
  padding: 0 6px !important;
}

.compare-tag {
  cursor: grab;
  user-select: none;
  transition:
    transform 0.15s,
    opacity 0.15s,
    box-shadow 0.15s;

  &:active {
    cursor: grabbing;
  }

  &.is-dragging {
    opacity: 0.4;
    transform: scale(0.92);
  }

  &.is-drag-over {
    box-shadow: 0 0 0 2px #409eff;
    transform: scale(1.05);
  }

  .track-badge {
    margin-left: 4px;
    font-size: 10px;
    color: #909399;
  }
}

.seg-color-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}

.color-panel {
  margin-bottom: 8px;
  padding: 8px;
  background: #f0f7ff;
  border-radius: 8px;
}

.color-form-item {
  margin-bottom: 0 !important;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.color-preset {
  width: 22px !important;
  height: 22px !important;
  min-height: 22px;
  padding: 0 !important;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #dcdfe6;

  &.is-selected {
    box-shadow:
      0 0 0 2px #303133,
      0 0 0 4px #fff;
  }
}

.panel-form {
  :deep(.el-form-item) {
    margin-bottom: 8px;
  }
  :deep(.el-form-item__label) {
    font-size: 12px;
    padding-bottom: 2px;
  }
}

.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: flex-end;
}

.form-row-nums .form-item-compact {
  flex: 1;
  min-width: 88px;
  max-width: 120px;
}

.form-item-compact {
  margin-bottom: 0 !important;
}

.form-item-grow {
  flex: 1;
  min-width: 180px;
}

.scale-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}
</style>
