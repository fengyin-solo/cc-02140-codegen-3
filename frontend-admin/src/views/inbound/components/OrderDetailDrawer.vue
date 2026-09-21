<template>
  <a-drawer
    :open="open"
    title="入库单详情"
    placement="right"
    width="780"
    :destroy-on-close="true"
    @close="$emit('close')"
  >
    <template v-if="order">
      <div class="detail-head">
        <div class="head-top">
          <span class="order-no">{{ order.orderNo }}</span>
          <a-tag :color="ORDER_STATUS[order.status]?.color" class="status-tag">
            {{ ORDER_STATUS[order.status]?.text }}
          </a-tag>
        </div>
        <a-descriptions :column="2" size="small" class="head-desc">
          <a-descriptions-item label="供应商">{{ order.supplierName }}</a-descriptions-item>
          <a-descriptions-item label="入库仓库">{{ order.warehouse }}</a-descriptions-item>
          <a-descriptions-item label="联系人">{{ order.contactName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="联系电话">{{ order.contactPhone || '-' }}</a-descriptions-item>
          <a-descriptions-item label="下单日期">{{ order.orderDate }}</a-descriptions-item>
          <a-descriptions-item label="预计到货">{{ order.expectArrivalDate || '-' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间" :span="2">{{ order.createdAt }}</a-descriptions-item>
          <a-descriptions-item v-if="order.remark" label="整单备注" :span="2">{{ order.remark }}</a-descriptions-item>
        </a-descriptions>
      </div>

      <div class="section-title">
        <ProfileOutlined /> 入库明细（{{ order.items.length }}）
      </div>
      <a-table
        :columns="itemColumns"
        :data-source="order.items"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 700 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'book'">
            <div class="cell-main">{{ record.title }}</div>
            <div class="cell-sub">{{ record.isbn }}</div>
          </template>
          <template v-else-if="column.key === 'qty'">
            <span class="qty-line">
              订 {{ record.expectQty }} / 入
              <b :class="{ ok: record.acceptedQty > 0 }">{{ record.acceptedQty }}</b>
              / 退
              <b :class="{ fail: record.rejectedQty > 0 }">{{ record.rejectedQty }}</b>
            </span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="ITEM_STATUS[record.status]?.color">
              {{ ITEM_STATUS[record.status]?.text }}
            </a-tag>
          </template>
        </template>
      </a-table>

      <div class="section-title">
        <HistoryOutlined /> 验收操作记录（{{ orderRecords.length }}）
      </div>
      <a-empty v-if="orderRecords.length === 0" description="暂无验收记录" :image="simpleImage" />
      <a-timeline v-else class="record-timeline">
        <a-timeline-item v-for="rec in orderRecords" :key="rec.id">
          <div class="rec-head">
            <a-tag :color="RECORD_TYPE[rec.type]?.color">{{ RECORD_TYPE[rec.type]?.text }}</a-tag>
            <span class="rec-book">{{ rec.bookTitle }}</span>
            <span v-if="rec.changeQty" :class="['rec-qty', rec.type]">
              {{ rec.type === 'accepted' ? '+' : '-' }}{{ rec.changeQty }} 册
            </span>
          </div>
          <div class="rec-meta">
            批次 {{ rec.batchNo }} · {{ rec.operator }} · {{ rec.createdAt }}
          </div>
          <div v-if="rec.remark" class="rec-remark">{{ rec.remark }}</div>
        </a-timeline-item>
      </a-timeline>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { Empty } from 'ant-design-vue'
import { ProfileOutlined, HistoryOutlined } from '@ant-design/icons-vue'
import { useInboundStore } from '@/stores/inbound'
import { ITEM_STATUS, ORDER_STATUS, RECORD_TYPE } from '../inboundHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  order: { type: Object, default: null }
})
defineEmits(['close'])

const inboundStore = useInboundStore()
const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE

const orderRecords = computed(() => {
  if (!props.order) return []
  return inboundStore.records
    .filter(r => r.orderId === props.order.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
})

const itemColumns = [
  { title: '图书', key: 'book', width: 240 },
  { title: '供应商批次', dataIndex: 'batchNo', key: 'batchNo', width: 160 },
  { title: '订/入/退', key: 'qty', width: 150 },
  { title: '状态', key: 'status', width: 90 }
]
</script>

<style lang="less" scoped>
.detail-head {
  background: #fafafa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;

  .head-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;

    .order-no {
      font-size: 18px;
      font-weight: 700;
    }
  }
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 12px;
}

.cell-main {
  font-weight: 500;
}
.cell-sub {
  font-size: 12px;
  color: #999;
}

.qty-line {
  .ok { color: #52c41a; }
  .fail { color: #ff4d4f; }
}

.record-timeline {
  margin-top: 8px;
  padding-left: 4px;

  .rec-head {
    display: flex;
    align-items: center;
    gap: 8px;

    .rec-book {
      font-weight: 500;
    }

    .rec-qty {
      font-weight: 600;
      margin-left: auto;
      &.accepted { color: #52c41a; }
      &.returned { color: #ff4d4f; }
    }
  }

  .rec-meta {
    font-size: 12px;
    color: #999;
    margin: 4px 0;
  }

  .rec-remark {
    font-size: 13px;
    color: #555;
    background: #fffbe6;
    border-radius: 6px;
    padding: 6px 10px;
    margin-top: 4px;
  }
}
</style>
