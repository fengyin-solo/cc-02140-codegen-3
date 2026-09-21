<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑入库单' : '新增入库单'"
    :confirm-loading="submitLoading"
    :mask-closable="false"
    width="960px"
    :destroy-on-close="true"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 7 }"
      :wrapper-col="{ span: 17 }"
    >
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="入库单号" name="orderNo">
            <a-input v-model:value="formState.orderNo" placeholder="留空自动生成" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="供应商" name="supplierId">
            <a-select
              v-model:value="formState.supplierId"
              placeholder="请选择供应商"
              show-search
              option-filter-prop="label"
              @change="handleSupplierChange"
            >
              <a-select-option
                v-for="s in suppliers"
                :key="s.id"
                :value="s.id"
                :label="s.name"
              >
                {{ s.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="下单日期" name="orderDate">
            <a-date-picker
              v-model:value="orderDateObj"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="选择下单日期"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="预计到货" name="expectArrivalDate">
            <a-date-picker
              v-model:value="formState.expectArrivalDate"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              placeholder="选择预计到货日期"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="联系人">
            <a-input v-model:value="formState.contactName" placeholder="供应商联系人" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="联系电话">
            <a-input v-model:value="formState.contactPhone" placeholder="供应商联系电话" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="入库仓库" name="warehouse">
            <a-select v-model:value="formState.warehouse">
              <a-select-option value="主馆一号库">主馆一号库</a-select-option>
              <a-select-option value="主馆二号库">主馆二号库</a-select-option>
              <a-select-option value="分馆周转库">分馆周转库</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="备注">
            <a-input v-model:value="formState.remark" placeholder="整单备注（可选）" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <div class="items-header">
      <span class="items-title">
        <ProfileOutlined /> 入库明细
        <a-tag color="blue">{{ formState.items.length }} 条</a-tag>
      </span>
      <a-space>
        <a-button size="small" @click="fillFromBook">
          <BookOutlined /> 从书库带入
        </a-button>
        <a-button type="primary" size="small" @click="addItem">
          <PlusOutlined /> 添加明细
        </a-button>
      </a-space>
    </div>

    <div class="items-table-wrapper">
      <a-table
        :columns="itemColumns"
        :data-source="formState.items"
        :pagination="false"
        row-key="key"
        size="small"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'book'">
            <a-select
              :value="record.bookId || undefined"
              placeholder="选择书库图书，或直接录入新书"
              show-search
              allow-clear
              style="width: 200px"
              :filter-option="filterBook"
              @change="(val) => handleBookChange(record, val)"
            >
              <a-select-option
                v-for="b in bookStore.books"
                :key="b.id"
                :value="b.id"
                :label="b.title"
              >
                {{ b.title }}
              </a-select-option>
            </a-select>
          </template>
          <template v-else-if="column.key === 'isbn'">
            <a-input v-model:value="record.isbn" placeholder="ISBN" size="small" />
          </template>
          <template v-else-if="column.key === 'title'">
            <a-input v-model:value="record.title" placeholder="书名" size="small" />
          </template>
          <template v-else-if="column.key === 'category'">
            <a-select
              v-model:value="record.categoryId"
              placeholder="分类"
              size="small"
              style="width: 110px"
              allow-clear
              @change="(val) => handleCategoryChange(record, val)"
            >
              <a-select-option v-for="c in categoryStore.categories" :key="c.id" :value="c.id">
                {{ c.name }}
              </a-select-option>
            </a-select>
          </template>
          <template v-else-if="column.key === 'price'">
            <a-input-number
              v-model:value="record.price"
              :min="0"
              :precision="2"
              size="small"
              style="width: 80px"
            />
          </template>
          <template v-else-if="column.key === 'expectQty'">
            <a-input-number
              v-model:value="record.expectQty"
              :min="1"
              :precision="0"
              size="small"
              style="width: 70px"
            />
          </template>
          <template v-else-if="column.key === 'batchNo'">
            <a-input
              v-model:value="record.batchNo"
              placeholder="供应商批次号"
              size="small"
              :status="batchDupSet.has(record.key) ? 'error' : ''"
            />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button
              type="link"
              size="small"
              danger
              :disabled="formState.items.length <= 1"
              @click="removeItem(index)"
            >
              <DeleteOutlined /> 删除
            </a-button>
          </template>
        </template>
      </a-table>
      <div v-if="batchDupSet.size > 0" class="items-tip error">
        <WarningOutlined /> 存在相同 ISBN + 供应商批次号的明细，验收入库时将被拦截，请先调整批次号
      </div>
      <div class="items-tip">
        <InfoCircleOutlined /> 书库中没有的图书可直接录入 ISBN/书名，验收通过后将自动建档并同步库存
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import {
  PlusOutlined,
  DeleteOutlined,
  ProfileOutlined,
  BookOutlined,
  WarningOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import { suppliers } from '@/data/mockData'
import { useBookStore } from '@/stores/book'
import { useCategoryStore } from '@/stores/category'
import { useInboundStore } from '@/stores/inbound'

const props = defineProps({
  open: { type: Boolean, default: false },
  // 编辑时传入既有单据；新增为 null
  order: { type: Object, default: null }
})
const emit = defineEmits(['success', 'cancel'])

const bookStore = useBookStore()
const categoryStore = useCategoryStore()
const inboundStore = useInboundStore()

const formRef = ref(null)
const submitLoading = ref(false)
const orderDateObj = ref(dayjs())

const isEdit = computed(() => !!props.order)

let itemKeySeq = 0
function newItemKey() {
  itemKeySeq += 1
  return `new_${Date.now()}_${itemKeySeq}`
}

function makeEmptyItem() {
  return {
    key: newItemKey(),
    id: null,
    bookId: null,
    isbn: '',
    title: '',
    author: '',
    publisher: '',
    categoryId: null,
    categoryName: '',
    price: 0,
    expectQty: 1,
    batchNo: '',
    remark: ''
  }
}

const formState = reactive({
  orderNo: '',
  supplierId: null,
  contactName: '',
  contactPhone: '',
  orderDate: dayjs().format('YYYY-MM-DD'),
  expectArrivalDate: '',
  warehouse: '主馆一号库',
  remark: '',
  items: [makeEmptyItem()]
})

const rules = {
  supplierId: [{ required: true, message: '请选择供应商' }],
  orderDate: [{ required: true, message: '请选择下单日期' }],
  warehouse: [{ required: true, message: '请选择入库仓库' }]
}

const itemColumns = [
  { title: '书库图书', key: 'book', width: 210 },
  { title: 'ISBN', key: 'isbn', width: 150 },
  { title: '书名', key: 'title', width: 150 },
  { title: '分类', key: 'category', width: 120 },
  { title: '单价', key: 'price', width: 90 },
  { title: '数量', key: 'expectQty', width: 80 },
  { title: '供应商批次号', key: 'batchNo', width: 160 },
  { title: '操作', key: 'action', width: 70 }
]

// 同单内 ISBN + 批次重复提示
const batchDupSet = computed(() => {
  const seen = new Map()
  const dup = new Set()
  formState.items.forEach(row => {
    const sig = `${(row.isbn || '').trim()}__${(row.batchNo || '').trim()}`
    if (!row.isbn || !row.batchNo) return
    if (seen.has(sig)) {
      dup.add(row.key)
      dup.add(seen.get(sig))
    } else {
      seen.set(sig, row.key)
    }
  })
  return dup
})

watch(orderDateObj, val => {
  formState.orderDate = val ? val.format('YYYY-MM-DD') : ''
})

watch(
  () => props.open,
  open => {
    if (!open) return
    if (props.order) {
      const o = props.order
      formState.orderNo = o.orderNo
      formState.supplierId = o.supplierId
      formState.contactName = o.contactName
      formState.contactPhone = o.contactPhone
      formState.orderDate = o.orderDate
      orderDateObj.value = o.orderDate ? dayjs(o.orderDate) : dayjs()
      formState.expectArrivalDate = o.expectArrivalDate
      formState.warehouse = o.warehouse
      formState.remark = o.remark
      formState.items = o.items.map(item => ({
        key: `exist_${item.id}`,
        id: item.id,
        bookId: item.bookId,
        isbn: item.isbn,
        title: item.title,
        author: item.author,
        publisher: item.publisher,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        price: item.price,
        expectQty: item.expectQty,
        batchNo: item.batchNo,
        remark: item.remark
      }))
    } else {
      formState.orderNo = inboundStore.nextOrderNo()
      formState.supplierId = null
      formState.contactName = ''
      formState.contactPhone = ''
      formState.orderDate = dayjs().format('YYYY-MM-DD')
      orderDateObj.value = dayjs()
      formState.expectArrivalDate = ''
      formState.warehouse = '主馆一号库'
      formState.remark = ''
      formState.items = [makeEmptyItem()]
    }
    nextTick(() => formRef.value?.clearValidate())
  },
  { immediate: true }
)

function filterBook(input, option) {
  return option.label?.toLowerCase().includes(input.toLowerCase())
}

function handleSupplierChange(val) {
  const s = suppliers.find(item => item.id === val)
  if (s) {
    formState.contactName = s.contactName
    formState.contactPhone = s.contactPhone
  }
}

function handleBookChange(row, bookId) {
  if (!bookId) {
    row.bookId = null
    return
  }
  const book = bookStore.getBookById(bookId)
  if (!book) return
  row.bookId = book.id
  row.isbn = book.isbn
  row.title = book.title
  row.author = book.author
  row.publisher = book.publisher
  row.categoryId = book.categoryId
  row.categoryName = book.categoryName
  row.price = book.price
  if (!row.batchNo) {
    row.batchNo = ''
  }
}

function handleCategoryChange(row, categoryId) {
  const cat = categoryStore.getCategoryById(categoryId)
  row.categoryName = cat?.name || ''
}

function addItem() {
  formState.items.push(makeEmptyItem())
}

function removeItem(index) {
  formState.items.splice(index, 1)
}

function fillFromBook() {
  if (bookStore.books.length === 0) {
    message.info('书库暂无图书')
    return
  }
  const empty = formState.items[0]
  if (formState.items.length === 1 && !empty.isbn && !empty.title) {
    handleBookChange(empty, bookStore.books[0].id)
  } else {
    const row = makeEmptyItem()
    handleBookChange(row, bookStore.books[formState.items.length % bookStore.books.length].id)
    formState.items.push(row)
  }
}

function validateItems() {
  if (formState.items.length === 0) {
    message.warning('请至少添加一条入库明细')
    return false
  }
  const sigSet = new Set()
  for (let i = 0; i < formState.items.length; i += 1) {
    const row = formState.items[i]
    if (!row.isbn || !row.isbn.trim()) {
      message.warning(`第 ${i + 1} 行缺少 ISBN`)
      return false
    }
    if (!row.title || !row.title.trim()) {
      message.warning(`第 ${i + 1} 行缺少书名`)
      return false
    }
    if (!row.expectQty || Number(row.expectQty) <= 0) {
      message.warning(`第 ${i + 1} 行采购数量须大于 0`)
      return false
    }
    if (!row.batchNo || !row.batchNo.trim()) {
      message.warning(`第 ${i + 1} 行缺少供应商批次号`)
      return false
    }
    const sig = `${row.isbn.trim()}__${row.batchNo.trim()}`
    if (sigSet.has(sig)) {
      message.warning(`第 ${i + 1} 行与前面明细的 ISBN + 供应商批次号重复`)
      return false
    }
    sigSet.add(sig)
  }
  return true
}

async function handleSubmit() {
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  if (!validateItems()) return

  submitLoading.value = true
  try {
    // 模拟提交耗时，便于体现按钮 loading 防重复提交
    await new Promise(resolve => setTimeout(resolve, 400))

    const supplier = suppliers.find(s => s.id === formState.supplierId)
    const payload = {
      orderNo: formState.orderNo.trim(),
      supplierId: formState.supplierId,
      supplierName: supplier?.name || '',
      contactName: formState.contactName,
      contactPhone: formState.contactPhone,
      orderDate: formState.orderDate,
      expectArrivalDate: formState.expectArrivalDate,
      warehouse: formState.warehouse,
      remark: formState.remark,
      items: formState.items.map(row => ({
        id: row.id || undefined,
        bookId: row.bookId,
        isbn: row.isbn.trim(),
        title: row.title.trim(),
        author: row.author,
        publisher: row.publisher,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        price: Number(row.price) || 0,
        expectQty: Number(row.expectQty),
        batchNo: row.batchNo.trim(),
        remark: row.remark || ''
      }))
    }

    if (isEdit.value) {
      const ok = inboundStore.updateOrder(props.order.id, payload)
      if (!ok) {
        message.error('该入库单已进入验收流程，不可编辑')
        return
      }
      message.success('入库单更新成功')
    } else {
      inboundStore.createOrder(payload)
      message.success('入库单创建成功')
    }
    emit('success')
  } finally {
    submitLoading.value = false
  }
}

function handleCancel() {
  emit('cancel')
}
</script>

<style lang="less" scoped>
.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 8px 0 12px;
  padding-top: 12px;
  border-top: 1px dashed #f0f0f0;

  .items-title {
    font-weight: 600;
    font-size: 14px;
  }
}

.items-table-wrapper {
  .items-tip {
    margin-top: 8px;
    font-size: 12px;
    color: #999;

    &.error {
      color: #ff4d4f;
    }
  }
}
</style>
