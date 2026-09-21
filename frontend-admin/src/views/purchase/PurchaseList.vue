<template>
  <div class="purchase-list">
    <h2 class="page-title animate-fade-in">采购入库与验收</h2>

    <!-- 统计卡片 -->
    <a-row :gutter="[16, 16]" class="stat-row">
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich total">
          <div class="stat-card-header">
            <div class="stat-card-icon"><FileTextOutlined /></div>
            <div class="stat-card-trend"><ProfileOutlined /><span>{{ purchaseStore.todayInboundCount }} 单今日入库</span></div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ purchaseStore.totalOrders }}</div>
            <div class="stat-card-label">入库单总数</div>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich pending">
          <div class="stat-card-header">
            <div class="stat-card-icon"><ClockCircleOutlined /></div>
            <div class="stat-card-badge warning" v-if="purchaseStore.pendingCount > 0"><HourglassOutlined /></div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ purchaseStore.pendingCount }}</div>
            <div class="stat-card-label">待验收 / 待处理</div>
          </div>
          <div class="stat-card-footer">
            <span>待处理数量 <strong>{{ purchaseStore.pendingQuantity }}</strong> 册</span>
          </div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich done">
          <div class="stat-card-header">
            <div class="stat-card-icon"><CheckCircleOutlined /></div>
            <div class="stat-card-badge success"><CheckOutlined /></div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ purchaseStore.completedCount }}</div>
            <div class="stat-card-label">已验收入库</div>
          </div>
          <div class="stat-card-footer"><span class="success-text">已同步可借库存</span></div>
        </div>
      </a-col>
      <a-col :xs="12" :sm="12" :md="6">
        <div class="stat-card-rich returned">
          <div class="stat-card-header">
            <div class="stat-card-icon"><RollbackOutlined /></div>
            <div class="stat-card-badge danger"><CloseOutlined /></div>
          </div>
          <div class="stat-card-body">
            <div class="stat-card-value">{{ purchaseStore.returnedCount }}</div>
            <div class="stat-card-label">已退回</div>
          </div>
          <div class="stat-card-footer"><span class="muted-text">退回供应商处理</span></div>
        </div>
      </a-col>
    </a-row>

    <!-- 搜索与批量操作 -->
    <div class="search-area animate-slide-down">
      <a-row :gutter="16" align="middle">
        <a-col :xs="24" :sm="12" :md="7" :lg="6">
          <a-input
            v-model:value="searchKeyword"
            placeholder="搜索单号、书名、ISBN、供应商、批次"
            allow-clear
          >
            <template #suffix><SearchOutlined class="search-icon" /></template>
          </a-input>
        </a-col>
        <a-col :xs="12" :sm="6" :md="4" :lg="3">
          <a-select v-model:value="filterStatus" placeholder="单据状态" allow-clear style="width: 100%">
            <a-select-option value="pending">待验收</a-select-option>
            <a-select-option value="partial">部分验收</a-select-option>
            <a-select-option value="completed">已入库</a-select-option>
            <a-select-option value="returned">已退回</a-select-option>
          </a-select>
        </a-col>
        <a-col :xs="12" :sm="6" :md="5" :lg="4">
          <a-select v-model:value="filterSupplier" placeholder="供应商" allow-clear show-search option-filter-prop="children" style="width: 100%">
            <a-select-option v-for="s in purchaseStore.getSupplierOptions()" :key="s" :value="s">{{ s }}</a-select-option>
          </a-select>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="11" style="text-align: right;">
          <a-space wrap>
            <a-button type="primary" :disabled="selectableSelectedRows.length === 0" @click="openBatchAccept">
              <CheckCircleOutlined /> 批量验收入库<span v-if="selectableSelectedRows.length">（{{ selectableSelectedRows.length }}）</span>
            </a-button>
            <a-button danger :disabled="selectableSelectedRows.length === 0" @click="openBatchReturn">
              <RollbackOutlined /> 多选退回<span v-if="selectableSelectedRows.length">（{{ selectableSelectedRows.length }}）</span>
            </a-button>
            <a-button type="primary" ghost @click="showAddModal">
              <PlusOutlined /> 新增入库单
            </a-button>
          </a-space>
        </a-col>
      </a-row>
      <div v-if="searchKeyword || filterStatus || filterSupplier" class="search-result-tip">
        <span class="result-count">找到 <strong>{{ filteredOrders.length }}</strong> 条单据</span>
        <a-button type="link" size="small" @click="clearFilters">清除筛选</a-button>
      </div>
    </div>

    <!-- 入库单表格 -->
    <div class="table-container animate-fade-in">
      <a-table
        :columns="columns"
        :data-source="filteredOrders"
        row-key="id"
        :row-selection="rowSelection"
        :pagination="{ pageSize: 10, showTotal: total => `共 ${total} 条` }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'order'">
            <div class="text-primary">{{ record.orderNo }}</div>
            <div class="text-secondary">{{ record.orderDate }} 制单</div>
          </template>
          <template v-else-if="column.key === 'book'">
            <div class="text-primary">{{ record.title }}</div>
            <div class="text-secondary">ISBN: {{ record.isbn }}</div>
          </template>
          <template v-else-if="column.key === 'supplier'">
            <div>{{ record.supplier }}</div>
            <div class="text-secondary">批次: {{ record.batchNo }}</div>
          </template>
          <template v-else-if="column.key === 'quantity'">
            <div class="qty-cell">
              <span>采购 <b>{{ record.quantity }}</b></span>
              <span class="qty-detail">
                已收 <span class="ok">{{ record.receivedQuantity }}</span>
                / 退回 <span class="err">{{ record.returnedQuantity }}</span>
              </span>
              <a-progress
                :percent="receivedPercent(record)"
                size="small"
                :stroke-color="record.receivedQuantity > 0 ? '#52c41a' : '#d9d9d9'"
                :show-info="false"
                style="width: 110px"
              />
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-space direction="vertical" :size="2">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
              <a-tag v-if="isPartialReturned(record)" color="orange" class="mini-tag">部分入库后退回</a-tag>
              <a-tag v-else-if="record.status === 'partial'" color="gold" class="mini-tag">余 {{ purchaseStore.remainingQuantity(record) }} 本待处理</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-tooltip :title="record.status === 'completed' || record.status === 'returned' ? '终态单据不可验收（防重复提交）' : ''">
                <a-button
                  type="link" size="small" class="act-btn"
                  :disabled="isLocked(record)"
                  @click="quickAccept(record)"
                >
                  <CheckOutlined /> 验收入库
                </a-button>
              </a-tooltip>
              <a-button
                type="link" size="small" class="act-btn"
                :disabled="isLocked(record)"
                @click="openSupplement(record)"
              >
                <FormOutlined /> 补充记录
              </a-button>
              <a-button
                type="link" size="small" danger class="act-btn"
                :disabled="isLocked(record)"
                @click="openSingleReturn(record)"
              >
                <RollbackOutlined /> 退回
              </a-button>
              <a-button type="link" size="small" @click="openRecords(record)">
                <UnorderedListOutlined /> 记录
              </a-button>
              <a-popconfirm
                title="确定删除该入库单吗？仅未入库的单据可删除。"
                ok-text="删除" cancel-text="取消"
                @confirm="handleDelete(record)"
              >
                <a-button type="link" size="small" danger class="act-btn" :disabled="record.receivedQuantity > 0">
                  <DeleteOutlined />
                </a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 批量验收弹窗 -->
    <a-modal
      v-model:open="batchAcceptVisible"
      title="批量验收入库"
      width="760px"
      ok-text="逐条验收"
      cancel-text="取消"
      :confirm-loading="batchLoading"
      @ok="submitBatchAccept"
    >
      <a-alert
        type="info" show-icon style="margin-bottom: 12px"
        message="将逐条执行验收：数量留空表示全部合格；数量不符或同批次重复入库的单据会被拦截并保留待处理，不影响其他单据。"
      />
      <a-table
        :columns="batchAcceptColumns"
        :data-source="batchAcceptList"
        row-key="id"
        :pagination="false"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'book'">
            <div class="text-primary">{{ record.title }}</div>
            <div class="text-secondary">{{ record.orderNo }} · 批次 {{ record.batchNo }}</div>
          </template>
          <template v-else-if="column.key === 'expect'">
            待处理 <b>{{ record.remain }}</b> / 采购 {{ record.quantity }}
          </template>
          <template v-else-if="column.key === 'received'">
            <a-input-number v-model:value="record.receivedQuantity" :min="0" :max="record.remain" :precision="0" style="width: 100%" placeholder="留空=全部" />
          </template>
        </template>
      </a-table>
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="验收备注（统一附加到每条记录）">
          <a-textarea v-model:value="batchNote" :rows="2" placeholder="如：随书清单核对一致" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 退回弹窗（单条 / 多选共用） -->
    <a-modal
      v-model:open="returnVisible"
      :title="returnTargets.length > 1 ? `多选退回（${returnTargets.length} 单）` : '退回入库单'"
      width="640px"
      ok-text="确认退回"
      cancel-text="取消"
      :ok-button-props="{ danger: true }"
      :confirm-loading="batchLoading"
      @ok="submitReturn"
    >
      <a-alert type="warning" show-icon style="margin-bottom: 12px"
        message="退回仅处理剩余待处理数量，已经验收入库的库存不会被扣减；退回后单据不再参与验收。" />
      <div v-for="r in returnTargets" :key="r.id" class="return-row">
        <div class="return-info">
          <div class="text-primary">{{ r.title }}</div>
          <div class="text-secondary">{{ r.orderNo }} · 批次 {{ r.batchNo }} · 待处理 {{ purchaseStore.remainingQuantity(r) }} 本</div>
        </div>
        <a-input-number v-model:value="returnFormMap[r.id]" :min="1" :max="purchaseStore.remainingQuantity(r)" :precision="0" addon-after="本" style="width: 150px" />
      </div>
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="退回原因">
          <a-textarea v-model:value="returnReason" :rows="2" placeholder="如：数量不符 / 破损 / 同批次重复配送" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 逐条补充记录弹窗 -->
    <a-modal
      v-model:open="supplementVisible"
      title="逐条补充验收记录"
      width="560px"
      ok-text="提交验收"
      cancel-text="取消"
      :confirm-loading="batchLoading"
      @ok="submitSupplement"
    >
      <a-descriptions v-if="supplementTarget" :column="1" size="small" bordered style="margin-bottom: 16px">
        <a-descriptions-item label="单号 / 批次">{{ supplementTarget.orderNo }} / {{ supplementTarget.batchNo }}</a-descriptions-item>
        <a-descriptions-item label="图书">{{ supplementTarget.title }}（{{ supplementTarget.isbn }}）</a-descriptions-item>
        <a-descriptions-item label="数量情况">
          采购 {{ supplementTarget.quantity }}，已收 {{ supplementTarget.receivedQuantity }}，
          退回 {{ supplementTarget.returnedQuantity }}，剩余待处理 <b>{{ purchaseStore.remainingQuantity(supplementTarget) }}</b>
        </a-descriptions-item>
      </a-descriptions>
      <a-form :label-col="{ span: 5 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="实收数量" required>
          <a-input-number v-model:value="supplementForm.received" :min="0" :max="supplementTarget ? purchaseStore.remainingQuantity(supplementTarget) : 0" :precision="0" style="width: 100%" addon-after="本" />
          <div class="text-secondary">留空或填最大数 = 全部合格；小于待处理数 = 部分验收，剩余项继续保留</div>
        </a-form-item>
        <a-form-item label="验收备注">
          <a-textarea v-model:value="supplementForm.note" :rows="3" placeholder="填写验收情况，如：2 本封面磨损按合格入库，差额待供应商补发" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 验收流水抽屉 -->
    <a-drawer v-model:open="recordsVisible" title="验收 / 退回流水" width="520px">
      <template v-if="recordsTarget">
        <a-descriptions :column="1" size="small" bordered style="margin-bottom: 16px">
          <a-descriptions-item label="入库单号">{{ recordsTarget.orderNo }}</a-descriptions-item>
          <a-descriptions-item label="图书">{{ recordsTarget.title }}</a-descriptions-item>
          <a-descriptions-item label="供应商 / 批次">{{ recordsTarget.supplier }} / {{ recordsTarget.batchNo }}</a-descriptions-item>
          <a-descriptions-item label="数量">
            采购 {{ recordsTarget.quantity }}，入库 {{ recordsTarget.receivedQuantity }}，退回 {{ recordsTarget.returnedQuantity }}
          </a-descriptions-item>
          <a-descriptions-item label="当前状态">
            <a-tag :color="statusColor(recordsTarget.status)">{{ statusText(recordsTarget.status) }}</a-tag>
          </a-descriptions-item>
        </a-descriptions>
        <a-timeline v-if="recordsTarget.records && recordsTarget.records.length">
          <a-timeline-item v-for="rec in [...recordsTarget.records].reverse()" :key="rec.id" :color="recordDotColor(rec.action)">
            <div class="rec-head">
              <a-tag :color="rec.action === 'accept' ? 'green' : 'red'" class="mini-tag">
                {{ rec.action === 'accept' ? '验收入库' : '退回' }} {{ rec.quantity }} 本
              </a-tag>
              <span class="text-secondary">{{ rec.time }}</span>
            </div>
            <div v-if="rec.note" class="rec-note">{{ rec.note }}</div>
            <div class="text-secondary">
              <template v-if="rec.action === 'accept'">
                <span v-if="rec.createdBook">新品种已自动建档 · </span>
                入库后可借库存：{{ rec.stockAfter }} 本
              </template>
            </div>
          </a-timeline-item>
        </a-timeline>
        <a-empty v-else description="暂无验收记录" />
      </template>
    </a-drawer>

    <!-- 新增入库单弹窗 -->
    <a-modal
      v-model:open="addVisible"
      title="新增采购入库单"
      width="720px"
      ok-text="保存单据"
      cancel-text="取消"
      :confirm-loading="addLoading"
      @ok="submitAdd"
    >
      <a-form ref="addFormRef" :model="addForm" :rules="addRules" :label-col="{ span: 5 }" :wrapper-col="{ span: 19 }">
        <a-form-item label="ISBN" name="isbn">
          <a-input-search v-model:value="addForm.isbn" placeholder="输入 ISBN 后点击匹配，自动带出馆藏图书信息" enter-button="匹配馆藏" @search="matchBook" />
        </a-form-item>
        <a-form-item label="书名" name="title">
          <a-input v-model:value="addForm.title" placeholder="采购图书名称" />
        </a-form-item>
        <a-row>
          <a-col :span="12">
            <a-form-item label="作者" name="author" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }">
              <a-input v-model:value="addForm.author" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="出版社" name="publisher" :label-col="{ span: 8 }" :wrapper-col="{ span: 15 }">
              <a-input v-model:value="addForm.publisher" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row>
          <a-col :span="12">
            <a-form-item label="分类" name="categoryId" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }">
              <a-select v-model:value="addForm.categoryId" placeholder="选择分类" @change="onAddCategoryChange">
                <a-select-option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">{{ c.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="单价" name="price" :label-col="{ span: 8 }" :wrapper-col="{ span: 15 }">
              <a-input-number v-model:value="addForm.price" :min="0" :precision="2" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="供应商" name="supplier">
          <a-input v-model:value="addForm.supplier" placeholder="如：新华书店总店" />
        </a-form-item>
        <a-row>
          <a-col :span="12">
            <a-form-item label="供应商批次" name="batchNo" :label-col="{ span: 10 }" :wrapper-col="{ span: 13 }">
              <a-input v-model:value="addForm.batchNo" placeholder="如：P20240320" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="采购数量" name="quantity" :label-col="{ span: 8 }" :wrapper-col="{ span: 15 }">
              <a-input-number v-model:value="addForm.quantity" :min="1" :precision="0" style="width: 100%" addon-after="本" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="存放位置" name="location">
          <a-input v-model:value="addForm.location" placeholder="验收入库后上架位置，如 B区-02-20" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="addForm.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量操作逐条结果 -->
    <a-result-modal
      v-if="resultVisible"
      :results="batchResults"
      :action="resultAction"
      @close="closeResult"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, CheckOutlined, CloseOutlined, CheckCircleOutlined, ClockCircleOutlined,
  RollbackOutlined, FileTextOutlined, ProfileOutlined, SearchOutlined, FormOutlined,
  UnorderedListOutlined, DeleteOutlined, HourglassOutlined
} from '@ant-design/icons-vue'
import { usePurchaseStore, RESULT_TEXT } from '@/stores/purchase'
import { useBookStore } from '@/stores/book'
import { useCategoryStore } from '@/stores/category'
import ResultModal from '@/views/purchase/ResultModal.vue'

