import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { purchaseOrders as initialOrders } from '@/data/mockData'
import { useBookStore } from '@/stores/book'

const STORAGE_KEY = 'library_purchase_orders'

// 单条状态：待验收 / 部分验收 / 已入库 / 已退回
export const ORDER_STATUS = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  COMPLETED: 'completed',
  RETURNED: 'returned'
}

// 验收结果码
export const ACCEPT_RESULT = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  DUPLICATE_SUBMIT: 'duplicate_submit',
  DUPLICATE_BATCH: 'duplicate_batch',
  QUANTITY_MISMATCH: 'quantity_mismatch',
  INVALID_QUANTITY: 'invalid_quantity'
}

export const RESULT_TEXT = {
  success: '验收通过，已入库',
  partial: '部分验收，剩余待处理',
  duplicate_submit: '重复提交，该单已处理',
  duplicate_batch: '同一批次重复入库，已拦截',
  quantity_mismatch: '数量不符，未入库',
  invalid_quantity: '验收数量无效',
  returned: '已退回供应商',
  returned_partial: '部分入库，剩余已退回'
}

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function nowText() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

// 剩余待处理数量
export function remainingQuantity(order) {
  return Math.max(0, Number(order.quantity || 0) - Number(order.receivedQuantity || 0) - Number(order.returnedQuantity || 0))
}

// 以"已收/已退数量"为唯一事实来源重新计算状态，
// 保证刷新、重新进入页面后状态不会错配
function reconcileOrder(order) {
  const quantity = Number(order.quantity || 0)
  const received = Number(order.receivedQuantity || 0)
  const returned = Number(order.returnedQuantity || 0)

  let status
  if (received >= quantity && quantity > 0) {
    status = ORDER_STATUS.COMPLETED
  } else if (returned > 0 && received + returned >= quantity) {
    status = ORDER_STATUS.RETURNED
  } else if (received > 0 || (returned > 0 && received + returned < quantity)) {
    status = ORDER_STATUS.PARTIAL
  } else {
    status = ORDER_STATUS.PENDING
  }

  return {
    records: [],
    ...order,
    quantity,
    receivedQuantity: received,
    returnedQuantity: returned,
    status
  }
}

