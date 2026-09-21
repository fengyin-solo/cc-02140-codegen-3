<template>
  <div class="inbound-page">
    <h2 class="page-title">采购入库与验收</h2>

    <!-- 统计卡片 -->
    <a-row :gutter="[16, 16]" class="stat-row">
      <a-col :xs="12" :md="6">
        <div class="stat-card-mini pending">
          <div class="mini-icon"><ProfileOutlined /></div>
          <div>
            <div class="mini-value">{{ stats.pendingOrders }}</div>
            <div class="mini-label">待验收单据</div>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :md="6">
        <div class="stat-card-mini processing">
          <div class="mini-icon"><AuditOutlined /></div>
          <div>
            <div class="mini-value">{{ stats.pendingItems }}</div>
            <div class="mini-label">待处理明细</div>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :md="6">
        <div class="stat-card-mini accepted">
          <div class="mini-icon"><CheckCircleOutlined /></div>
          <div>
            <div class="mini-value">{{ stats.todayAcceptedQty }}</div>
            <div class="mini-label">今日入库册数</div>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :md="6">
        <div class="stat-card-mini rejected">
          <div class="mini-icon"><RollbackOutlined /></div>
          <div>
            <div class="mini-value">{{ stats.rejectedQty }}</div>
            <div class="mini-label">累计退回册数</div>
          </div>
        </div>
      </a-col>
    </a-row>

    <div class="tab-card">
      <a-tabs v-model:activeKey="activeTab" class="main-tabs">
        <!-- ================= Tab 1 入库单管理 ================= -->
        <a-tab-pane key="orders">
          <template #tab>
            <span><ProfileOutlined /> 入库单管理</span>
          </template>

          <div class="toolbar">
            <a-space wrap>
              <a-input
                v-model:value="orderKeyword"
                placeholder="搜索单号 / 图书 / ISBN / 供应商"
                allow-clear
                style="width: 280px"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
              <a-select
                v-model:value="orderStatusFilter"
                placeholder="单据状态"
                allow-clear
                style="width: 140px"
              >
                <a-select-option value="pending">待验收</a-select-option>
                <a-select-option value="accepting">验收中</a-select-option>
                <a-select-option value="completed">已完成</a-select-option>
                <a-select-option value="returned">已退回</a-select-option>
              </a-select>
            </a-space>
            <a-button type="primary" @click="openCreate">
              <PlusOutlined /> 新增入库单
            </a-button>
          </div>

          <a-table
            :columns="orderColumns"
            :data-source="filteredOrders"
            row-key="id"
            :pagination="{ pageSize: 8, showTotal: t => `共 ${t} 张入库单` }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'orderNo'">
                <a-button type="link" class="link-cell" @click="openDetail(record)">
                  {{ record.orderNo }}
                </a-button>
                <div class="cell-sub">{{ record.orderDate }} 创建</div>
              </template>
              <template v-else-if="column.key === 'supplier'">
                <div class="cell-main">{{ record.supplierName }}</div>
                <div class="cell-sub">{{ record.contactName }} {{ record.contactPhone }}</div>
              </template>
              <template v-else-if="column.key === 'items'">
                <a-tooltip>
                  <template #title>
                    <div v-for="it in record.items" :key="it.id">
                      {{ it.title }} ×{{ it.expectQty }}（{{ it.batchNo }}）
                    </div>
                  </template>
                  <a-tag color="blue">{{ record.items.length }} 条明细</a-tag>
                </a-tooltip>
                <div class="cell-sub">{{ orderQtyText(record) }}</div>
              </template>
              <template v-else-if="column.key === 'progress'">
                <a-progress
                  :percent="orderProgress(record)"
                  :stroke-color="orderProgress(record) === 100 ? '#52c41a' : '#1890ff'"
                  size="small"
                />
                <div class="cell-sub">
                  已入 {{ acceptedQtyOf(record) }} / 退 {{ rejectedQtyOf(record) }}
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="ORDER_STATUS[record.status]?.color">
                  {{ ORDER_STATUS[record.status]?.text }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="0">
                  <a-button type="link" size="small" @click="openDetail(record)">
                    <EyeOutlined /> 详情
                  </a-button>
                  <a-button
                    type="link"
                    size="small"
                    :disabled="record.status !== 'pending'"
                    @click="openEdit(record)"
                  >
                    <EditOutlined /> 编辑
                  </a-button>
                  <a-popconfirm
                    title="确定删除该入库单吗？仅待验收单据可删除"
                    ok-text="删除"
                    cancel-text="取消"
                    :disabled="record.status !== 'pending'"
                    @confirm="handleDeleteOrder(record)"
                  >
                    <a-button
                      type="link"
                      size="small"
                      danger
                      :disabled="record.status !== 'pending'"
                    >
                      <DeleteOutlined /> 删除
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ================= Tab 2 验收工作台 ================= -->
        <a-tab-pane key="workbench">
          <template #tab>
            <a-badge :count="stats.pendingItems" :offset="[8, -2]" :number-style="{ backgroundColor: '#fa8c16' }">
              <span><AuditOutlined /> 验收工作台</span>
            </a-badge>
          </template>

          <div class="toolbar">
            <a-space wrap>
              <a-input
                v-model:value="workKeyword"
                placeholder="搜索单号 / 图书 / ISBN / 批次号"
                allow-clear
                style="width: 280px"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
              <a-select
                v-model:value="workStatusFilter"
                placeholder="明细状态"
                style="width: 140px"
              >
                <a-select-option value="pending">仅待处理（待验收/部分入库）</a-select-option>
                <a-select-option value="partial">部分入库</a-select-option>
                <a-select-option value="accepted">已入库</a-select-option>
                <a-select-option value="rejected">已退回</a-select-option>
              </a-select>
              <a-button @click="selectAllPending">
                <CheckSquareOutlined /> 全选待处理
              </a-button>
              <a-button @click="clearSelection">
                <BorderOutlined /> 清除选择
              </a-button>
            </a-space>
            <a-space>
              <a-button
                type="primary"
                :disabled="selectedRows.length === 0"
                :loading="inboundStore.processing"
                @click="openBatchAccept"
              >
                <CheckOutlined /> 批量验收入库<span v-if="selectedRows.length">（{{ selectedRows.length }}）</span>
              </a-button>
              <a-button
                danger
                :disabled="selectedRows.length === 0"
                :loading="inboundStore.processing"
                @click="handleBatchReturn"
              >
                <RollbackOutlined /> 多选退回<span v-if="selectedRows.length">（{{ selectedRows.length }}）</span>
              </a-button>
            </a-space>
          </div>

          <a-alert
            class="wb-tip"
            type="info"
            show-icon
            message="批量验收要求每条实收数量与待处理数量一致；数量不符、重复提交或同 ISBN+供应商批次重复入库的明细会逐条失败并保留待处理，可在操作列逐条验收（支持部分入库）或补充记录。"
          />

          <a-table
            :columns="workColumns"
            :data-source="filteredWorkItems"
            row-key="rowKey"
            :pagination="{ pageSize: 10, showTotal: t => `共 ${t} 条明细` }"
            :row-selection="{ selectedRowKeys: selectedKeys, onChange: onSelectChange, getCheckboxProps }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'orderNo'">
                <a-button type="link" class="link-cell" @click="openDetailByOrderId(record.orderId)">
                  {{ record.orderNo }}
                </a-button>
                <div class="cell-sub">{{ record.supplierName }}</div>
              </template>
              <template v-else-if="column.key === 'book'">
                <div class="cell-main">{{ record.title }}</div>
                <div class="cell-sub">{{ record.isbn }}</div>
              </template>
              <template v-else-if="column.key === 'batchNo'">
                <span :class="{ 'dup-text': isDupBatch(record) }">{{ record.batchNo }}</span>
                <a-tooltip v-if="isDupBatch(record)" :title="dupBatchTooltip(record)">
                  <WarningOutlined class="dup-icon" />
                </a-tooltip>
              </template>
              <template v-else-if="column.key === 'qty'">
                <div class="qty-stack">
                  <span>订 {{ record.expectQty }}</span>
                  <span class="ok">入 {{ record.acceptedQty }}</span>
                  <span class="fail">退 {{ record.rejectedQty }}</span>
                </div>
              </template>
              <template v-else-if="column.key === 'remaining'">
                <a-tag :color="remainingQty(record) > 0 ? 'orange' : 'default'">
                  {{ remainingQty(record) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="ITEM_STATUS[record.status]?.color">
                  {{ ITEM_STATUS[record.status]?.text }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="0" wrap>
                  <a-button
                    type="link"
                    size="small"
                    :disabled="remainingQty(record) === 0"
                    @click="openAccept(record)"
                  >
                    <CheckOutlined /> 验收
                  </a-button>
                  <a-button
                    type="link"
                    size="small"
                    danger
                    :disabled="remainingQty(record) === 0"
                    @click="openReturn(record)"
                  >
                    <RollbackOutlined /> 退回
                  </a-button>
                  <a-button type="link" size="small" @click="openNote(record)">
                    <EditOutlined /> 记录
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ================= Tab 3 验收记录 ================= -->
        <a-tab-pane key="records">
          <template #tab>
            <span><FileDoneOutlined /> 验收记录</span>
          </template>

          <div class="toolbar">
            <a-space wrap>
              <a-input
                v-model:value="recKeyword"
                placeholder="搜索单号 / 图书 / 批次 / 操作人"
                allow-clear
                style="width: 280px"
              >
                <template #prefix><SearchOutlined /></template>
              </a-input>
              <a-select
                v-model:value="recTypeFilter"
                placeholder="记录类型"
                allow-clear
                style="width: 140px"
              >
                <a-select-option value="accepted">验收入库</a-select-option>
                <a-select-option value="returned">退回</a-select-option>
                <a-select-option value="note">补充记录</a-select-option>
              </a-select>
            </a-space>
          </div>

          <a-table
            :columns="recordColumns"
            :data-source="filteredRecords"
            row-key="id"
            :pagination="{ pageSize: 10, showTotal: t => `共 ${t} 条记录` }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'orderNo'">
                <a-button type="link" class="link-cell" @click="openDetailByOrderId(record.orderId)">
                  {{ record.orderNo }}
                </a-button>
              </template>
              <template v-else-if="column.key === 'book'">
                <div class="cell-main">{{ record.bookTitle }}</div>
                <div class="cell-sub">{{ record.isbn }} · 批次 {{ record.batchNo }}</div>
              </template>
              <template v-else-if="column.key === 'type'">
                <a-tag :color="RECORD_TYPE[record.type]?.color">
                  {{ RECORD_TYPE[record.type]?.text }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'changeQty'">
                <span v-if="record.type === 'accepted'" class="ok">+{{ record.changeQty }}</span>
                <span v-else-if="record.type === 'returned'" class="fail">-{{ record.changeQty }}</span>
                <span v-else class="cell-sub">—</span>
              </template>
              <template v-else-if="column.key === 'remark'">
                <span>{{ record.remark || '—' }}</span>
              </template>
              <template v-else-if="column.key === 'operator'">
                <div class="cell-main">{{ record.operator }}</div>
                <div class="cell-sub">{{ record.createdAt }}</div>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 弹窗/抽屉 -->
    <OrderFormModal
      :open="formModal.open"
      :order="formModal.order"
      @success="handleFormSuccess"
      @cancel="formModal.open = false"
    />
    <AcceptItemModal
      :open="acceptModal.open"
      :order="acceptModal.order"
      :item="acceptModal.item"
      @success="handleSingleSuccess"
      @cancel="acceptModal.open = false"
    />
    <ReturnItemModal
      :open="returnModal.open"
      :order="returnModal.order"
      :item="returnModal.item"
      @success="handleSingleSuccess"
      @cancel="returnModal.open = false"
    />
    <NoteItemModal
      :open="noteModal.open"
      :order="noteModal.order"
      :item="noteModal.item"
      @success="handleSingleSuccess"
      @cancel="noteModal.open = false"
    />
    <BatchAcceptModal
      :open="batchAcceptOpen"
      :rows="batchRows"
      @submitted="handleBatchSubmitted"
      @cancel="batchAcceptOpen = false"
    />
    <BatchResultModal
      :open="resultModal.open"
      :mode="resultModal.mode"
      :results="resultModal.results"
      :success-count="resultModal.successCount"
      :failed-count="resultModal.failedCount"
      @close="resultModal.open = false"
      @retry="handleRetryFailed"
    />
    <OrderDetailDrawer
      :open="detailOpen"
      :order="detailOrder"
      @close="detailOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CheckSquareOutlined,
  BorderOutlined,
  RollbackOutlined,
  AuditOutlined,
  ProfileOutlined,
  CheckCircleOutlined,
  FileDoneOutlined,
  WarningOutlined
} from '@ant-design/icons-vue'
import { useInboundStore } from '@/stores/inbound'
import { ITEM_STATUS, ORDER_STATUS, RECORD_TYPE, remainingQty } from './inboundHelpers'
import OrderFormModal from './components/OrderFormModal.vue'
import AcceptItemModal from './components/AcceptItemModal.vue'
import ReturnItemModal from './components/ReturnItemModal.vue'
import NoteItemModal from './components/NoteItemModal.vue'
import BatchAcceptModal from './components/BatchAcceptModal.vue'
import BatchResultModal from './components/BatchResultModal.vue'
import OrderDetailDrawer from './components/OrderDetailDrawer.vue'

const inboundStore = useInboundStore()

const activeTab = ref('orders')

// ------------- 过滤 -------------
const orderKeyword = ref('')
const orderStatusFilter = ref(null)
const workKeyword = ref('')
const workStatusFilter = ref('pending')
const recKeyword = ref('')
const recTypeFilter = ref(null)

const filteredOrders = computed(() => {
  const kw = orderKeyword.value.trim().toLowerCase()
  return inboundStore.orders.filter(order => {
    if (orderStatusFilter.value && order.status !== orderStatusFilter.value) return false
    if (!kw) return true
    const inItems = order.items.some(it =>
      it.title.toLowerCase().includes(kw) || it.isbn.toLowerCase().includes(kw)
    )
    return order.orderNo.toLowerCase().includes(kw) ||
      order.supplierName.toLowerCase().includes(kw) ||
      inItems
  })
})

// 工作台行需要唯一 rowKey（同一 itemId 只出现一次）
const workRowsAll = computed(() =>
  inboundStore.flatItems.map(item => ({
    ...item,
    rowKey: `${item.orderId}_${item.id}`
  }))
)

const filteredWorkItems = computed(() => {
  const kw = workKeyword.value.trim().toLowerCase()
  return workRowsAll.value.filter(item => {
    // 默认只看待处理
    if (workStatusFilter.value === 'pending') {
      if (item.status !== 'pending' && item.status !== 'partial') return false
    } else if (workStatusFilter.value && item.status !== workStatusFilter.value) {
      return false
    }
    if (!kw) return true
    return item.orderNo.toLowerCase().includes(kw) ||
      item.title.toLowerCase().includes(kw) ||
      item.isbn.toLowerCase().includes(kw) ||
      (item.batchNo || '').toLowerCase().includes(kw)
  })
})

const filteredRecords = computed(() => {
  const kw = recKeyword.value.trim().toLowerCase()
  return inboundStore.records.filter(rec => {
    if (recTypeFilter.value && rec.type !== recTypeFilter.value) return false
    if (!kw) return true
    return rec.orderNo.toLowerCase().includes(kw) ||
      rec.bookTitle.toLowerCase().includes(kw) ||
      (rec.batchNo || '').toLowerCase().includes(kw) ||
      rec.operator.toLowerCase().includes(kw)
  })
})

// ------------- 统计 -------------
const stats = computed(() => {
  const orders = inboundStore.orders
  const today = new Date().toISOString().split('T')[0]
  return {
    pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'accepting').length,
    pendingItems: inboundStore.pendingItems.length,
    todayAcceptedQty: inboundStore.records
      .filter(r => r.type === 'accepted' && r.createdAt?.slice(0, 10) === today)
      .reduce((s, r) => s + r.changeQty, 0),
    rejectedQty: inboundStore.records
      .filter(r => r.type === 'returned')
      .reduce((s, r) => s + r.changeQty, 0)
  }
})

// ------------- 表格列 -------------
const orderColumns = [
  { title: '入库单号', key: 'orderNo', width: 180 },
  { title: '供应商', key: 'supplier', width: 190 },
  { title: '明细 / 采购数量', key: 'items', width: 150 },
  { title: '验收进度', key: 'progress', width: 170 },
  { title: '状态', key: 'status', width: 90, align: 'center' },
  { title: '操作', key: 'action', width: 200, fixed: 'right' }
]

const workColumns = [
  { title: '入库单', key: 'orderNo', width: 150 },
  { title: '图书', key: 'book', width: 200 },
  { title: '供应商批次', key: 'batchNo', width: 160 },
  { title: '订/入/退', key: 'qty', width: 130 },
  { title: '待处理', key: 'remaining', width: 80, align: 'center' },
  { title: '状态', key: 'status', width: 90, align: 'center' },
  { title: '逐条操作', key: 'action', width: 210, fixed: 'right' }
]

const recordColumns = [
  { title: '入库单号', key: 'orderNo', width: 140 },
  { title: '图书 / 批次', key: 'book', width: 250 },
  { title: '类型', key: 'type', width: 100, align: 'center' },
  { title: '数量变动', key: 'changeQty', width: 90, align: 'center' },
  { title: '说明', key: 'remark' },
  { title: '操作人 / 时间', key: 'operator', width: 170 }
]

function acceptedQtyOf(order) {
  return order.items.reduce((s, it) => s + Number(it.acceptedQty || 0), 0)
}
function rejectedQtyOf(order) {
  return order.items.reduce((s, it) => s + Number(it.rejectedQty || 0), 0)
}
function totalQtyOf(order) {
  return order.items.reduce((s, it) => s + Number(it.expectQty || 0), 0)
}
function orderQtyText(order) {
  return `共采购 ${totalQtyOf(order)} 册`
}
function orderProgress(order) {
  const total = totalQtyOf(order)
  if (!total) return 0
  const done = acceptedQtyOf(order) + rejectedQtyOf(order)
  return Math.min(100, Math.round((done / total) * 100))
}

// ------------- 批次重复预判 -------------
function isDupBatch(row) {
  if (row.status === 'accepted') return false
  return !!inboundStore.findDuplicateBatch(row.isbn, row.batchNo, row.id)
}
function dupBatchTooltip(row) {
  const dup = inboundStore.findDuplicateBatch(row.isbn, row.batchNo, row.id)
  return dup ? `批次已在 ${dup.orderNo} 验收入库，重复入库将被拦截` : ''
}

// ------------- 选择 -------------
const selectedKeys = ref([])
const selectedRows = ref([])

function getCheckboxProps(record) {
  return { disabled: remainingQty(record) === 0 }
}
function onSelectChange(keys, rows) {
  selectedKeys.value = keys
  selectedRows.value = rows
}
function selectAllPending() {
  const pending = filteredWorkItems.value.filter(it => remainingQty(it) > 0)
  selectedKeys.value = pending.map(it => it.rowKey)
  selectedRows.value = pending
  message.info(`已勾选 ${pending.length} 条待处理明细`)
}
function clearSelection() {
  selectedKeys.value = []
  selectedRows.value = []
}

// ------------- 弹窗状态 -------------
const formModal = reactive({ open: false, order: null })
const acceptModal = reactive({ open: false, order: null, item: null })
const returnModal = reactive({ open: false, order: null, item: null })
const noteModal = reactive({ open: false, order: null, item: null })
const batchAcceptOpen = ref(false)
const batchRows = ref([])
const resultModal = reactive({
  open: false,
  mode: 'accept',
  results: [],
  successCount: 0,
  failedCount: 0
})
const detailOpen = ref(false)
const detailOrder = ref(null)

// ------------- 单据 -------------
function openCreate() {
  formModal.order = null
  formModal.open = true
}
function openEdit(record) {
  formModal.order = inboundStore.getOrderById(record.id)
  formModal.open = true
}
function handleFormSuccess() {
  formModal.open = false
}
function handleDeleteOrder(record) {
  const ok = inboundStore.deleteOrder(record.id)
  if (ok) message.success('入库单已删除')
  else message.error('仅待验收单据可以删除')
}
function openDetail(record) {
  detailOrder.value = inboundStore.getOrderById(record.id)
  detailOpen.value = true
}
function openDetailByOrderId(orderId) {
  const order = inboundStore.getOrderById(orderId)
  if (order) {
    detailOrder.value = order
    detailOpen.value = true
  }
}

// 从 flat 行定位原始 order/item（保证编辑的是 store 内响应式对象）
function resolveOrderItem(row) {
  return inboundStore.getItem(row.orderId, row.id)
}

// ------------- 逐条操作 -------------
function openAccept(row) {
  const { order, item } = resolveOrderItem(row)
  if (!item) {
    message.error('明细不存在，可能已被删除')
    return
  }
  acceptModal.order = order
  acceptModal.item = item
  acceptModal.open = true
}
function openReturn(row) {
  const { order, item } = resolveOrderItem(row)
  if (!item) {
    message.error('明细不存在，可能已被删除')
    return
  }
  returnModal.order = order
  returnModal.item = item
  returnModal.open = true
}
function openNote(row) {
  const { order, item } = resolveOrderItem(row)
  if (!item) {
    message.error('明细不存在，可能已被删除')
    return
  }
  noteModal.order = order
  noteModal.item = item
  noteModal.open = true
}

// 单条操作后：关闭弹窗、清掉该行选择（成功项不应再被批量重复提交）
function handleSingleSuccess() {
  acceptModal.open = false
  returnModal.open = false
  noteModal.open = false
  pruneSelection()
}

// 依据最新 store 状态清理选择集合中已经处理完的行
function pruneSelection() {
  const valid = []
  selectedKeys.value = selectedKeys.value.filter(key => {
    const [orderIdStr, itemIdStr] = String(key).split('_')
    const { item } = inboundStore.getItem(Number(orderIdStr), Number(itemIdStr))
    if (item && remainingQty(item) > 0) {
      valid.push(key)
      return true
    }
    return false
  })
  selectedRows.value = selectedRows.value.filter(row => valid.includes(row.rowKey))
}

// ------------- 批量验收 -------------
function openBatchAccept() {
  if (selectedRows.value.length === 0) {
    message.warning('请先勾选需要验收的明细')
    return
  }
  // 深拷贝一份给弹窗编辑实收数量，取消时不影响表格
  batchRows.value = selectedRows.value.map(row => ({
    orderId: row.orderId,
    itemId: row.id,
    orderNo: row.orderNo,
    supplierName: row.supplierName,
    isbn: row.isbn,
    title: row.title,
    batchNo: row.batchNo,
    expectQty: row.expectQty
  }))
  batchAcceptOpen.value = true
}

function showResult(mode, result) {
  resultModal.mode = mode
  resultModal.results = result.results
  resultModal.successCount = result.successCount
  resultModal.failedCount = result.failedCount
  resultModal.open = true
  pruneSelection()
}

function handleBatchSubmitted(payload) {
  batchAcceptOpen.value = false
  if (payload.blocked) {
    message.warning(payload.message)
    return
  }
  if (payload.results.some(r => !r.ok)) {
    message.warning(payload.message)
  } else {
    message.success(payload.message)
  }
  showResult('accept', payload)
}

// 失败项「继续处理」：回填勾选并切回工作台筛选，状态保持不错配
function handleRetryFailed(failedItems) {
  resultModal.open = false
  activeTab.value = 'workbench'
  workStatusFilter.value = 'pending'

  const rows = []
  const keys = []
  failedItems.forEach(f => {
    const { item } = inboundStore.getItem(f.orderId, f.itemId)
    if (item && remainingQty(item) > 0) {
      const row = workRowsAll.value.find(r => r.orderId === f.orderId && r.id === f.itemId)
      if (row) {
        rows.push(row)
        keys.push(row.rowKey)
      }
    }
  })
  selectedRows.value = rows
  selectedKeys.value = keys
  workKeyword.value = ''
  if (rows.length === 0) {
    message.info('失败项已无待处理数量，请刷新确认状态')
  } else {
    message.info(`已保留 ${rows.length} 个待处理项，可修正后重新批量验收或逐条处理`)
  }
}

// ------------- 多选退回 -------------
function handleBatchReturn() {
  if (selectedRows.value.length === 0) {
    message.warning('请先勾选需要退回的明细')
    return
  }
  Modal.confirm({
    title: `确认退回已勾选的 ${selectedRows.value.length} 条明细？`,
    content: '将按各明细待处理数量整批退回供应商，不增加馆藏与可借库存，操作全程记录。',
    okText: '确认退回',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      const payload = inboundStore.batchReturn(selectedRows.value)
      if (payload.results.some(r => !r.ok)) {
        message.warning(payload.message)
      } else {
        message.success(payload.message)
      }
      showResult('return', payload)
    }
  })
}
</script>

<style lang="less" scoped>
.inbound-page {
  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 20px;
  }
}

.stat-row {
  margin-bottom: 16px;
}

.stat-card-mini {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 14px;
  height: 100%;
  border-left: 4px solid transparent;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  .mini-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #fff;
  }

  .mini-value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.2;
  }
  .mini-label {
    font-size: 13px;
    color: #999;
  }

  &.pending {
    border-left-color: #faad14;
    .mini-icon { background: linear-gradient(135deg, #faad14, #ffc53d); }
    .mini-value { color: #faad14; }
  }
  &.processing {
    border-left-color: #1890ff;
    .mini-icon { background: linear-gradient(135deg, #1890ff, #40a9ff); }
    .mini-value { color: #1890ff; }
  }
  &.accepted {
    border-left-color: #52c41a;
    .mini-icon { background: linear-gradient(135deg, #52c41a, #73d13d); }
    .mini-value { color: #52c41a; }
  }
  &.rejected {
    border-left-color: #ff4d4f;
    .mini-icon { background: linear-gradient(135deg, #ff4d4f, #ff7875); }
    .mini-value { color: #ff4d4f; }
  }
}

.tab-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 8px 20px 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.cell-main {
  font-weight: 500;
  color: #1a1a1a;
}
.cell-sub {
  font-size: 12px;
  color: #999;
}
.link-cell {
  padding-left: 0;
  font-weight: 600;
}

.ok { color: #52c41a; font-weight: 500; }
.fail { color: #ff4d4f; font-weight: 500; }

.dup-text {
  color: #ff4d4f;
}
.dup-icon {
  color: #ff4d4f;
  margin-left: 4px;
}

.qty-stack {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.wb-tip {
  margin-bottom: 16px;
  border-radius: 8px;
}
</style>