const purchaseStore = usePurchaseStore()
const bookStore = useBookStore()
const categoryStore = useCategoryStore()

// ---------- 筛选 ----------
const searchKeyword = ref('')
const filterStatus = ref(null)
const filterSupplier = ref(null)
const selectedRowKeys = ref([])

function clearFilters() {
  searchKeyword.value = ''
  filterStatus.value = null
  filterSupplier.value = null
}

const filteredOrders = computed(() => {
  let result = purchaseStore.orders
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    result = result.filter(o =>
      o.orderNo.toLowerCase().includes(kw) ||
      o.title.toLowerCase().includes(kw) ||
      o.isbn.toLowerCase().includes(kw) ||
      (o.supplier || '').toLowerCase().includes(kw) ||
      (o.batchNo || '').toLowerCase().includes(kw)
    )
  }
  if (filterStatus.value) result = result.filter(o => o.status === filterStatus.value)
  if (filterSupplier.value) result = result.filter(o => o.supplier === filterSupplier.value)
  return result
})

const columns = [
  { title: '入库单', key: 'order', width: 160 },
  { title: '图书 / ISBN', key: 'book', width: 220 },
  { title: '供应商 / 批次', key: 'supplier', width: 200 },
  { title: '数量与验收', key: 'quantity', width: 190 },
  { title: '状态', key: 'status', width: 150 },
  { title: '操作', key: 'action', width: 300, fixed: 'right' }
]

