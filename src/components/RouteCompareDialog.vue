<template>
  <el-dialog
    v-model="visible"
    title="路线长度对比"
    width="520px"
    :close-on-click-modal="true"
    destroy-on-close
  >
    <el-alert
      v-if="!scaleEnabled"
      type="warning"
      :closable="false"
      show-icon
      title="请先在操作面板开启「比例尺换算」，对比结果为实地距离（米）。"
      style="margin-bottom: 12px"
    />
    <el-alert
      v-else
      type="info"
      :closable="false"
      show-icon
      :title="`当前比例尺 1:${mapScaleDenominator}，画布 A4 ${orientation === 'landscape' ? '横向' : '纵向'}`"
      style="margin-bottom: 12px"
    />

    <el-table :data="summary.segments" stripe size="small" empty-text="暂无分段数据">
      <el-table-column prop="name" label="分段" min-width="88" />
      <el-table-column prop="pointCount" label="点数" width="64" align="center" />
      <el-table-column label="路线长度" min-width="120">
        <template #default="{ row }">
          <span v-if="row.pointCount < 2" class="text-muted">—</span>
          <span v-else>
            {{ formatRowLength(row) }}
            <el-tag
              v-if="row.index === summary.longestIndex"
              type="danger"
              size="small"
              style="margin-left: 4px"
            >
              最长
            </el-tag>
            <el-tag
              v-else-if="row.index === summary.shortestIndex && summary.segments.filter(s => s.pointCount >= 2).length > 1"
              type="success"
              size="small"
              style="margin-left: 4px"
            >
              最短
            </el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="占比" width="72" align="right">
        <template #default="{ row }">
          <span v-if="row.pointCount < 2">—</span>
          <span v-else>{{ row.percentOfTotal.toFixed(1) }}%</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="route-compare-footer">
      <div class="total-line">
        <span>合计</span>
        <strong>{{ formatTotal() }}</strong>
      </div>
      <div v-if="summary.longestIndex !== null && summary.shortestIndex !== null" class="hint-line">
        最长：{{ summary.segments[summary.longestIndex]?.name }} · 最短：{{
          summary.segments[summary.shortestIndex]?.name
        }}
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue'
import type { RouteCompareSummary } from '../utils/mapScale'
import { formatDistance } from '../utils/mapScale'
import type { PaperOrientation } from '../utils/mapScale'
import { getA4CanvasSize } from '../utils/mapScale'

export default defineComponent({
  name: 'RouteCompareDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    summary: { type: Object as () => RouteCompareSummary, required: true },
    scaleEnabled: { type: Boolean, required: true },
    mapScaleDenominator: { type: Number, required: true },
    orientation: { type: String as () => PaperOrientation, required: true }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const visible = computed({
      get: () => props.modelValue,
      set: (v: boolean) => emit('update:modelValue', v)
    })

    const canvas = computed(() => getA4CanvasSize(props.orientation))

    const formatRowLength = (row: { pixelLength: number; meters: number; pointCount: number }) => {
      if (row.pointCount < 2) return '—'
      if (props.scaleEnabled) {
        const f = formatDistance(row.pixelLength, true, props.mapScaleDenominator, canvas.value)
        return `${f.value} ${f.unit}`
      }
      return `${row.pixelLength.toFixed(1)} px`
    }

    const formatTotal = () => {
      if (props.scaleEnabled) {
        const f = formatDistance(props.summary.totalPixels, true, props.mapScaleDenominator, canvas.value)
        return `${f.value} ${f.unit}`
      }
      return `${props.summary.totalPixels.toFixed(1)} px`
    }

    return { visible, formatRowLength, formatTotal }
  }
})
</script>

<style scoped lang="scss">
.route-compare-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}
.total-line {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  strong {
    color: #409eff;
  }
}
.hint-line {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.text-muted {
  color: #c0c4cc;
}
</style>
