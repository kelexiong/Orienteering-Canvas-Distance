<template>
  <el-card class="pointlist-card animate__animated animate__fadeInUp" shadow="hover">
    <template #header>
      <el-icon style="color: #409eff; margin-right: 6px"><Connection /></el-icon>
      <span>标记点列表</span>
    </template>
    <el-table v-if="points.length > 0" :data="points" border size="small" style="width: 100%">
      <el-table-column label="序号" type="index" width="60" />
      <el-table-column label="坐标">
        <template #default="scope">
          ({{ scope.row.x.toFixed(1) }}, {{ scope.row.y.toFixed(1) }})
        </template>
      </el-table-column>
      <el-table-column label="间隔距离" width="140">
        <template #default="scope">
          <span v-if="scope.$index > 0">
            {{ (getDistance(pointsList[scope.$index - 1], scope.row) * scale).toFixed(2) }} 米
          </span>
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="80">
        <template #default="scope">
          <el-tag :type="scope.row.type === 'curve' ? 'success' : 'info'">
            {{ scope.row.type === 'curve' ? '曲线' : '直线' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260">
        <template #default="scope">
          <el-button-group>
            <el-button
              size="large"
              class="animate__animated animate__pulse"
              @click="$emit('edit-point-mode', segmentIndex, scope.$index)"
            >
              编辑
            </el-button>
            <el-button
              size="large"
              type="danger"
              class="animate__animated animate__shakeX"
              @click="$emit('remove-point', segmentIndex, scope.$index)"
            >
              删除
            </el-button>
            <el-button
              size="large"
              type="primary"
              class="animate__animated animate__bounceIn"
              @click="$emit('insert-point-mode', segmentIndex, scope.$index)"
            >
              在后插入
            </el-button>
            <el-button
              size="large"
              type="warning"
              @click="$emit('toggle-type', segmentIndex, scope.$index)"
            >
              切换类型
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无标记点" />
    <div style="margin-top: 12px">
      <el-button
        type="primary"
        size="large"
        class="animate__animated animate__bounceIn"
        @click="$emit('insert-point-mode', segmentIndex, points.length - 1)"
        plain
        style="width: 100%"
      >
        在末尾新增点
      </el-button>
    </div>
  </el-card>
</template>

<script lang="ts">
import { Connection } from '@element-plus/icons-vue'
export default {
  name: 'PointList',
  components: {
    Connection
  },
  props: {
    points: { type: Array, required: true },
    scale: { type: Number, required: true },
    segmentIndex: { type: Number, required: true }
  },
  emits: ['remove-point', 'insert-point-mode', 'edit-point-mode', 'toggle-type'],
  computed: {
    pointsList(): any[] {
      return this.points as any[]
    }
  },
  methods: {
    getDistance(a: any, b: any) {
      const dx = a.x - b.x
      const dy = a.y - b.y
      return Math.sqrt(dx * dx + dy * dy)
    }
  }
}
</script>

<style scoped lang="scss">
.pointlist-card {
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
.el-table {
  border-radius: 8px;
  overflow: hidden;
  th,
  td {
    font-size: 15px;
  }
  tr:hover {
    background: #e6f7ff;
  }
}
.pointlist-empty {
  text-align: center;
  color: #999;
  padding: 18px 0;
}
.el-button-group .el-button {
  border-radius: 6px !important;
}
</style>