// 终态（已入库 / 已退回）禁止勾选，从入口上防止重复提交
const selectableStatuses = ['pending', 'partial']
const isLocked = record => !selectableStatuses.includes(record.status)
const isPartialReturned = record => record.status === 'returned' && Number(record.receivedQuantity || 0) > 0

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: keys => { selectedRowKeys.value = keys },
  getCheckboxProps: record => ({
    disabled: isLocked(record),
    title: isLocked(record) ? '该单已处理，无需重复验收' : ''
  }),
  preserveSelectedRowKeys: true
}))

const selectableSelectedRows = computed(() =>
  selectedRowKeys.value
    .map(id => purchaseStore.getOrderById(id))
    .filter(o => o && !isLocked(o))
)

function receivedPercent(record) {
  if (!record.quantity) return 0
  return Math.round((Number(record.receivedQuantity || 0) / record.quantity) * 100)
}

function statusColor(status) {
  return { pending: 'default', partial: 'warning', completed: 'success', returned: 'error' }[status] || 'default'
}
function statusText(status) {
  return { pending: '待验收', partial: '部分验收', completed: '已入库', returned: '已退回' }[status] || status
}
function recordDotColor(action) {
  return action === 'accept' ? 'green' : 'red'
}

// ---------- 批量验收 ----------
const batchAcceptVisible = ref(false)
const batchLoading = ref(false)
const batchAcceptList = ref([])
const batchNote = ref('')
const batchAcceptColumns = [
  { title: '单据 / 图书', key: 'book' },
  { title: '数量', key: 'expect', width: 180 },
  { title: '本次实收', key: 'received', width: 150 }
]

