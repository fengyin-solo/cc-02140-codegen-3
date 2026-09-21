<template>
  <a-modal
    :open="open"
    title="补充验收记录"
    :confirm-loading="submitLoading"
    ok-text="保存记录"
    :mask-closable="false"
    width="520px"
    :destroy-on-close="true"
    @ok="handleSubmit"
    @cancel="$emit('cancel')"
  >
    <div v-if="item" class="item-meta">
      <BookOutlined />
      <span class="title">{{ item.title }}</span>
      <a-tag :color="ITEM_STATUS[item.status]?.color">{{ ITEM_STATUS[item.status]?.text }}</a-tag>
      <span class="sub">单号 {{ orderNo }} · 批次 {{ item.batchNo }}</span>
    </div>

    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 5 }"
      :wrapper-col="{ span: 19 }"
    >
      <a-form-item label="记录内容" name="remark">
        <a-text-area
          v-model:value="formState.remark"
          :rows="4"
          placeholder="如：2 册封面磨损已单独登记，等待供应商补发；剩余待处理数量保持不变"
        />
      </a-form-item>
    </a-form>

    <a-alert
      type="info"
      show-icon
      message="补充记录仅写入验收日志，不改变验收数量与库存，用于保留待处理项的处理痕迹"
    />
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { BookOutlined } from '@ant-design/icons-vue'
import { useInboundStore } from '@/stores/inbound'
import { ITEM_STATUS } from '../inboundHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  order: { type: Object, default: null },
  item: { type: Object, default: null }
})
const emit = defineEmits(['success', 'cancel'])

const inboundStore = useInboundStore()
const formRef = ref(null)
const submitLoading = ref(false)

const formState = reactive({ remark: '' })
const rules = { remark: [{ required: true, message: '请输入记录内容' }] }

const orderNo = computed(() => props.order?.orderNo || '')

watch(
  () => props.open,
  open => {
    if (open) {
      formState.remark = ''
      nextTick(() => formRef.value?.clearValidate())
    }
  }
)

async function handleSubmit() {
  if (!props.item || !props.order) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  submitLoading.value = true
  try {
    const result = inboundStore.noteItem({
      orderId: props.order.id,
      itemId: props.item.id,
      remark: formState.remark
    })
    if (result.ok) {
      message.success(result.message)
      emit('success', result)
    } else {
      message.error(result.message)
    }
  } finally {
    submitLoading.value = false
  }
}
</script>

<style lang="less" scoped>
.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fafafa;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;

  .title {
    font-weight: 600;
  }

  .sub {
    font-size: 12px;
    color: #999;
    margin-left: auto;
  }
}
</style>
