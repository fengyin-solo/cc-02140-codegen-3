import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { inboundOrders as initialOrders, acceptanceRecords as initialRecords } from '@/data/mockData'
import { useBookStore } from '@/stores/book'

const ORDER_STORAGE_KEY = 'library_inbound_orders'
const RECORD_STORAGE_KEY = 'library_acceptance_records'

// 明细状态
export const ITEM_PENDING = 'pending'
export const ITEM_PARTIAL = 'partial'
export const ITEM_ACCEPTED = 'accepted'
export const ITEM_REJECTED = 'rejected'

// 单据状态
export const ORDER_PENDING = 'pending'
export const ORDER_ACCEPTING = 'accepting'
export const ORDER_COMPLETED = 'completed'
export const ORDER_RETURNED = 'returned'

function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function todayStr() {
  return formatDateTime().slice(0, 10)
}

// 依据数量重新计算明细状态，保证「重新进入后状态不错配」
function normalizeItemStatus(item) {
  const expectQty = Number(item.expectQty) || 0
  const acceptedQty = Number(item.acceptedQty) || 0
  const rejectedQty = Number(item.rejectedQty) || 0
  const settledQty = acceptedQty + rejectedQty

  if (rejectedQty > 0 && settledQty >= expectQty && acceptedQty === 0) {
    return ITEM_REJECTED
  }
  if (settledQty < expectQty) {
    return settledQty > 0 ? ITEM_PARTIAL : ITEM_PENDING
  }
  return ITEM_ACCEPTED
}

// 依据明细状态重新计算单据状态
function normalizeOrderStatus(order) {
  const statuses = order.items.map(item => item.status)
  if (statuses.every(s => s === ITEM_ACCEPTED)) return ORDER_COMPLETED
  if (statuses.every(s => s === ITEM_REJECTED)) return ORDER_RETURNED
  if (statuses.some(s => s === ITEM_PARTIAL || s === ITEM_ACCEPTED || s === ITEM_REJECTED)) {
    return ORDER_ACCEPTING
  }
  return ORDER_PENDING
}

// 载入并归一化历史数据，防止本地缓存与当前状态机不一致
function loadOrders() {
  let orders = null
  const stored = localStorage.getItem(ORDER_STORAGE_KEY)
  if (stored) {
    try {
      orders = JSON.parse(stored)
    } catch (e) {
      console.error('Failed to parse stored inbound orders:', e)
    }
  }
  if (!orders) orders = JSON.parse(JSON.stringify(initialOrders))

  return orders.map(order => ({
    ...order,
    items: (order.items || []).map(item => ({
      actualQty: null,
      ...item,
      status: normalizeItemStatus(item)
    })),
    status: '' // 先占位，下一步统一重算
  })).map(order => ({
    ...order,
    status: normalizeOrderStatus(order)
  }))
}

function loadRecords() {
  const stored = localStorage.getItem(RECORD_STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch (e) {
      console.error('Failed to parse stored acceptance records:', e)
    }
  }
  return [...initialRecords]
}