function openBatchAccept() {
  if (selectableSelectedRows.value.length === 0) {
    message.warning('请先勾选待验收单据')
    return
  }
  batchAcceptList.value = selectableSelectedRows.value.map(o => ({
    id: o.id,
    orderNo: o.orderNo,
    title: o.title,
    isbn: o.isbn,
    batchNo: o.batchNo,
    quantity: o.quantity,
    remain: purchaseStore.remainingQuantity(o),
    receivedQuantity: null
  }))
  batchNote.value = ''
  batchAcceptVisible.value = true
}

async function submitBatchAccept() {
  const items = batchAcceptList.value
  const invalid = items.find(i => i.receivedQuantity !== null && (i.receivedQuantity < 0 || i.receivedQuantity > i.remain))
  if (invalid) {
    message.error(`《${invalid.title}》实收数量超出待处理范围`)
    return
  }
  batchLoading.value = true
  // 模拟接口延迟，期间按钮禁用，杜绝双击重复提交
  await new Promise(r => setTimeout(r, 400))
  const results = purchaseStore.batchAccept(items.map(i => ({
    id: i.id, orderNo: i.orderNo, title: i.title, isbn: i.isbn,
    receivedQuantity: i.receivedQuantity, note: batchNote.value
  })))
  batchLoading.value = false
  batchAcceptVisible.value = false
  showResults(results, 'accept')
}

