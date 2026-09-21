<template>
  <a-modal
    :open="open"
    title="验收入库退回"
    :confirm-loading="submitLoading"
    ok-text="确认退回"
    :mask-closable="false"
    width="560px"
    :destroy-on-close="true"
    @ok="handleSubmit"
    @cancel="$emit('cancel')"
  >
    <a-descriptions v-if="item" :column="2" size="small" bordered class="item-desc">
      <a-descriptions-item label="入库单号" :span="1">{{ orderNo }}</a-descriptions-item>
      <a-descriptions-item label="供应商批次" :span="1">{{ item.batchNo }}</a-descriptions-item>
      <a-descriptions-item label="ISBN" :span="1">{{ item.isbn }}</a-descriptions-item>
      <a-descriptions-item label="书名" :span="1">{{ item.title }}</a-descriptions-item>
      <a-descriptions-item label="采购数量" :span="1">{{ item.expectQty }} 册</a-descriptions-item>
      <a-descriptions-item label="已验收入库" :span="1">{{ item.acceptedQty }} 册</a-descriptions-item>
      <a-descriptions-item label="已退回" :span="1">{{ item.rejectedQty }} 册</a-descriptions-item>
      <a-descriptions-item label="待处理" :span="1">
        <span class="remaining">{{ remaining }} 册</span>
      </a-descriptions-item>
    </a-descriptions>

    <a-form
      ref="formRef"
      :model="formState"
      :rules="rules"
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 17 }"
      style="margin-top: 16px"
    >
      <a-form-item label="退回数量" name="returnQty">
        <a-input-number
          v-model:value="formState.returnQty"
          :min="1"
          :max="remaining"
          :precision="0"
          style="width: 100%"
          placeholder="请输入退回供应商数量"
        />
        <div class="form-hint">
          <a-button type="link" size="small" @click="formState.returnQty = remaining">
            待处理全部退回（{{ remaining }} 册）
          </a-button>
        </div>
      </a-form-item>
      <a-form-item label="退回原因" name="remark">
        <a-text-area
          v-model:value="formState.remark"
          :rows="3"
          placeholder="如：封面破损、印刷缺页、数量多发等（必填）"
        />
      </a-form-item>
    </a-form>

    <a-alert
      type="info"
      show-icon
      message="退回后该部分不增加馆藏与可借库存；若退回数量等于待处理数量，明细将标记为已退回"
    />
  </a-modal>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { useInboundStore } from '@/stores/inbound'
import { remainingQty } from '../inboundHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  order: { type: Object, default: null },
  item: { type: Object, default: null }
})
const emit = defineEmits(['success', 'cancel'])

const inboundStore = useInboundStore()
const formRef = ref(null)
const submitLoading = ref(false)

const formState = reactive({
  returnQty: 1,
  remark: ''
})

const rules = {
  returnQty: [{ required: true, message: '请输入退回数量', type: 'number' }],
  remark: [{ required: true, message: '请填写退回原因' }]
}

const remaining = computed(() => (props.item ? remainingQty(props.item) : 0))
const orderNo = computed(() => props.order?.orderNo || '')

watch(
  () => props.open,
  open => {
    if (open && props.item) {
      formState.returnQty = remainingQty(props.item)
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
  if (formState.returnQty > remaining.value) {
    message.error(`数量不符：退回 ${formState.returnQty} 册，超过待处理 ${remaining.value} 册`)
    return
  }

  submitLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    const result = inboundStore.returnItem({
      orderId: props.order.id,
      itemId: props.item.id,
      returnQty: formState.returnQty,
      remark: formState.remark.trim()
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
.item-desc {
  background: #fafafa;
  border-radius: 8px;
}

.remaining {
  color: #fa8c16;
  font-weight: 600;
}

.form-hint {
  margin-top: 4px;
  text-align: right;
}
</style>