export const useInboundStore = defineStore('inbound', () => {
  const orders = ref(loadOrders())
  const records = ref(loadRecords())

  // 批量操作进行中标志，用于拦截重复提交
  const processing = ref(false)

  // ============== 持久化 ==============
  function persist() {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders.value))
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records.value))
  }

  // ============== 查询 ==============
  const flatItems = computed(() =>
    orders.value.flatMap(order =>
      order.items.map(item => ({
        ...item,
        orderId: order.id,
        orderNo: order.orderNo,
        orderStatus: order.status,
        supplierName: order.supplierName,
        orderDate: order.orderDate,
        warehouse: order.warehouse
      }))
    )
  )

  const pendingItems = computed(() =>
    flatItems.value.filter(item => item.status === ITEM_PENDING || item.status === ITEM_PARTIAL)
  )

  function getOrderById(id) {
    return orders.value.find(order => order.id === id)
  }

  function getItem(orderId, itemId) {
    const order = getOrderById(orderId)
    const item = order?.items.find(i => i.id === itemId)
    return { order, item }
  }

  function nextOrderNo() {
    const year = new Date().getFullYear()
    const month = pad(new Date().getMonth() + 1)
    const prefix = `PO${year}${month}`
    const seq = orders.value
      .filter(o => o.orderNo?.startsWith(prefix))
      .reduce((max, o) => {
        const n = Number(String(o.orderNo).slice(prefix.length))
        return Number.isFinite(n) ? Math.max(max, n) : max
      }, 0)
    return `${prefix}${String(seq + 1).padStart(3, '0')}`
  }

  function nextItemId() {
    return flatItems.value.reduce((max, item) => Math.max(max, item.id), 100) + 1
  }

  function nextRecordId() {
    return records.value.length > 0
      ? Math.max(...records.value.map(r => r.id)) + 1
      : 1
  }

  // 同 ISBN + 同供应商批次是否已有「验收入库」记录（重复入库校验）
  // excludeItemId 用于排除当前明细自身的历史验收（部分入库后继续验收）
  function findDuplicateBatch(isbn, batchNo, excludeItemId) {
    return records.value.find(r =>
      r.type === 'accepted' &&
      r.isbn === isbn &&
      (r.batchNo || '') === (batchNo || '') &&
      r.itemId !== excludeItemId
    )
  }

  // 同一次提交内（不同行之间）的批次重复
  function duplicateWithinBatch(rows, index, item) {
    return rows.findIndex((r, i) =>
      i !== index &&
      r.isbn === item.isbn &&
      (r.batchNo || '') === (item.batchNo || '')
    )
  }

  // ============== 单据维护 ==============
  function createOrder(form) {
    const newId = orders.value.length > 0
      ? Math.max(...orders.value.map(o => o.id)) + 1
      : 1

    const items = (form.items || []).map((row, idx) => ({
      id: nextItemId() + idx,
      bookId: row.bookId ?? null,
      isbn: row.isbn,
      title: row.title,
      author: row.author || '',
      publisher: row.publisher || '',
      categoryId: row.categoryId ?? null,
      categoryName: row.categoryName || '',
      price: Number(row.price) || 0,
      expectQty: Number(row.expectQty),
      batchNo: row.batchNo,
      status: ITEM_PENDING,
      acceptedQty: 0,
      rejectedQty: 0,
      actualQty: null,
      remark: row.remark || ''
    }))

    const now = formatDateTime()
    const order = {
      id: newId,
      orderNo: form.orderNo || nextOrderNo(),
      supplierId: form.supplierId,
      supplierName: form.supplierName,
      contactName: form.contactName || '',
      contactPhone: form.contactPhone || '',
      orderDate: form.orderDate || todayStr(),
      expectArrivalDate: form.expectArrivalDate || '',
      warehouse: form.warehouse || '主馆一号库',
      remark: form.remark || '',
      status: ORDER_PENDING,
      createdAt: now,
      items
    }
    orders.value.unshift(order)
    persist()
    return order
  }

  // 仅待验收单可编辑；保持已验收/退回明细不动
  function updateOrder(id, form) {
    const order = getOrderById(id)
    if (!order || order.status !== ORDER_PENDING) return false

    const existingIds = new Set((form.items || []).filter(r => r.id).map(r => r.id))
    const untouched = order.items.filter(item => !existingIds.has(item.id))
    // 待验收单所有明细均为 pending，理论上 untouched 为空，仍保留以兜底
    const mergedRows = [...untouched.map(item => ({ ...item, _keep: true })), ...form.items]

    order.supplierId = form.supplierId
    order.supplierName = form.supplierName
    order.contactName = form.contactName || ''
    order.contactPhone = form.contactPhone || ''
    order.orderDate = form.orderDate || order.orderDate
    order.expectArrivalDate = form.expectArrivalDate || ''
    order.warehouse = form.warehouse || order.warehouse
    order.remark = form.remark || ''
    order.items = mergedRows.map(row => {
      if (row._keep) return row
      if (row.id) {
        const item = order.items.find(i => i.id === row.id)
        return {
          ...item,
          bookId: row.bookId ?? item.bookId,
          isbn: row.isbn,
          title: row.title,
          author: row.author || '',
          publisher: row.publisher || '',
          categoryId: row.categoryId ?? null,
          categoryName: row.categoryName || '',
          price: Number(row.price) || 0,
          expectQty: Number(row.expectQty),
          batchNo: row.batchNo,
          remark: row.remark || ''
        }
      }
      return {
        id: nextItemId(),
        bookId: row.bookId ?? null,
        isbn: row.isbn,
        title: row.title,
        author: row.author || '',
        publisher: row.publisher || '',
        categoryId: row.categoryId ?? null,
        categoryName: row.categoryName || '',
        price: Number(row.price) || 0,
        expectQty: Number(row.expectQty),
        batchNo: row.batchNo,
        status: ITEM_PENDING,
        acceptedQty: 0,
        rejectedQty: 0,
        actualQty: null,
        remark: row.remark || ''
      }
    })
    persist()
    return true
  }

  function deleteOrder(id) {
    const order = getOrderById(id)
    if (!order || order.status !== ORDER_PENDING) return false
    orders.value = orders.value.filter(o => o.id !== id)
    persist()
    return true
  }

  // ============== 内部工具 ==============
  function refreshStatus(order) {
    order.items.forEach(item => {
      item.status = normalizeItemStatus(item)
    })
    order.status = normalizeOrderStatus(order)
  }

  function pushRecord({ order, item, type, actualQty, changeQty, acceptedQtyAfter, remark }) {
    records.value.unshift({
      id: nextRecordId(),
      orderId: order.id,
      orderNo: order.orderNo,
      itemId: item.id,
      bookId: item.bookId,
      isbn: item.isbn,
      bookTitle: item.title,
      batchNo: item.batchNo,
      type,
      expectQty: Number(item.expectQty),
      actualQty: Number(actualQty),
      changeQty: Number(changeQty),
      acceptedQty: acceptedQtyAfter,
      operator: getOperatorName(),
      remark: remark || '',
      createdAt: formatDateTime()
    })
  }

  function getOperatorName() {
    try {
      const stored = localStorage.getItem('library_user')
      return stored ? JSON.parse(stored).name : '管理员'
    } catch (e) {
      return '管理员'
    }
  }

  // 单条验收前置校验，返回 { ok, message }
  function validateAcceptance(item, actualQty, { checkBatch = true } = {}) {
    if (!item) return { ok: false, message: '明细不存在' }
    if (item.status === ITEM_ACCEPTED) {
      return { ok: false, code: 'DONE', message: '该明细已全部验收入库，请勿重复提交' }
    }
    if (item.status === ITEM_REJECTED) {
      return { ok: false, code: 'REJECTED', message: '该明细已退回，无法验收入库' }
    }
    const qty = Number(actualQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, code: 'INVALID', message: '本次验收数量必须为大于 0 的整数' }
    }
    const remaining = Number(item.expectQty) - Number(item.acceptedQty) - Number(item.rejectedQty)
    if (qty > remaining) {
      return {
        ok: false,
        code: 'MISMATCH',
        message: `数量不符：本次到货验收 ${qty} 册，超过待处理数量 ${remaining} 册`
      }
    }
    if (checkBatch) {
      const dup = findDuplicateBatch(item.isbn, item.batchNo, item.id)
      if (dup) {
        return {
          ok: false,
          code: 'DUPLICATE_BATCH',
          message: `供应商批次 ${item.batchNo || '(空)'} 已在入库单 ${dup.orderNo} 验收入库，禁止同一批次重复入库`
        }
      }
    }
    return { ok: true }
  }

  // 单条退回前置校验
  function validateReturn(item, returnQty) {
    if (!item) return { ok: false, message: '明细不存在' }
    if (item.status === ITEM_ACCEPTED) {
      return { ok: false, code: 'DONE', message: '该明细已全部入库，无法退回' }
    }
    if (item.status === ITEM_REJECTED) {
      return { ok: false, code: 'DONE', message: '该明细已全部退回，请勿重复提交' }
    }
    const qty = Number(returnQty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, code: 'INVALID', message: '退回数量必须为大于 0 的整数' }
    }
    const remaining = Number(item.expectQty) - Number(item.acceptedQty) - Number(item.rejectedQty)
    if (qty > remaining) {
      return {
        ok: false,
        code: 'MISMATCH',
        message: `数量不符：退回 ${qty} 册，超过待处理数量 ${remaining} 册`
      }
    }
    return { ok: true }
  }

  // 执行验收落库（明细、库存、记录、状态），返回结果对象
  function applyAcceptance(order, item, actualQty, remark, { partial = false, batch = false } = {}) {
    const qty = Number(actualQty)
    const validation = validateAcceptance(item, qty)
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.code,
        message: validation.message,
        orderId: order?.id,
        itemId: item?.id,
        orderNo: order?.orderNo,
        bookTitle: item?.title
      }
    }

    const bookStore = useBookStore()
    const { book, created } = bookStore.findOrCreateByInboundItem(item)
    if (item.bookId !== book.id) item.bookId = book.id

    const stock = bookStore.addStock(book.id, qty)
    if (!stock) {
      return {
        ok: false,
        code: 'STOCK_ERROR',
        message: '库存同步失败，请重试',
        orderId: order.id,
        itemId: item.id,
        orderNo: order.orderNo,
        bookTitle: item.title
      }
    }

    item.acceptedQty = Number(item.acceptedQty) + qty
    // 批量验收仅按订购数量整批到货时通过，不产生 partial
    const isFull = (Number(item.acceptedQty) + Number(item.rejectedQty)) >= Number(item.expectQty)
    if (isFull || !partial) {
      item.actualQty = Number(item.actualQty || 0) + qty
    } else {
      item.actualQty = Number(item.actualQty || 0) + qty
    }
    if (remark) item.remark = remark

    pushRecord({
      order,
      item,
      type: 'accepted',
      actualQty: qty,
      changeQty: qty,
      acceptedQtyAfter: item.acceptedQty,
      remark: remark || (created ? '新书首次入库，系统自动建档' : '')
    })
    refreshStatus(order)
    persist()

    return {
      ok: true,
      code: 'OK',
      message: `《${item.title}》验收入库 ${qty} 册，可借库存 +${qty}` +
        (created ? '（新图书已自动建档）' : ''),
      orderId: order.id,
      itemId: item.id,
      orderNo: order.orderNo,
      bookTitle: item.title,
      qty,
      stock,
      created,
      partial: item.status === ITEM_PARTIAL
    }
  }

  // ============== 逐条补充：单条验收 ==============
  function acceptItem({ orderId, itemId, actualQty, remark }) {
    if (processing.value) {
      return { ok: false, code: 'BUSY', message: '上一批操作正在处理中，请勿重复提交' }
    }
    const { order, item } = getItem(orderId, itemId)
    if (!order || !item) {
      return { ok: false, code: 'NOT_FOUND', message: '入库单或明细不存在，可能已被删除' }
    }
    const qty = Number(actualQty)
    const remaining = Number(item.expectQty) - Number(item.acceptedQty) - Number(item.rejectedQty)
    // 数量不符时：允许部分验收保留待处理；超出剩余则拒绝
    const partial = qty < remaining
    return applyAcceptance(order, item, qty, remark, { partial })
  }

  // ============== 逐条补充：单条退回 ==============
  function returnItem({ orderId, itemId, returnQty, remark }) {
    if (processing.value) {
      return { ok: false, code: 'BUSY', message: '上一批操作正在处理中，请勿重复提交' }
    }
    const { order, item } = getItem(orderId, itemId)
    if (!order || !item) {
      return { ok: false, code: 'NOT_FOUND', message: '入库单或明细不存在，可能已被删除' }
    }
    const validation = validateReturn(item, returnQty)
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.code,
        message: validation.message,
        orderId: order.id,
        itemId: item.id,
        orderNo: order.orderNo,
        bookTitle: item.title
      }
    }
    const qty = Number(returnQty)
    item.rejectedQty = Number(item.rejectedQty) + qty
    if (remark) item.remark = remark

    pushRecord({
      order,
      item,
      type: 'returned',
      actualQty: qty,
      changeQty: qty,
      acceptedQtyAfter: item.acceptedQty,
      remark: remark || '验收不合格，退回供应商'
    })
    refreshStatus(order)
    persist()

    return {
      ok: true,
      code: 'OK',
      message: `《${item.title}》已退回 ${qty} 册`,
      orderId: order.id,
      itemId: item.id,
      orderNo: order.orderNo,
      bookTitle: item.title,
      qty
    }
  }

  // ============== 逐条补充：仅备注记录（不改数量） ==============
  function noteItem({ orderId, itemId, remark }) {
    const { order, item } = getItem(orderId, itemId)
    if (!order || !item) {
      return { ok: false, code: 'NOT_FOUND', message: '入库单或明细不存在' }
    }
    if (!remark || !remark.trim()) {
      return { ok: false, code: 'INVALID', message: '补充记录内容不能为空' }
    }
    pushRecord({
      order,
      item,
      type: 'note',
      actualQty: 0,
      changeQty: 0,
      acceptedQtyAfter: item.acceptedQty,
      remark: remark.trim()
    })
    persist()
    return {
      ok: true,
      code: 'OK',
      message: `《${item.title}》已补充一条验收记录`,
      orderId: order.id,
      itemId: item.id
    }
  }

  // ============== 批量验收入库（多条单据/明细） ==============
  // rows: [{ itemId, orderId, isbn, batchNo, title, actualQty, expectQty, ... }]
  // 规则逐条执行：重复提交、数量不符、重复批次 -> 失败并保留待处理；成功的同步库存
  function batchAccept(rows) {
    if (processing.value) {
      return { ok: false, message: '上一批操作正在处理中，请勿重复提交', results: [] }
    }
    if (!rows || rows.length === 0) {
      return { ok: false, message: '请先勾选需要验收的明细', results: [] }
    }

    processing.value = true
    const results = []
    try {
      rows.forEach((row, index) => {
        const { order, item } = getItem(row.orderId, row.itemId)
        if (!order || !item) {
          results.push({
            ok: false,
            code: 'NOT_FOUND',
            message: '入库单或明细不存在，可能已被删除',
            itemId: row.itemId,
            orderNo: row.orderNo,
            bookTitle: row.title
          })
          return
        }

        // 1) 重复提交
        if (item.status === ITEM_ACCEPTED) {
          results.push({
            ok: false,
            code: 'DONE',
            message: '该明细已全部验收入库，请勿重复提交',
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }
        if (item.status === ITEM_REJECTED) {
          results.push({
            ok: false,
            code: 'REJECTED',
            message: '该明细已全部退回，无法验收入库',
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }

        // 2) 数量非正
        const qty = Number(row.actualQty)
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isInteger(qty)) {
          results.push({
            ok: false,
            code: 'INVALID',
            message: `实收数量 ${row.actualQty} 无效，须为大于 0 的整数`,
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }

        const remaining = Number(item.expectQty) - Number(item.acceptedQty) - Number(item.rejectedQty)
        // 3) 数量不符（批量验收要求整批与待处理数量一致，不符保留待处理）
        if (qty !== remaining) {
          results.push({
            ok: false,
            code: 'MISMATCH',
            message: `数量不符：实收 ${qty} 册，待处理 ${remaining} 册，请逐条补充验收或退回`,
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title,
            qty,
            remaining
          })
          return
        }

        // 4) 同一批次重复入库（含本批提交内不同行）
        const dupHistory = findDuplicateBatch(item.isbn, item.batchNo, item.id)
        if (dupHistory) {
          results.push({
            ok: false,
            code: 'DUPLICATE_BATCH',
            message: `供应商批次 ${item.batchNo || '(空)'} 已在入库单 ${dupHistory.orderNo} 验收入库，禁止重复入库`,
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }
        const dupIndex = duplicateWithinBatch(rows, index, item)
        if (dupIndex !== -1) {
          // 只在第二次出现时报错，避免两条都报错
          const other = rows[dupIndex]
          results.push({
            ok: false,
            code: 'DUPLICATE_BATCH',
            message: `与本批第 ${dupIndex + 1} 行《${other.title}》为同一 ISBN+供应商批次，禁止重复入库`,
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }

        // 5) 执行
        const result = applyAcceptance(order, item, qty, row.remark || '', { partial: false, batch: true })
        results.push(result)
      })
    } finally {
      processing.value = false
    }

    const success = results.filter(r => r.ok)
    const failed = results.filter(r => !r.ok)
    return {
      ok: true,
      results,
      successCount: success.length,
      failedCount: failed.length,
      message: failed.length === 0
        ? `全部 ${success.length} 条验收入库成功`
        : `成功 ${success.length} 条，失败 ${failed.length} 条，失败项已保留待处理`
    }
  }

  // ============== 多选退回 ==============
  function batchReturn(rows, remark) {
    if (processing.value) {
      return { ok: false, message: '上一批操作正在处理中，请勿重复提交', results: [] }
    }
    if (!rows || rows.length === 0) {
      return { ok: false, message: '请先勾选需要退回的明细', results: [] }
    }

    processing.value = true
    const results = []
    try {
      rows.forEach(row => {
        const { order, item } = getItem(row.orderId, row.itemId)
        if (!order || !item) {
          results.push({
            ok: false,
            code: 'NOT_FOUND',
            message: '入库单或明细不存在',
            itemId: row.itemId,
            bookTitle: row.title
          })
          return
        }
        if (item.status === ITEM_ACCEPTED) {
          results.push({
            ok: false,
            code: 'DONE',
            message: '该明细已全部入库，无法退回',
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }
        if (item.status === ITEM_REJECTED) {
          results.push({
            ok: false,
            code: 'DONE',
            message: '该明细已全部退回，请勿重复提交',
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }
        // 退回按「待处理数量」整批退回
        const remaining = Number(item.expectQty) - Number(item.acceptedQty) - Number(item.rejectedQty)
        const qty = row.returnQty != null && Number(row.returnQty) > 0
          ? Number(row.returnQty)
          : remaining
        if (qty > remaining) {
          results.push({
            ok: false,
            code: 'MISMATCH',
            message: `数量不符：退回 ${qty} 册，待处理 ${remaining} 册`,
            orderNo: order.orderNo,
            itemId: item.id,
            bookTitle: item.title
          })
          return
        }
        const result = returnItem({
          orderId: order.id,
          itemId: item.id,
          returnQty: qty,
          remark: remark || row.remark || ''
        })
        results.push(result)
      })
    } finally {
      processing.value = false
    }

    const success = results.filter(r => r.ok)
    const failed = results.filter(r => !r.ok)
    return {
      ok: true,
      results,
      successCount: success.length,
      failedCount: failed.length,
      message: failed.length === 0
        ? `已退回 ${success.length} 条明细`
        : `退回成功 ${success.length} 条，失败 ${failed.length} 条`
    }
  }

  return {
    orders,
    records,
    processing,
    flatItems,
    pendingItems,
    getOrderById,
    getItem,
    nextOrderNo,
    findDuplicateBatch,
    createOrder,
    updateOrder,
    deleteOrder,
    acceptItem,
    returnItem,
    noteItem,
    batchAccept,
    batchReturn
  }
})