// ---------- 退回（单条 / 多选） ----------
const returnVisible = ref(false)
const returnTargets = ref([])
const returnFormMap = reactive({})
const returnReason = ref('')

function openBatchReturn() {
  if (selectableSelectedRows.value.length === 0) {
    message.warning('请先勾选需要退回的单据')
    return
  }
  setupReturn(selectableSelectedRows.value)
}
function openSingleReturn(record) {
  setupReturn([record])
}
function setupReturn(rows) {
  returnTargets.value = rows
  Object.keys(returnFormMap).forEach(k => delete returnFormMap[k])
  rows.forEach(o => { returnFormMap[o.id] = purchaseStore.remainingQuantity(o) })
  returnReason.value = ''
  returnVisible.value = true
}

async function submitReturn() {
  const items = returnTargets.value
  for (const o of items) {
    const q = returnFormMap[o.id]
    if (q === null || q === undefined || q <= 0 || q > purchaseStore.remainingQuantity(o)) {
      message.error(`《${o.title}》退回数量无效`)
      return
    }
  }
  batchLoading.value = true
  await new Promise(r => setTimeout(r, 300))
  const results = purchaseStore.batchReturn(items.map(o => ({
    id: o.id, orderNo: o.orderNo, title: o.title, isbn: o.isbn,
    quantity: returnFormMap[o.id], reason: returnReason.value
  })))
  batchLoading.value = false
  returnVisible.value = false
  showResults(results, 'return')
}

