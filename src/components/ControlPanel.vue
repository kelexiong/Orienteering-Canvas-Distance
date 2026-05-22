<template>
  <div class="control-panel">
    <div class="panel-actions-grid">
      <el-button
        :type="drawing ? 'warning' : 'success'"
        @click="$emit('toggle-drawing')"
        class="grid-btn"
      >
        <el-icon><Edit /></el-icon>
        <span>{{ drawing ? '结束绘制' : '开始绘制' }}</span>
      </el-button>

      <el-popconfirm title="确定要清除所有点位吗？" @confirm="$emit('clear-points')">
        <template #reference>
          <el-button type="danger" class="grid-btn">
            <el-icon><Delete /></el-icon>
            <span>清除</span>
          </el-button>
        </template>
      </el-popconfirm>

      <el-button type="info" class="grid-btn" @click="$emit('upload-image')">
        <el-icon><Picture /></el-icon>
        <span>插图</span>
      </el-button>

      <el-button type="warning" class="grid-btn" @click="$emit('toggle-orientation')">
        <el-icon><Refresh /></el-icon>
        <span>{{ orientation === 'landscape' ? '纵向' : '横向' }}</span>
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
        <span>{{ landmarkMode ? '图钉中' : '参照物' }}</span>
      </el-button>
    </div>

    <el-divider class="panel-divider" />

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

          <el-button
            v-for="(cmp, cIdx) in group.compares"
            :key="cmp.segment.id"
            size="small"
            :type="currentSegment === cmp.flatIndex ? 'primary' : 'default'"
            class="route-btn route-btn-compare"
            @click="$emit('switch-segment', cmp.flatIndex)"
          >
            <span class="seg-color-dot" :style="{ background: cmp.segment.color }" />
            对比{{ cIdx + 1 }}
            <el-tag v-if="cmp.segment.finished" size="small" type="info" effect="plain">轨迹</el-tag>
          </el-button>

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

    <div v-if="activeSegment" class="color-panel">
      <el-form-item
        :label="activeSegment.trackRole === 'compare' ? '对比路线颜色' : '实际路线颜色'"
        class="color-form-item"
      >
        <el-color-picker
          :model-value="activeSegment.color"
          @update:model-value="$emit('update-segment-color', currentSegment, $event)"
          size="small"
        />
        <el-button
          v-for="preset in colorPresets"
          :key="preset"
          size="small"
          circle
          class="color-preset"
          :style="{ background: preset }"
          @click="$emit('update-segment-color', currentSegment, preset)"
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
            @update:model-value="$emit('update:pointSize', $event)"
            :min="2"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="连线" class="form-item-compact">
          <el-input-number
            :model-value="lineWidth"
            @update:model-value="$emit('update:lineWidth', $event)"
            :min="2"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="图钉" class="form-item-compact">
          <el-input-number
            :model-value="landmarkSize"
            @update:model-value="$emit('update:landmarkSize', $event)"
            :min="4"
            :max="40"
            :step="1"
            size="small"
            controls-position="right"
          />
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import { Edit, Delete, Picture, Refresh, Connection, LocationFilled } from '@element-plus/icons-vue'
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
    landmarkSize: { type: Number, required: true }
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
    'update:scaleEnabled',
    'update:mapScaleDenominator',
    'update:pointSize',
    'update:lineWidth',
    'update:landmarkSize'
  ],
  setup(props, { emit }) {
    const mapScalePresets = MAP_SCALE_PRESETS
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
        ? ['#E6A23C', '#F56C6C', '#9A60B4', '#67C23A', '#909399']
        : ['#409EFF', '#67C23A', '#1E90FF', '#13C2C2', '#F56C6C']
    )

    const scaleEnabledProxy = computed({
      get: () => props.scaleEnabled,
      set: (v: boolean) => emit('update:scaleEnabled', v)
    })
    const mapScaleProxy = computed({
      get: () => props.mapScaleDenominator,
      set: (v: number) => emit('update:mapScaleDenominator', v)
    })

    return {
      mapScalePresets,
      colorPresets,
      activeSegment,
      activeGroupId,
      scaleEnabledProxy,
      mapScaleProxy
    }
  }
})
</script>

<style scoped lang="scss">
.control-panel {
  width: 100%;
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
