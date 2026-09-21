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

  function getBookByIsbn(isbn) {
    return books.value.find(book => String(book.isbn) === String(isbn))
  }

  // 采购验收入库联动：
  // - 已有图书（按 ISBN 匹配）：total / available 同步累加，可借库存立即生效
  // - 新品种：自动建立图书档案，初始库存即为本次入库数量，图书列表/首页统计自然兼容
  function stockInByIsbn(isbn, quantity, bookInfo = {}) {
    const qty = Number(quantity) || 0
    const existing = getBookByIsbn(isbn)
    if (existing) {
      existing.total = Number(existing.total || 0) + qty
      existing.available = Number(existing.available || 0) + qty
      if (bookInfo.location && !existing.location) existing.location = bookInfo.location
      existing.available = Math.min(existing.available, existing.total)
      return { created: false, book: existing }
    }

    const newId = books.value.length > 0
      ? Math.max(...books.value.map(b => b.id)) + 1
      : 1
    const newBook = {
      id: newId,
      isbn: String(isbn),
      title: bookInfo.title || '未命名图书',
      author: bookInfo.author || '',
      publisher: bookInfo.publisher || '',
      publishDate: bookInfo.publishDate || '',
      categoryId: bookInfo.categoryId ?? null,
      categoryName: bookInfo.categoryName || '',
      price: bookInfo.price ?? 0,
      total: qty,
      available: qty,
      location: bookInfo.location || '',
      cover: getDefaultCover(newId),
      description: bookInfo.description || '采购验收自动建档'
    }
    books.value.push(newBook)
    return { created: true, book: newBook }
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

  return {
    books,
    loading,
    totalBooks,
    totalAvailable,
    getBookById,
    getBookByIsbn,
    stockInByIsbn,
    addBook,
    updateBook,
    deleteBook,
    searchBooks,
    filterByCategory
  }
})