// ---------- 逐条快捷验收 ----------
function quickAccept(record) {
  Modal.confirm({
    title: `验收入库：${record.title}`,
    content: `按全部合格处理 ${purchaseStore.remainingQuantity(record)} 本并同步可借库存？如需填写实收数量或备注，请使用"补充记录"。`,
    okText: '全部验收入库',
    cancelText: '取消',
    onOk: () => {
      const result = purchaseStore.acceptOrder({
        id: record.id, orderNo: record.orderNo, title: record.title, isbn: record.isbn,
        receivedQuantity: null, note: ''
      })
      message[result.success ? 'success' : 'error']({
        content: result.message,
        duration: result.success ? 3 : 5
      })
    }
  })
}

// ---------- 逐条补充 ----------
const supplementVisible = ref(false)
const supplementTarget = ref(null)
const supplementForm = reactive({ received: null, note: '' })

function openSupplement(record) {
  supplementTarget.value = record
  supplementForm.received = purchaseStore.remainingQuantity(record)
  supplementForm.note = ''
  supplementVisible.value = true
}

function submitSupplement() {
  const target = supplementTarget.value
  const remain = purchaseStore.remainingQuantity(target)
  if (supplementForm.received === null || supplementForm.received === undefined || supplementForm.received < 0 || supplementForm.received > remain) {
    message.error(`请输入 0 ~ ${remain} 之间的实收数量`)
    return
  }
  const result = purchaseStore.acceptOrder({
    id: target.id, orderNo: target.orderNo, title: target.title, isbn: target.isbn,
    receivedQuantity: supplementForm.received, note: supplementForm.note
  })
  message[result.success ? 'success' : 'error']({ content: result.message, duration: 5 })
  if (result.success) supplementVisible.value = false
}

