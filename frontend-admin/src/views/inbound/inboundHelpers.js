// 采购入库模块共享常量与展示映射

export const ITEM_STATUS = {
  pending: { text: '待验收', color: 'warning' },
  partial: { text: '部分入库', color: 'processing' },
  accepted: { text: '已入库', color: 'success' },
  rejected: { text: '已退回', color: 'error' }
}

export const ORDER_STATUS = {
  pending: { text: '待验收', color: 'warning' },
  accepting: { text: '验收中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  returned: { text: '已退回', color: 'error' }
}

export const RECORD_TYPE = {
  accepted: { text: '验收入库', color: 'success' },
  returned: { text: '退回', color: 'error' },
  note: { text: '补充记录', color: 'default' }
}

// 批量结果错误码对应的语义分类
export const RESULT_CODE_META = {
  OK: { color: 'success', icon: 'check' },
  DONE: { color: 'warning', icon: 'exclamation' },
  MISMATCH: { color: 'error', icon: 'close' },
  DUPLICATE_BATCH: { color: 'error', icon: 'close' },
  INVALID: { color: 'error', icon: 'close' },
  REJECTED: { color: 'warning', icon: 'exclamation' },
  NOT_FOUND: { color: 'warning', icon: 'exclamation' },
  STOCK_ERROR: { color: 'error', icon: 'close' },
  BUSY: { color: 'warning', icon: 'exclamation' }
}

export function itemStatusText(status) {
  return ITEM_STATUS[status]?.text || status
}

export function orderStatusText(status) {
  return ORDER_STATUS[status]?.text || status
}

export function recordTypeText(type) {
  return RECORD_TYPE[type]?.text || type
}

// 明细待处理数量
export function remainingQty(item) {
  return Number(item.expectQty || 0) - Number(item.acceptedQty || 0) - Number(item.rejectedQty || 0)
}
