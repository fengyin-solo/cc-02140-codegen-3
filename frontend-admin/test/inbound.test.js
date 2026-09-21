// 采购入库模块核心逻辑测试（node 环境，配合 esbuild 打包运行）
import { setActivePinia, createPinia } from 'pinia'
import { useInboundStore } from '@/stores/inbound'
import { useBookStore } from '@/stores/book'

// ---- 最小 localStorage mock ----
const storage = new Map()
globalThis.localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
  clear: () => storage.clear()
}

let pass = 0
let fail = 0
function assert(cond, msg) {
  if (cond) {
    pass += 1
    console.log(`  ✓ ${msg}`)
  } else {
    fail += 1
    console.error(`  ✗ ${msg}`)
  }
}
function section(name) {
  console.log(`\n${name}`)
}

function reset() {
  storage.clear()
  setActivePinia(createPinia())
}

// ============================================================
section('1. 初始数据与归一化')
reset()
let inbound = useInboundStore()
let books = useBookStore()
assert(inbound.orders.length === 3, '载入 3 张默认入库单')
assert(inbound.records.length === 1, '载入 1 条默认验收记录')
const order2 = inbound.getOrderById(2)
assert(order2.status === 'accepting', 'PO202409002 含退回+待处理，归一化为「验收中」')
const it201 = order2.items.find(i => i.id === 201)
assert(it201.status === 'rejected', '全部退回明细状态为「已退回」')
assert(inbound.pendingItems.length === 6, `待处理明细共 6 条（实际 ${inbound.pendingItems.length}）`)

// ============================================================
section('2. 单条验收入库与库存同步（已有图书）')
reset()
inbound = useInboundStore()
books = useBookStore()
const before = books.getBookById(2)
const beforeTotal = before.total
const beforeAvail = before.available
const r1 = inbound.acceptItem({ orderId: 1, itemId: 101, actualQty: 10, remark: '' })
assert(r1.ok, `101 全量验收成功：${r1.message}`)
const after = books.getBookById(2)
assert(after.total === beforeTotal + 10, `total 增加 10（${beforeTotal} -> ${after.total}）`)
assert(after.available === beforeAvail + 10, `available 增加 10（${beforeAvail} -> ${after.available}）`)
const it101 = inbound.getOrderById(1).items.find(i => i.id === 101)
assert(it101.status === 'accepted', '101 状态变为已入库')
assert(it101.acceptedQty === 10, '累计验收数为 10')

// ============================================================
section('3. 重复提交防护（已验收明细再次提交）')
const r2 = inbound.acceptItem({ orderId: 1, itemId: 101, actualQty: 10, remark: '' })
assert(!r2.ok && r2.code === 'DONE', `再次提交被拦截：${r2.message}`)
const after2 = books.getBookById(2)
assert(after2.available === beforeAvail + 10, '重复提交不产生第二次库存变动')
assert(inbound.records.filter(x => x.type === 'accepted' && x.itemId === 101).length === 1, '仅 1 条验收记录')

// ============================================================
section('4. 同一供应商批次重复入库校验（跨单据）')
// 101 已用批次 XHSD-20240901 入库；301 同 ISBN+批次
const r3 = inbound.acceptItem({ orderId: 3, itemId: 301, actualQty: 3, remark: '' })
assert(!r3.ok && r3.code === 'DUPLICATE_BATCH', `301 重复批次被拦截：${r3.message}`)
const it301 = inbound.getOrderById(3).items.find(i => i.id === 301)
assert(it301.status === 'pending', '失败明细保留为待验收')
assert(it301.acceptedQty === 0, '失败明细库存数不变')

// ============================================================
section('5. 数量不符：部分入库后继续验收，超出剩余被拒绝')
const r4 = inbound.acceptItem({ orderId: 1, itemId: 102, actualQty: 3, remark: '先到 3 册' })
assert(r4.ok, `102 部分验收 3 册成功：${r4.message}`)
const it102 = inbound.getOrderById(1).items.find(i => i.id === 102)
assert(it102.status === 'partial', '102 状态为部分入库')
assert(it102.acceptedQty === 3, '已验收 3 册')

// 采购 5 册、已收 3，再收 3 超过待处理 2 -> 拒绝
const r4b = inbound.acceptItem({ orderId: 1, itemId: 102, actualQty: 3, remark: '' })
assert(!r4b.ok && r4b.code === 'MISMATCH', `再收 3 册数量不符被拦截：${r4b.message}`)
assert(it102.acceptedQty === 3, '失败提交不改变累计验收数')

