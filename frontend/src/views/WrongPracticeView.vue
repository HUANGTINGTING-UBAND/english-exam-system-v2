<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  getWrongQuestionPractice,
  markWrongQuestionMastered,
} from '../api/examApi'

const route = useRoute()
const router = useRouter()

const detail = ref(null)
const isLoading = ref(false)
const isMarkingMastered = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const userChoice = ref(null)
const userTextAnswer = ref('')
const hasSubmitted = ref(false)
const isCorrect = ref(false)

const typeNameMap = {
  CHOICE: '单选题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const question = computed(() => {
  return detail.value?.question || null
})

const isChoiceQuestion = computed(() => {
  return question.value?.type === 'CHOICE'
})

const correctAnswerText = computed(() => {
  return question.value?.correctAnswerDisplay || question.value?.referenceAnswer || '暂无'
})

const hasUserAnswered = computed(() => {
  if (isChoiceQuestion.value) {
    return userChoice.value !== null && userChoice.value !== undefined
  }

  return Boolean(String(userTextAnswer.value || '').trim())
})

const resultTitle = computed(() => {
  if (!hasSubmitted.value) {
    return ''
  }

  if (isCorrect.value) {
    return '回答正确'
  }

  return '需要复习'
})

const resultSuggestion = computed(() => {
  if (!hasSubmitted.value) {
    return '提交后可以查看答案、解析和复习建议。'
  }

  if (isCorrect.value) {
    return '这次回答正确。确认已经掌握后，可以点击“标记已掌握”，让它从错题本中移除。'
  }

  return '这道题仍需复习。建议先阅读解析，再点击“再练一次”重新作答。'
})

const practiceTip = computed(() => {
  if (!question.value) {
    return ''
  }

  if (isChoiceQuestion.value) {
    return '选择一个选项后提交，系统会立即判断是否正确。'
  }

  return '主观题会按参考答案进行简单匹配，建议提交后重点查看参考答案和解析。'
})

const selectedChoiceText = computed(() => {
  if (!isChoiceQuestion.value || userChoice.value === null || userChoice.value === undefined) {
    return '未作答'
  }

  const index = Number(userChoice.value)
  const option = question.value?.options?.[index]

  if (!option) {
    return '未作答'
  }

  return `${String.fromCharCode(65 + index)}. ${option}`
})

const loadPracticeDetail = async () => {
  const wrongQuestionId = route.params.wrongQuestionId

  if (!wrongQuestionId) {
    errorMessage.value = '缺少错题 ID'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    detail.value = await getWrongQuestionPractice(wrongQuestionId)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '错题练习加载失败'
  } finally {
    isLoading.value = false
  }
}

const handleSubmitPractice = () => {
  if (!question.value) {
    return
  }

  if (!hasUserAnswered.value) {
    window.alert('请先作答，再提交练习。')
    return
  }

  hasSubmitted.value = true

  if (isChoiceQuestion.value) {
    isCorrect.value = Number(userChoice.value) === Number(question.value.answer)
    return
  }

  const userAnswer = String(userTextAnswer.value || '').trim().toLowerCase()
  const referenceAnswer = String(
    question.value.referenceAnswer || question.value.answer || ''
  ).trim().toLowerCase()

  isCorrect.value = Boolean(userAnswer && referenceAnswer && userAnswer === referenceAnswer)
}

const resetPractice = () => {
  userChoice.value = null
  userTextAnswer.value = ''
  hasSubmitted.value = false
  isCorrect.value = false
  successMessage.value = ''
}

const handleMarkMastered = async () => {
  const wrongQuestionId = route.params.wrongQuestionId

  if (!wrongQuestionId) {
    errorMessage.value = '缺少错题 ID'
    return
  }

  const confirmed = window.confirm(
    '确认将这道错题标记为已掌握吗？标记后它会从错题本中移除。'
  )

  if (!confirmed) {
    return
  }

  isMarkingMastered.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await markWrongQuestionMastered(wrongQuestionId)

    successMessage.value = '已标记为掌握，即将返回个人中心。'

    setTimeout(() => {
      router.push('/profile')
    }, 800)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '标记已掌握失败'
  } finally {
    isMarkingMastered.value = false
  }
}