// ---------- 流水 ----------
const recordsVisible = ref(false)
const recordsTarget = ref(null)
function openRecords(record) {
  recordsTarget.value = purchaseStore.getOrderById(record.id)
  recordsVisible.value = true
}

// ---------- 删除 ----------
function handleDelete(record) {
  const ok = purchaseStore.deleteOrder(record.id)
  if (ok) {
    selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== record.id)
    message.success('入库单已删除')
  } else {
    message.error('已有入库记录的单据不能删除')
  }
}

// ---------- 新增入库单 ----------
const addVisible = ref(false)
const addLoading = ref(false)
const addFormRef = ref(null)

function defaultAddForm() {
  return {
    isbn: '', title: '', author: '', publisher: '',
    categoryId: null, price: 0, supplier: '', batchNo: '',
    quantity: 1, location: '', remark: ''
  }
}
const addForm = reactive(defaultAddForm())
const addRules = {
  isbn: [{ required: true, message: '请输入 ISBN' }],
  title: [{ required: true, message: '请输入书名' }],
  categoryId: [{ required: true, message: '请选择分类' }],
  supplier: [{ required: true, message: '请输入供应商' }],
  batchNo: [{ required: true, message: '请输入供应商批次号' }],
  quantity: [{ required: true, message: '请输入采购数量' }]
}

function showAddModal() {
  Object.assign(addForm, defaultAddForm())
  addVisible.value = true
}

function onAddCategoryChange(id) {
  const cat = categoryStore.getCategoryById(id)
  if (cat) addForm.categoryName = cat.name
}

// 输入 ISBN 匹配既有馆藏，带出图书信息（兼容既有图书数据）
function matchBook() {
  const isbn = addForm.isbn.trim()
  if (!isbn) {
    message.warning('请先输入 ISBN')
    return
  }
  const book = bookStore.getBookByIsbn(isbn)
  if (book) {
    addForm.title = book.title
    addForm.author = book.author
    addForm.publisher = book.publisher
    addForm.categoryId = book.categoryId
    addForm.categoryName = book.categoryName
    addForm.price = book.price
    addForm.location = book.location || addForm.location
    message.success(`已匹配馆藏图书《${book.title}》，验收后库存将累加`)
  } else {
    message.info('未找到馆藏图书，验收通过后将自动建立新图书档案')
  }
}

async function submitAdd() {
  try {
    await addFormRef.value.validate()
  } catch {
    return
  }
  addLoading.value = true
  await new Promise(r => setTimeout(r, 300))
  const cat = categoryStore.getCategoryById(addForm.categoryId)
  const order = purchaseStore.addOrder({
    ...addForm,
    categoryName: cat?.name || addForm.categoryName || ''
  })
  addLoading.value = false
  addVisible.value = false
  message.success(`入库单 ${order.orderNo} 已创建，状态：待验收`)
}