// ============================================================
section('6. 数量超出待处理被拒绝')
const r5 = inbound.acceptItem({ orderId: 1, itemId: 102, actualQty: 99, remark: '' })
assert(!r5.ok && r5.code === 'MISMATCH', `超量被拦截：${r5.message}`)

// 收尾 102
const r5b = inbound.acceptItem({ orderId: 1, itemId: 102, actualQty: 2, remark: '到齐' })
assert(r5b.ok, '剩余 2 册验收成功')
assert(inbound.getOrderById(1).items.find(i => i.id === 102).status === 'accepted', '102 全部入库')

// ============================================================
section('7. 新图书验收时自动建档并同步库存')
const isbnNew = '978-7-111-54493-9'
assert(!books.getBookByIsbn(isbnNew), '验收前书库无《深入理解计算机系统》')
const r6 = inbound.acceptItem({ orderId: 1, itemId: 103, actualQty: 6, remark: '' })
assert(r6.ok && r6.created, `新书验收成功并建档：${r6.message}`)
const newBook = books.getBookByIsbn(isbnNew)
assert(!!newBook, '书库中可检索到新图书')
assert(newBook.total === 6 && newBook.available === 6, '新图书 total/available 均为 6')
const it103 = inbound.getOrderById(1).items.find(i => i.id === 103)
assert(it103.bookId === newBook.id, '明细回填新建图书 id')

// ============================================================
section('8. 单据状态联动：全部入库 -> 已完成')
const order1 = inbound.getOrderById(1)
assert(order1.status === 'completed', `PO202409001 全部完成（实际 ${order1.status}）`)

// ============================================================
section('9. 批量验收：混合成功/失败逐条返回结果，失败保留待处理')
reset()
inbound = useInboundStore()
books = useBookStore()
// 勾选：101(正常10) 301(重复批次) 202(正常4)
// 先让 301 的重复批次成立：先验收 101
const batchRows = [
  inbound.flatItems.find(i => i.id === 101),
  inbound.flatItems.find(i => i.id === 301),
  inbound.flatItems.find(i => i.id === 202)
].map(row => ({
  orderId: row.orderId,
  itemId: row.id,
  orderNo: row.orderNo,
  supplierName: row.supplierName,
  isbn: row.isbn,
  title: row.title,
  batchNo: row.batchNo,
  expectQty: row.expectQty,
  actualQty: row.expectQty
}))
const br = inbound.batchAccept(batchRows)
assert(br.successCount === 2, `批量成功 2 条（实际 ${br.successCount}）`)
assert(br.failedCount === 1, `批量失败 1 条（实际 ${br.failedCount}）：${br.results.find(r => !r.ok)?.message}`)
const failed301 = inbound.getOrderById(3).items.find(i => i.id === 301)
assert(failed301.status === 'pending' && failed301.acceptedQty === 0, '重复批次的 301 保留待处理')
assert(inbound.getOrderById(1).items.find(i => i.id === 101).status === 'accepted', '101 入库成功')
assert(inbound.getOrderById(2).items.find(i => i.id === 202).status === 'accepted', '202 入库成功')

// ============================================================
section('10. 批量数量不符：保留待处理，且不增加库存')
const book6Before = books.getBookById(6)
const rows10 = [
  {
    ...inbound.flatItems.find(i => i.id === 302),
    actualQty: 8 // 待处理 10，不符
  }
]
const br2 = inbound.batchAccept(rows10)
assert(br2.failedCount === 1 && br2.results[0].code === 'MISMATCH', `数量不符逐条失败：${br2.results[0].message}`)
const it302 = inbound.getOrderById(3).items.find(i => i.id === 302)
assert(it302.status === 'pending', '302 保留待验收')
const book6After = books.getBookById(6)
assert(book6After.total === book6Before.total && book6After.available === book6Before.available, '数量不符不改动库存')

// ============================================================
section('11. 多选退回：整批退回 + 重复退回防护')
const ret = inbound.batchReturn([
  inbound.flatItems.find(i => i.id === 301),
  inbound.flatItems.find(i => i.id === 302)
], '批量退回测试')
assert(ret.ok && ret.successCount === 2, `301/302 两条退回成功：${ret.message}`)
const it302b = inbound.getOrderById(3).items.find(i => i.id === 302)
assert(it302b.status === 'rejected' && it302b.rejectedQty === 10, '302 已退回 10 册')
assert(inbound.getOrderById(3).items.find(i => i.id === 301).status === 'rejected', '301 已退回')
assert(inbound.getOrderById(3).status === 'returned', '两条全部退回 -> PO202409003 已退回')
const retAgain = inbound.batchReturn([
  (() => {
    const { item } = inbound.getItem(3, 302)
    return { orderId: 3, itemId: item.id, title: item.title }
  })()
])
assert(!retAgain.ok || retAgain.failedCount === 1, '重复退回被拦截')

