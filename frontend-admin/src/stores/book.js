import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { books as initialBooks } from '@/data/mockData'

// 导入本地封面图片
import hlmCover from '@/views/img/hlm.webp'
import jsCover from '@/views/img/js.webp'
import sgyyCover from '@/views/img/sgyy.webp'
import vueCover from '@/views/img/vue.jpeg'
import sjCover from '@/views/img/sj.webp'
import jjxCover from '@/views/img/jjx.webp'
import xlxCover from '@/views/img/xlx.webp'
import sxCover from '@/views/img/sx.webp'

const STORAGE_KEY = 'library_books'

// 默认书籍封面图片（使用本地图片）
const DEFAULT_COVERS = [
  hlmCover,
  jsCover,
  sgyyCover,
  vueCover,
  sjCover,
  jjxCover,
  xlxCover,
  sxCover
]

// 获取默认封面
function getDefaultCover(index) {
  return DEFAULT_COVERS[index % DEFAULT_COVERS.length]
}

// 检查并修复书籍封面
function fixBookCovers(books) {
  return books.map((book, index) => {
    // 如果封面是 SVG data URI、placeholder 或外部链接，则使用本地封面
    if (!book.cover || book.cover.includes('data:image/svg') || book.cover.includes('placeholder.com') || book.cover.startsWith('http')) {
      return {
        ...book,
        cover: getDefaultCover(index)
      }
    }
    return book
  })
}

export const useBookStore = defineStore('book', () => {
  // 从 localStorage 读取或使用初始数据
  const loadBooks = () => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsedBooks = JSON.parse(stored)
        // 修复旧数据中的图片链接
        return fixBookCovers(parsedBooks)
      } catch (e) {
        console.error('Failed to parse stored books:', e)
      }
    }
    return [...initialBooks]
  }

  const books = ref(loadBooks())
  const loading = ref(false)

  // 监听变化并保存到 localStorage
  watch(books, (newBooks) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks))
  }, { deep: true })

  const totalBooks = computed(() => books.value.length)
  const totalAvailable = computed(() =>
    books.value.reduce((sum, book) => sum + book.available, 0)
  )

  function getBookById(id) {
    return books.value.find(book => book.id === id)
  }

  function addBook(book) {
    const newId = books.value.length > 0
      ? Math.max(...books.value.map(b => b.id)) + 1
      : 1
    books.value.push({ ...book, id: newId })
    return newId
  }

  function updateBook(id, data) {
    const index = books.value.findIndex(book => book.id === id)
    if (index !== -1) {
      books.value[index] = { ...books.value[index], ...data }
      return true
    }
    return false
  }

  function deleteBook(id) {
    const index = books.value.findIndex(book => book.id === id)
    if (index !== -1) {
      books.value.splice(index, 1)
      return true
    }
    return false
  }

  function searchBooks(keyword) {
    if (!keyword) return books.value
    const lowerKeyword = keyword.toLowerCase()
    return books.value.filter(book =>
      book.title.toLowerCase().includes(lowerKeyword) ||
      book.author.toLowerCase().includes(lowerKeyword) ||
      book.isbn.includes(keyword)
    )
  }

  function filterByCategory(categoryId) {
    if (!categoryId) return books.value
    return books.value.filter(book => book.categoryId === categoryId)
  }

  // ========================================
  // 采购入库联动：验收通过后同步可借库存
  // ========================================

  // 按 ISBN 查找既有图书
  function getBookByIsbn(isbn) {
    if (!isbn) return null
    return books.value.find(book => book.isbn === isbn) || null
  }

  // 按入库明细查找或新建图书（新采购图书在验收通过后自动建档）
  // 返回 { book, created }，兼容既有图书信息
  function findOrCreateByInboundItem(item) {
    let book = item.bookId ? getBookById(item.bookId) : null
    let created = false

    // bookId 失效时（如图书曾被删除），回退按 ISBN 匹配
    if (!book) {
      book = getBookByIsbn(item.isbn)
    }

    if (book) {
      return { book, created: false }
    }

    const newId = books.value.length > 0
      ? Math.max(...books.value.map(b => b.id)) + 1
      : 1
    const newBook = {
      id: newId,
      isbn: item.isbn,
      title: item.title,
      author: item.author || '',
      publisher: item.publisher || '',
      publishDate: '',
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName || '',
      price: item.price ?? 0,
      total: 0,
      available: 0,
      location: '',
      cover: getDefaultCover(newId),
      description: '采购入库验收后自动建档'
    }
    books.value.push(newBook)
    created = true
    return { book: newBook, created }
  }

  // 验收入库：total / available 同步增加，返回更新后的库存数
  function addStock(bookId, qty) {
    const count = Number(qty)
    if (!count || count <= 0) return null
    const index = books.value.findIndex(book => book.id === bookId)
    if (index === -1) return null
    const target = books.value[index]
    const nextTotal = (Number(target.total) || 0) + count
    const nextAvailable = (Number(target.available) || 0) + count
    books.value[index] = {
      ...target,
      total: nextTotal,
      available: nextAvailable
    }
    return { total: nextTotal, available: nextAvailable }
  }

  return {
    books,
    loading,
    totalBooks,
    totalAvailable,
    getBookById,
    getBookByIsbn,
    findOrCreateByInboundItem,
    addStock,
    addBook,
    updateBook,
    deleteBook,
    searchBooks,
    filterByCategory
  }
})