// ---------- 批量结果逐条反馈 ----------
const resultVisible = ref(false)
const batchResults = ref([])
const resultAction = ref('accept')

function showResults(results, action) {
  batchResults.value = results
  resultAction.value = action
  resultVisible.value = true
}

function closeResult() {
  resultVisible.value = false
  // 仅保留仍可处理的勾选项，便于修正数量后重新提交（保留待处理项）
  selectedRowKeys.value = selectedRowKeys.value.filter(id => {
    const o = purchaseStore.getOrderById(id)
    return o && !isLocked(o)
  })
}
</script>

<style lang="less" scoped>
.purchase-list {
  .page-title {
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 24px;
  }
}

.stat-row { margin-bottom: 16px; }

.stat-card-rich {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
  height: 100%;

  &:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12); }

  &.total { border-left-color: #667eea; .stat-card-icon { background: linear-gradient(135deg, #667eea, #764ba2); } .stat-card-value { color: #667eea; } }
  &.pending { border-left-color: #faad14; .stat-card-icon { background: linear-gradient(135deg, #faad14, #ffc53d); } .stat-card-value { color: #faad14; } }
  &.done { border-left-color: #52c41a; .stat-card-icon { background: linear-gradient(135deg, #52c41a, #73d13d); } .stat-card-value { color: #52c41a; } }
  &.returned { border-left-color: #ff4d4f; .stat-card-icon { background: linear-gradient(135deg, #ff4d4f, #ff7875); } .stat-card-value { color: #ff4d4f; } }

  .stat-card-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
    .stat-card-icon {
      width: 40px; height: 40px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; color: #fff;
    }
    .stat-card-trend {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; padding: 4px 8px; border-radius: 12px;
      background: #f0f5ff; color: #667eea;
    }
    .stat-card-badge {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; background: #e6f7ff; color: #1890ff;
      &.success { background: #f6ffed; color: #52c41a; }
      &.warning { background: #fffbe6; color: #faad14; }
      &.danger { background: #fff1f0; color: #ff4d4f; }
    }
  }
  .stat-card-body {
    .stat-card-value { font-size: 32px; font-weight: 700; line-height: 1.2; }
    .stat-card-label { font-size: 14px; color: #999; margin-top: 4px; }
  }
  .stat-card-footer {
    font-size: 12px; color: #999; padding-top: 12px; margin-top: 8px;
    border-top: 1px dashed #f0f0f0;
    strong { color: #faad14; }
    .success-text { color: #52c41a; }
    .muted-text { color: #999; }
  }
}

.search-area {
  background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px; margin-bottom: 16px;

  .search-icon { color: rgba(0, 0, 0, 0.45); }
  .search-result-tip {
    margin-top: 16px; padding-top: 16px; border-top: 1px dashed #f0f0f0;
    display: flex; align-items: center; justify-content: space-between;
    .result-count { color: #666; font-size: 13px; strong { color: #1890ff; font-size: 16px; margin: 0 4px; } }
  }
}

.table-container {
  background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  padding: 20px;

  .act-btn { padding: 2px 4px; height: auto; }
}

.text-primary { font-weight: 500; color: #1a1a1a; }
.text-secondary { font-size: 12px; color: #999; }

.qty-cell {
  display: flex; flex-direction: column; gap: 2px; font-size: 13px;
  .qty-detail { font-size: 12px; color: #666; }
  .ok { color: #52c41a; font-weight: 600; }
  .err { color: #ff4d4f; font-weight: 600; }
}

.mini-tag { font-size: 11px; line-height: 16px; padding: 0 4px; margin: 0; }

.return-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border: 1px solid #f0f0f0; border-radius: 8px; margin-bottom: 8px;
  background: #fafafa;
}

.rec-head {
  display: flex; align-items: center; gap: 8px;
}
.rec-note {
  margin: 4px 0; font-size: 13px; color: #333;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.5s ease-out both; }
.animate-slide-down { animation: slideDown 0.5s ease-out both; }
</style>
