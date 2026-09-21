<template>
  <a-modal
    :open="open"
    title="批量验收入库"
    :confirm-loading="submitLoading"
    ok-text="确认批量验收"
    :mask-closable="false"
    width="900px"
    :destroy-on-close="true"
    @ok="handleSubmit"
    @cancel="$emit('cancel')"
  >
    <div class="batch-summary">
      <a-space wrap>
        <a-tag color="processing">共 {{ localRows.length }} 条明细</a-tag>
        <a-tag color="warning">待处理合计 {{ totalRemaining }} 册</a-tag>
        <a-tag v-if="dupRows.length" color="error">
          批次重复预判 {{ dupRows.length }} 条
        </a-tag>
      </a-space>
    </div>

    <a-table
      :columns="columns"
      :data-source="localRows"
      :pagination="false"
      row-key="itemId"
      size="small"
      :scroll="{ y: 360, x: 820 }"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'orderNo'">
          <div class="cell-main">{{ record.orderNo }}</div>
          <div class="cell-sub">{{ record.supplierName }}</div>
        </template>
        <template v-else-if="column.key === 'book'">
          <div class="cell-main">{{ record.title }}</div>
          <div class="cell-sub">{{ record.isbn }}</div>
        </template>
        <template v-else-if="column.key === 'batchNo'">
          <span :class="{ 'dup-text': record.__dup }">{{ record.batchNo }}</span>
          <a-tooltip v-if="record.__dup" title="该 ISBN+批次已在其它入库单验收入库">
            <WarningOutlined class="dup-icon" />
          </a-tooltip>
        </template>
        <template v-else-if="column.key === 'remaining'">
          <a-tag color="orange">{{ record.__remaining }}</a-tag>
        </template>
        <template v-else-if="column.key === 'actualQty'">
          <a-input-number
            v-model:value="record.actualQty"
            :min="1"
            :precision="0"
            size="small"
            style="width: 100px"
            :status="record.actualQty !== record.__remaining ? 'warning' : ''"
          />
          <div v-if="record.actualQty !== record.__remaining" class="mismatch-hint">
            与待处理数量不符，将退回逐条处理
          </div>
        </template>
      </template>
    </a-table>

    <div class="batch-footer-tip">
      <InfoCircleOutlined />
      批量验收将逐条校验：<b>重复提交</b>、<b>数量不符</b>、<b>同一供应商批次重复入库</b> 的明细会失败并保留待处理；
      验收成功的明细将同步增加可借库存
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { WarningOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import { useInboundStore } from '@/stores/inbound'
import { remainingQty } from '../inboundHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 父组件勾选的行（flatItems 形态）
  rows: { type: Array, default: () => [] }
})
const emit = defineEmits(['submitted', 'cancel'])

const inboundStore = useInboundStore()
const submitLoading = ref(false)

const columns = [
  { title: '入库单', key: 'orderNo', width: 170 },
  { title: '图书', key: 'book', width: 200 },
  { title: '供应商批次', key: 'batchNo', width: 160 },
  { title: '待处理', key: 'remaining', width: 90, align: 'center' },
  { title: '本次实收', key: 'actualQty', width: 130 }
]

// 打开时构建本地可变行：默认实收=待处理，并预判批次重复
const localRows = ref([])

watch(
  () => props.open,
  open => {
    if (!open) return
    localRows.value = props.rows.map(row => {
      const remaining = remainingQty(row)
      const dup = inboundStore.findDuplicateBatch(row.isbn, row.batchNo, row.itemId)
      return {
        ...row,
        actualQty: remaining,
        __remaining: remaining,
        __dup: !!dup
      }
    })
  },
  { immediate: true }
)

const totalRemaining = computed(() => localRows.value.reduce((sum, r) => sum + r.__remaining, 0))
const dupRows = computed(() => localRows.value.filter(r => r.__dup))

async function handleSubmit() {
  submitLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 400))
    const result = inboundStore.batchAccept(localRows.value)
    if (!result.ok) {
      // 仅在拦截重复提交/未选择时提示，不打开结果框
      emit('submitted', { blocked: true, ...result })
      return
    }
    emit('submitted', { blocked: false, ...result })
  } finally {
    submitLoading.value = false
  }
}
</script>

<style lang="less" scoped>
.batch-summary {
  margin-bottom: 12px;
}

.cell-main {
  font-weight: 500;
}

.cell-sub {
  font-size: 12px;
  color: #999;
}

.dup-text {
  color: #ff4d4f;
}

.dup-icon {
  color: #ff4d4f;
  margin-left: 4px;
}

.mismatch-hint {
  font-size: 11px;
  color: #fa8c16;
  margin-top: 2px;
}

.batch-footer-tip {
  margin-top: 12px;
  padding: 10px 12px;
  background: #e6f7ff;
  border-radius: 8px;
  font-size: 12px;
  color: #096dd9;
}
</style>
