<template>
  <a-modal
    :open="true"
    :title="action === 'accept' ? '批量验收结果（逐条）' : '批量退回结果（逐条）'"
    width="680px"
    :footer="null"
    @cancel="emit('close')"
  >
    <a-alert
      :type="failedCount > 0 ? 'warning' : 'success'"
      show-icon
      style="margin-bottom: 16px"
      :message="summaryText"
      :description="action === 'accept'
        ? '成功项已同步可借库存；数量不符、同批次重复或重复提交的单据保持待处理，可修正后重新勾选验收。'
        : '退回成功的单据已标记为退回；处理失败的单据保持原状态。'"
    />

    <div class="result-list">
      <div v-for="(r, i) in results" :key="`${r.id}-${i}`" :class="['result-item', r.success ? 'ok' : 'fail']">
        <div class="result-icon">
          <CheckCircleOutlined v-if="r.success" />
          <CloseCircleOutlined v-else />
        </div>
        <div class="result-body">
          <div class="result-title">
            <span class="order-no">{{ r.orderNo }}</span>
            <span class="book-title">{{ r.title }}</span>
          </div>
          <div class="result-msg">{{ r.message }}</div>
          <div v-if="r.success" class="result-meta">
            <a-tag v-if="action === 'accept' && r.createdBook" color="blue" class="mini-tag">新品种自动建档</a-tag>
            <a-tag v-if="action === 'accept'" color="green" class="mini-tag">
              本次 +{{ r.received }} 本 · 可借库存 {{ r.stockAfter }}
            </a-tag>
            <a-tag v-if="action === 'return'" color="red" class="mini-tag">退回 {{ r.returned }} 本</a-tag>
            <a-tag v-if="r.code === 'partial'" color="gold" class="mini-tag">余 {{ r.remainAfter }} 本待处理</a-tag>
            <a-tag v-if="r.code === 'returned_partial'" color="orange" class="mini-tag">部分已入库，库存保留</a-tag>
          </div>
        </div>
        <div class="result-side">
          <a-tag :color="r.success ? (r.code === 'partial' || r.code === 'returned_partial' ? 'warning' : 'success') : 'error'">
            {{ sideTag(r) }}
          </a-tag>
        </div>
      </div>
    </div>

    <div class="result-footer">
      <a-space>
        <a-button v-if="failedCount > 0" @click="emit('close')">返回处理待办项（{{ failedCount }}）</a-button>
        <a-button type="primary" @click="emit('close')">知道了</a-button>
      </a-space>
    </div>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue'

const props = defineProps({
  results: { type: Array, default: () => [] },
  action: { type: String, default: 'accept' }
})
const emit = defineEmits(['close'])

const failedCount = computed(() => props.results.filter(r => !r.success).length)
const successCount = computed(() => props.results.filter(r => r.success).length)

const summaryText = computed(() => {
  const verb = props.action === 'accept' ? '验收' : '退回'
  if (failedCount.value === 0) return `全部处理成功：共 ${successCount.value} 条${verb}成功`
  if (successCount.value === 0) return `全部未通过：${failedCount.value} 条单据保留待处理`
  return `${successCount.value} 条${verb}成功，${failedCount.value} 条未通过并保留待处理`
})

function sideTag(r) {
  if (r.success) {
    if (r.code === 'partial') return '部分验收'
    if (r.code === 'returned_partial') return '部分入库后退回'
    return '成功'
  }
  const map = {
    duplicate_submit: '重复提交',
    duplicate_batch: '批次重复',
    quantity_mismatch: '数量不符',
    invalid_quantity: '数量无效'
  }
  return map[r.code] || '未处理'
}
</script>

<style lang="less" scoped>
.result-list {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
}

.result-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #f5f5f5;

  &:last-child { border-bottom: none; }
  &.ok { background: #fcfffa; }
  &.fail { background: #fffafa; }

  .result-icon {
    font-size: 18px;
    margin-top: 2px;
  }
  &.ok .result-icon { color: #52c41a; }
  &.fail .result-icon { color: #ff4d4f; }

  .result-body { flex: 1; min-width: 0; }
  .result-title {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    .order-no { font-weight: 600; color: #1890ff; font-size: 13px; }
    .book-title { font-weight: 500; color: #1a1a1a; }
  }
  .result-msg { font-size: 13px; color: #555; margin-top: 2px; }
  .result-meta { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .result-side { flex-shrink: 0; }
}

.mini-tag { font-size: 11px; line-height: 16px; padding: 0 4px; margin: 0; }

.result-footer {
  margin-top: 16px;
  text-align: right;
}
</style>