// ============================================================
section('12. 部分退回后单据状态为验收中，可继续验收剩余')
reset()
inbound = useInboundStore()
books = useBookStore()
const rr = inbound.returnItem({ orderId: 1, itemId: 102, returnQty: 2, remark: '2 册破损退回' })
assert(rr.ok, '102 部分退回 2 册成功')
const it102c = inbound.getOrderById(1).items.find(i => i.id === 102)
assert(it102c.status === 'partial', '102 有退有未处理，状态为部分入库（仍可继续验收 3 册）')
const o1 = inbound.getOrderById(1)
assert(o1.status === 'accepting', 'PO202409001 状态为验收中')
const ra = inbound.acceptItem({ orderId: 1, itemId: 102, actualQty: 3, remark: '余下 3 册合格' })
assert(ra.ok, '剩余 3 册验收成功')
assert(inbound.getOrderById(1).items.find(i => i.id === 102).status === 'accepted', '102 最终全部处理完成')

// ============================================================
section('13. 补充记录不改数量、不改库存')
const availBeforeNote = books.getBookById(4)?.available
const nr = inbound.noteItem({ orderId: 1, itemId: 101, remark: '供应商承诺补发赠品 2 册' })
assert(nr.ok, '备注记录写入成功')
const noteRecs = inbound.records.filter(r => r.type === 'note')
assert(noteRecs.length === 1 && noteRecs[0].changeQty === 0, '补充记录数量变动为 0')
assert(books.getBookById(4)?.available === availBeforeNote, '补充记录不影响库存')

// ============================================================
section('14. processing 锁防重复提交')
inbound.processing = true
const busy = inbound.acceptItem({ orderId: 2, itemId: 202, actualQty: 4 })
assert(!busy.ok && busy.code === 'BUSY', `处理中再次提交被拦截：${busy.message}`)
inbound.processing = false

// ============================================================
section('15. 重新进入（从 localStorage 重新载入）后状态不错配')
setActivePinia(createPinia())
const inbound2 = useInboundStore()
const books2 = useBookStore()
// 第 12 节 reset 后：order1 仅 102 处理完（2 退 + 3 入），101/103 待验收
assert(inbound2.getOrderById(1).status === 'accepting', '重进后 PO202409001 仍为验收中')
assert(inbound2.getOrderById(2).status === 'accepting', '重进后 PO202409002 仍为验收中（含初始退回记录）')
assert(inbound2.getOrderById(3).status === 'pending', '重进后 PO202409003 仍为待验收')
assert(inbound2.getOrderById(1).items.find(i => i.id === 102).status === 'accepted', '重进后 102 仍为已入库')
assert(books2.getBookById(2).total > 0, '书库库存数据独立持久化、仍然存在')

// 篡改本地状态，重新载入应自动归一化
const raw = JSON.parse(localStorage.getItem('library_inbound_orders'))
raw[0].status = 'completed' // 强行标记已完成
raw[0].items.forEach(i => { i.status = 'accepted' }) // 强行标记全部已入库（实际 101/103 数量为 0）
localStorage.setItem('library_inbound_orders', JSON.stringify(raw))
setActivePinia(createPinia())
const inbound3 = useInboundStore()
assert(inbound3.getOrderById(1).status === 'accepting', '本地缓存状态被篡改后，载入时自动修复为验收中')
assert(inbound3.getOrderById(1).items.find(i => i.id === 101).status === 'pending', '明细状态同步修复为待验收')

// ============================================================
section('16. 单据维护：仅待验收单可编辑/删除')
reset()
inbound = useInboundStore()
const delOk = inbound.deleteOrder(1)
assert(delOk, '待验收单删除成功')
assert(inbound.orders.length === 2, '删除后剩余 2 张单')
const delNo = inbound.deleteOrder(2)
assert(!delNo, '验收中的单据不可删除')
const updNo = inbound.updateOrder(2, {
  supplierId: 2, supplierName: '机械工业出版社', orderDate: '2024-09-12',
  warehouse: '主馆一号库', items: []
})
assert(!updNo, '验收中的单据不可编辑')

console.log(`\n========================================`)
console.log(`通过 ${pass} 项，失败 ${fail} 项`)
if (fail > 0) process.exit(1)