onMounted(() => {
  loadPracticeDetail()
})
</script>

<template>
  <div class="wrong-practice-page">
    <div class="page-header">
      <p class="tag">Wrong Question Practice</p>
      <h1>错题重练</h1>
      <p class="desc">
        重新练习错题，查看正确答案、解析、知识点和复习建议。
      </p>
    </div>

    <div class="attempt-detail-actions">
      <RouterLink class="secondary-btn" to="/profile">
        返回个人中心
      </RouterLink>

      <RouterLink class="secondary-btn" to="/exams">
        返回试卷列表
      </RouterLink>
    </div>

    <div v-if="successMessage" class="api-success">
      {{ successMessage }}
    </div>

    <div v-if="isLoading" class="loading-box">
      正在加载错题练习……
    </div>

    <div v-else-if="errorMessage" class="api-warning">
      {{ errorMessage }}
    </div>

    <section v-else-if="detail && question" class="wrong-practice-section">
      <div class="wrong-practice-card">
        <div class="wrong-practice-meta">
          <span>{{ typeNameMap[question.type] || question.type }}</span>
          <span>{{ question.score }} 分</span>
          <span>{{ question.knowledgePoint || '未分类' }}</span>
          <span>{{ detail.exam?.title || '未知试卷' }}</span>
        </div>

        <h2>{{ question.text }}</h2>

        <p class="wrong-practice-tip">
          {{ practiceTip }}
        </p>

        <div v-if="isChoiceQuestion" class="wrong-choice-list">
          <label
            v-for="(option, index) in question.options || []"
            :key="option"
            class="wrong-choice-option"
            :class="{
              selected: Number(userChoice) === index,
              disabled: hasSubmitted,
            }"
          >
            <input
              v-model="userChoice"
              type="radio"
              name="wrong-practice-choice"
              :value="index"
              :disabled="hasSubmitted"
            />
            <span>{{ String.fromCharCode(65 + index) }}. {{ option }}</span>
          </label>
        </div>

        <div v-else class="wrong-text-answer">
          <label>
            你的答案
            <textarea
              v-model="userTextAnswer"
              rows="5"
              :disabled="hasSubmitted"
              placeholder="请输入你的答案"
            ></textarea>
          </label>
        </div>

        <div class="wrong-practice-actions">
          <button
            v-if="!hasSubmitted"
            class="primary-btn"
            :disabled="!hasUserAnswered"
            @click="handleSubmitPractice"
          >
            提交练习
          </button>

          <button
            v-else
            class="secondary-btn"
            @click="resetPractice"
          >
            再练一次
          </button>

          <button
            class="secondary-btn"
            :disabled="isMarkingMastered"
            @click="handleMarkMastered"
          >
            {{ isMarkingMastered ? '处理中……' : '标记已掌握' }}
          </button>
        </div>
      </div>

      <div
        v-if="hasSubmitted"
        class="wrong-practice-result-card"
        :class="{
          correct: isCorrect,
          wrong: !isCorrect,
        }"
      >
        <h2>
          {{ resultTitle }}
        </h2>

        <p class="wrong-practice-result-suggestion">
          {{ resultSuggestion }}
        </p>

        <p v-if="isChoiceQuestion">
          <strong>你的答案：</strong>
          {{ selectedChoiceText }}
        </p>

        <p v-else>
          <strong>你的答案：</strong>
          {{ userTextAnswer || '未作答' }}
        </p>

        <p>
          <strong>正确答案：</strong>
          {{ correctAnswerText }}
        </p>

        <p v-if="question.referenceAnswer">
          <strong>参考答案：</strong>
          {{ question.referenceAnswer }}
        </p>

        <p>
          <strong>知识点：</strong>
          {{ question.knowledgePoint || '未分类' }}
        </p>

        <p v-if="question.explanation">
          <strong>解析：</strong>
          {{ question.explanation }}
        </p>
      </div>
    </section>

    <p v-else class="empty-text">
      暂无错题练习内容。
    </p>
  </div>
</template>
