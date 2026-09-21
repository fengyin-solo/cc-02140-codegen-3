<template>
  <a-modal
    :open="open"
    title="逐条验收入库"
    :confirm-loading="submitLoading"
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
      <a-form-item label="本次实收" name="actualQty">
        <a-input-number
          v-model:value="formState.actualQty"
          :min="1"
          :max="remaining"
          :precision="0"
          style="width: 100%"
          placeholder="请输入本次实际验收合格数量"
        />
        <div class="form-hint">
          <a-button type="link" size="small" @click="formState.actualQty = remaining">
            全部到货（{{ remaining }} 册）
          </a-button>
        </div>
      </a-form-item>
      <a-form-item label="验收备注" name="remark">
        <a-text-area
          v-model:value="formState.remark"
          :rows="3"
          placeholder="如：数量短缺、品相瑕疵处理说明（可选）"
        />
      </a-form-item>
    </a-form>

    <a-alert
      v-if="dupWarn"
      type="error"
      show-icon
      :message="dupWarn"
      style="margin-bottom: 12px"
    />
    <a-alert
      v-if="partialWarn"
      type="warning"
      show-icon
      message="实收数量小于待处理数量，将按部分入库处理，剩余数量保留待处理"
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
  actualQty: 1,
  remark: ''
})

const rules = {
  actualQty: [{ required: true, message: '请输入实收数量', type: 'number' }]
}

const remaining = computed(() => (props.item ? remainingQty(props.item) : 0))
const orderNo = computed(() => props.order?.orderNo || '')

const partialWarn = computed(() =>
  props.open && formState.actualQty > 0 && formState.actualQty < remaining.value
)

// 同批次重复入库预判
const dupWarn = computed(() => {
  if (!props.open || !props.item) return ''
  const dup = inboundStore.findDuplicateBatch(props.item.isbn, props.item.batchNo, props.item.id)
  if (dup) {
    return `供应商批次 ${props.item.batchNo || '(空)'} 已在入库单 ${dup.orderNo} 验收入库，提交将被拦截`
  }
  return ''
})

watch(
  () => props.open,
  open => {
    if (open && props.item) {
      formState.actualQty = remainingQty(props.item)
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
  if (formState.actualQty > remaining.value) {
    message.error(`数量不符：实收 ${formState.actualQty} 册，超过待处理 ${remaining.value} 册`)
    return
  }

  submitLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 300))
    const result = inboundStore.acceptItem({
      orderId: props.order.id,
      itemId: props.item.id,
      actualQty: formState.actualQty,
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