export const usePurchaseStore = defineStore('purchase', () => {
  const loadOrders = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const list = JSON.parse(stored)
        if (Array.isArray(list)) return list.map(reconcileOrder)
      } catch (e) {
        console.error('Failed to parse stored purchase orders:', e)
      }
    }
    return initialOrders.map(order => reconcileOrder({ ...order }))
  }

  const orders = ref(loadOrders())
  const loading = ref(false)
  // 正在处理的订单 id 集合，防止重复提交（双击 / 并发）
  const inflightIds = ref(new Set())

  watch(orders, (newOrders) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders))
  }, { deep: true })

  // ---------- 统计 ----------
  const totalOrders = computed(() => orders.value.length)
  const pendingOrders = computed(() =>
    orders.value.filter(o => o.status === ORDER_STATUS.PENDING || o.status === ORDER_STATUS.PARTIAL)
  )
  const pendingCount = computed(() => pendingOrders.value.length)
  const completedCount = computed(() =>
    orders.value.filter(o => o.status === ORDER_STATUS.COMPLETED).length
  )
  const returnedCount = computed(() =>
    orders.value.filter(o => o.status === ORDER_STATUS.RETURNED).length
  )
  const pendingQuantity = computed(() =>
    pendingOrders.value.reduce((sum, o) => sum + remainingQuantity(o), 0)
  )
  const todayInboundCount = computed(() => {
    const today = nowText().slice(0, 10)
    return orders.value.filter(o => o.acceptedDate === today).length
  })

  function getOrderById(id) {
    return orders.value.find(o => o.id === id)
  }

  function getSupplierOptions() {
    return [...new Set(orders.value.map(o => o.supplier).filter(Boolean))]
  }

  // 同一供应商批次（ISBN + 批次号）是否已经有入库记录。
  // 排除当前正在验收的单据自身；只有真正发生了入库（receivedQuantity>0）才视为占用。
  function findBatchOccupant(isbn, batchNo, excludeId = null) {
    const keyIsbn = String(isbn || '').trim()
    const keyBatch = String(batchNo || '').trim()
    if (!keyIsbn || !keyBatch) return null
    return orders.value.find(o =>
      o.id !== excludeId &&
      String(o.isbn || '').trim() === keyIsbn &&
      String(o.batchNo || '').trim() === keyBatch &&
      Number(o.receivedQuantity || 0) > 0
    ) || null
  }

  function appendRecord(order, record) {
    if (!Array.isArray(order.records)) order.records = []
    const maxId = order.records.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0)
    order.records.push({ id: maxId + 1, ...record })
  }

  // ---------- 逐条验收 ----------
  // payload: { id, receivedQuantity, note }
  // 每条单据独立判定、独立返回结果；失败时不动库存、保留待处理项
  function acceptOrder(payload) {
    const { id } = payload
    const order = getOrderById(id)
    const base = { id, orderNo: payload.orderNo, title: payload.title, isbn: payload.isbn }

    if (!order) {
      return { ...base, success: false, code: ACCEPT_RESULT.INVALID_QUANTITY, message: '入库单不存在' }
    }

    // 1) 重复提交拦截：已入库 / 已退回的终态单据
    if (order.status === ORDER_STATUS.COMPLETED) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: RESULT_TEXT.duplicate_submit }
    }
    if (order.status === ORDER_STATUS.RETURNED) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: '该单已退回，不能再次验收' }
    }

    // 2) 并发 / 双击重复提交拦截
    if (inflightIds.value.has(id)) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: '正在处理中，请勿重复提交' }
    }

    const remain = remainingQuantity(order)
    let received = Number(payload.receivedQuantity)
    // 逐条补充时未填写数量，按"全部合格"处理
    if (payload.receivedQuantity === null || payload.receivedQuantity === undefined || payload.receivedQuantity === '') {
      received = remain
    }

    // 3) 数量校验
    if (!Number.isFinite(received) || received <= 0) {
      return { ...base, success: false, code: ACCEPT_RESULT.INVALID_QUANTITY, message: `${RESULT_TEXT.invalid_quantity}，请输入 1 ~ ${remain} 之间的数量` }
    }
    received = Math.floor(received)
    if (received > remain) {
      // 数量不符：不入库、不动库存，待处理数量原样保留
      return {
        ...base,
        success: false,
        code: ACCEPT_RESULT.QUANTITY_MISMATCH,
        message: `数量不符：实收 ${received} 超过待处理 ${remain}，未入库`,
        expected: remain
      }
    }

    // 4) 同一批次重复入库拦截（本单首次入库前检查，排除自身）
    const occupant = findBatchOccupant(order.isbn, order.batchNo, order.id)
    if (occupant) {
      return {
        ...base,
        success: false,
        code: ACCEPT_RESULT.DUPLICATE_BATCH,
        message: `同一批次重复入库：批次 ${order.batchNo} 已由 ${occupant.orderNo} 验收入库`,
        occupantOrderNo: occupant.orderNo
      }
    }

    inflightIds.value.add(id)
    try {
      // 5) 同步可借库存：已有图书累加，新品种自动建档
      const bookStore = useBookStore()
      const stockResult = bookStockIn(bookStore, order, received)

      order.receivedQuantity += received
      const reconciled = reconcileOrder(order)
      order.status = reconciled.status
      if (order.status === ORDER_STATUS.COMPLETED) {
        order.acceptedDate = nowText().slice(0, 10)
      }

      const isPartial = received < remain
      const code = isPartial ? ACCEPT_RESULT.PARTIAL : ACCEPT_RESULT.SUCCESS
      appendRecord(order, {
        time: nowText(),
        action: 'accept',
        quantity: received,
        note: payload.note || (isPartial ? `实收 ${received}，差异 ${remain - received}` : ''),
        result: code,
        createdBook: stockResult.created,
        stockAfter: stockResult.stockAfter
      })

      return {
        ...base,
        success: true,
        code,
        received,
        remainAfter: remainingQuantity(order),
        createdBook: stockResult.created,
        stockAfter: stockResult.stockAfter,
        status: order.status,
        message: isPartial
          ? `部分验收：实收 ${received}，剩余 ${remain - received} 本待处理`
          : (stockResult.created
            ? `验收通过：新品种《${order.title}》已建档，入库 ${received} 本`
            : `验收通过：入库 ${received} 本，可借库存 ${stockResult.stockAfter}`)
      }
    } finally {
      inflightIds.value.delete(id)
    }
  }

  // 库存联动：复用图书 store，保持与既有图书信息新增/库存展示完全兼容
  function bookStockIn(bookStore, order, received) {
    const existing = bookStore.getBookByIsbn(order.isbn)
    const result = bookStore.stockInByIsbn(order.isbn, received, {
      title: order.title,
      author: order.author,
      publisher: order.publisher,
      publishDate: order.publishDate,
      categoryId: order.categoryId,
      categoryName: order.categoryName,
      price: order.price,
      location: order.location
    })
    return {
      created: result.created,
      stockAfter: result.created ? received : Number(existing.available)
    }
  }

  // ---------- 批量验收：逐条处理，逐条返回结果，失败项保留 ----------
  function batchAccept(items) {
    return items.map(item => acceptOrder(item))
  }

  // ---------- 退回（支持多选批量）----------
  function returnOrder(payload) {
    const { id } = payload
    const order = getOrderById(id)
    const base = { id, orderNo: payload.orderNo, title: payload.title, isbn: payload.isbn }

    if (!order) {
      return { ...base, success: false, message: '入库单不存在' }
    }
    if (order.status === ORDER_STATUS.COMPLETED) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: RESULT_TEXT.duplicate_submit }
    }
    if (order.status === ORDER_STATUS.RETURNED) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: '该单已退回，请勿重复操作' }
    }
    if (inflightIds.value.has(id)) {
      return { ...base, success: false, code: ACCEPT_RESULT.DUPLICATE_SUBMIT, message: '正在处理中，请勿重复提交' }
    }

    const remain = remainingQuantity(order)
    let count = Number(payload.quantity)
    if (payload.quantity === null || payload.quantity === undefined || payload.quantity === '') {
      count = remain
    }
    if (!Number.isFinite(count) || count <= 0 || Math.floor(count) !== count) {
      return { ...base, success: false, message: `退回数量无效，请输入 1 ~ ${remain} 之间的数量` }
    }
    if (count > remain) {
      return { ...base, success: false, message: `退回数量 ${count} 超过待处理 ${remain}` }
    }

    inflightIds.value.add(id)
    try {
      order.returnedQuantity += count
      const beforeReceived = Number(order.receivedQuantity || 0)
      const reconciled = reconcileOrder(order)
      order.status = reconciled.status

      const partialInbound = beforeReceived > 0 && order.status === ORDER_STATUS.RETURNED
      appendRecord(order, {
        time: nowText(),
        action: 'return',
        quantity: count,
        note: payload.reason || '',
        result: partialInbound ? 'returned_partial' : 'returned',
        createdBook: false,
        stockAfter: null
      })

      return {
        ...base,
        success: true,
        returned: count,
        remainAfter: remainingQuantity(order),
        status: order.status,
        code: partialInbound ? 'returned_partial' : 'returned',
        message: partialInbound
          ? `剩余 ${count} 本已退回（此前已入库 ${beforeReceived} 本，库存保留）`
          : `已退回 ${count} 本`
      }
    } finally {
      inflightIds.value.delete(id)
    }
  }

  function batchReturn(items) {
    return items.map(item => returnOrder(item))
  }

  // ---------- 入库单维护 ----------
  function addOrder(order) {
    const newId = orders.value.length > 0
      ? Math.max(...orders.value.map(o => o.id)) + 1
      : 1
    const today = nowText().slice(0, 10)
    const seq = String(orders.value.length + 1).padStart(3, '0')
    const orderNo = order.orderNo || `RK${today.replace(/-/g, '')}${seq}`
    const entity = reconcileOrder({
      ...order,
      id: newId,
      orderNo,
      receivedQuantity: 0,
      returnedQuantity: 0,
      status: ORDER_STATUS.PENDING,
      orderDate: order.orderDate || today,
      acceptedDate: null,
      records: []
    })
    orders.value.unshift(entity)
    return entity
  }

  function deleteOrder(id) {
    const index = orders.value.findIndex(o => o.id === id)
    if (index !== -1) {
      const order = orders.value[index]
      // 只允许删除未发生过入库的单据，避免库存与单据错配
      if (Number(order.receivedQuantity || 0) > 0) return false
      orders.value.splice(index, 1)
      return true
    }
    return false
  }

  function searchOrders(keyword) {
    if (!keyword) return orders.value
    const kw = keyword.toLowerCase()
    return orders.value.filter(o =>
      o.orderNo.toLowerCase().includes(kw) ||
      o.title.toLowerCase().includes(kw) ||
      o.isbn.toLowerCase().includes(kw) ||
      (o.supplier || '').toLowerCase().includes(kw) ||
      (o.batchNo || '').toLowerCase().includes(kw)
    )
  }

  return {
    orders,
    loading,
    inflightIds,
    totalOrders,
    pendingCount,
    completedCount,
    returnedCount,
    pendingQuantity,
    todayInboundCount,
    getOrderById,
    getSupplierOptions,
    findBatchOccupant,
    acceptOrder,
    batchAccept,
    returnOrder,
    batchReturn,
    addOrder,
    deleteOrder,
    searchOrders,
    remainingQuantity
  }
})
