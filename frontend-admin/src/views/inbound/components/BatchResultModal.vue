<template>
  <a-modal
    :open="open"
    title="批量操作结果"
    :footer="null"
    width="760px"
    @cancel="$emit('close')"
  >
    <div class="result-hero">
      <div :class="['hero-icon', failedCount ? 'warn' : 'ok']">
        <CheckCircleOutlined v-if="!failedCount" />
        <WarningOutlined v-else />
      </div>
      <div class="hero-text">
        <div class="hero-title">{{ title }}</div>
        <div class="hero-desc">{{ summary }}</div>
      </div>
    </div>

    <a-row :gutter="12" class="result-counts">
      <a-col :span="8">
        <div class="count-box all">
          <div class="num">{{ results.length }}</div>
          <div class="label">处理条数</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="count-box ok">
          <div class="num">{{ successCount }}</div>
          <div class="label">成功</div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="count-box fail">
          <div class="num">{{ failedCount }}</div>
          <div class="label">失败 / 待处理</div>
        </div>
      </a-col>
    </a-row>

    <a-table
      :columns="columns"
      :data-source="tableData"
      :pagination="{ pageSize: 8, size: 'small' }"
      row-key="rowKey"
      size="small"
      class="result-table"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'book'">
          <div class="cell-main">{{ record.bookTitle }}</div>
          <div class="cell-sub">{{ record.orderNo }}</div>
        </template>
        <template v-else-if="column.key === 'result'">
          <a-tag :color="record.ok ? 'success' : 'error'" class="result-tag">
            <CheckOutlined v-if="record.ok" />
            <CloseOutlined v-else />
            {{ record.ok ? '成功' : '未处理' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'message'">
          <span :class="['msg', record.ok ? 'ok' : 'fail']">{{ record.message }}</span>
        </template>
      </template>
    </a-table>

    <div class="result-actions">
      <a-space>
        <a-button v-if="failedCount" type="primary" @click="$emit('retry', failedItems)">
          <ReloadOutlined /> 保留待处理项并继续处理（{{ failedCount }}）
        </a-button>
        <a-button @click="$emit('close')">关闭</a-button>
      </a-space>
    </div>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'
import {
  CheckCircleOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 'accept' | 'return'
  mode: { type: String, default: 'accept' },
  results: { type: Array, default: () => [] },
  successCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 }
})
defineEmits(['close', 'retry'])

let seq = 0
const tableData = computed(() =>
  props.results.map(r => ({ ...r, rowKey: `${r.itemId}_${r.code}_${(seq += 1)}` }))
)

const failedItems = computed(() => tableData.value.filter(r => !r.ok))

const title = computed(() =>
  props.mode === 'accept' ? '批量验收入库结果' : '批量退回结果'
)

const summary = computed(() => {
  if (!props.failedCount) {
    return props.mode === 'accept'
      ? `全部 ${props.successCount} 条明细验收通过，可借库存已同步`
      : `全部 ${props.successCount} 条明细退回完成`
  }
  return `成功 ${props.successCount} 条，失败 ${props.failedCount} 条；失败明细保持原状态，已保留在待处理列表中`
})

const columns = [
  { title: '图书 / 单号', key: 'book', width: 260 },
  { title: '结果', key: 'result', width: 100, align: 'center' },
  { title: '逐条说明', key: 'message' }
]
</script>

<style lang="less" scoped>
.result-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;

  & .hero-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: #fff;

    &.ok {
      background: linear-gradient(135deg, #52c41a, #73d13d);
    }
    &.warn {
      background: linear-gradient(135deg, #faad14, #ffc53d);
    }
  }

  .hero-title {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .hero-desc {
    font-size: 13px;
    color: #666;
  }
}

.result-counts {
  margin-bottom: 16px;

  .count-box {
    border-radius: 10px;
    text-align: center;
    padding: 14px 0;

    .num {
      font-size: 26px;
      font-weight: 700;
    }
    .label {
      font-size: 12px;
      color: #999;
      margin-top: 2px;
    }

    &.all {
      background: #e6f7ff;
      .num { color: #1890ff; }
    }
    &.ok {
      background: #f6ffed;
      .num { color: #52c41a; }
    }
    &.fail {
      background: #fff2f0;
      .num { color: #ff4d4f; }
    }
  }
}

.result-table {
  .cell-main {
    font-weight: 500;
  }
  .cell-sub {
    font-size: 12px;
    color: #999;
  }
  .msg {
    font-size: 13px;
    &.ok { color: #389e0d; }
    &.fail { color: #cf1322; }
  }
}

.result-actions {
  margin-top: 16px;
  text-align: right;
}
</style>
