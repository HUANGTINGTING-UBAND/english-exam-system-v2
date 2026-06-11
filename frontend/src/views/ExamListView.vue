<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getExams } from '../api/examApi'
import { mockExams } from '../data/mockExams'
import {
  examCategoryGroups,
  examCategoryNameMap,
  examGroupNameMap,
  getExamCategoryName,
  getExamGroupName,
} from '../utils/examCategories'

const route = useRoute()

const exams = ref([])
const isLoading = ref(false)
const errorMessage = ref('')

const grade = computed(() => route.query.grade || '')
const group = computed(() => route.query.group || '')

const currentCategoryName = computed(() => {
  if (grade.value) {
    return getExamCategoryName(String(grade.value).toUpperCase())
  }

  if (group.value) {
    return getExamGroupName(String(group.value).toUpperCase())
  }

  return '全部试卷'
})

const normalizeValue = (value) => {
  if (!value) {
    return ''
  }

  return String(value).toUpperCase()
}

const getGradesByGroup = (groupValue) => {
  const normalizedGroup = normalizeValue(groupValue)
  const matchedGroup = examCategoryGroups.find((item) => item.key === normalizedGroup)

  return matchedGroup?.grades || []
}

const fallbackToMockExams = () => {
  const currentGrade = normalizeValue(grade.value)
  const currentGroup = normalizeValue(group.value)
  const groupGrades = getGradesByGroup(currentGroup)

  if (currentGrade) {
    exams.value = mockExams.filter((exam) => {
      return normalizeValue(exam.gradeLevel) === currentGrade
    })
    return
  }

  if (groupGrades.length > 0) {
    exams.value = mockExams.filter((exam) => {
      return groupGrades.includes(normalizeValue(exam.gradeLevel))
    })
    return
  }

  exams.value = mockExams
}

const loadExams = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    exams.value = await getExams({
      grade: normalizeValue(grade.value),
      group: normalizeValue(group.value),
    })
  } catch (error) {
    console.error(error)
    errorMessage.value = '后端接口暂时不可用，当前显示本地 mock 试卷数据。'
    fallbackToMockExams()
  } finally {
    isLoading.value = false
  }
}

const formatTimeLimit = (seconds) => {
  return Math.round(Number(seconds || 0) / 60)
}

watch(
  () => route.fullPath,
  () => {
    loadExams()
  }
)

onMounted(() => {
  loadExams()
})
</script>

<template>
  <div class="exam-list-page">
    <div class="page-header">
      <p class="tag">Exam List</p>
      <h1>{{ currentCategoryName }}列表</h1>
      <p class="desc">
        请选择一张试卷开始练习。你可以按考试方向或具体分类查看试卷。
      </p>
    </div>

    <div class="exam-category-nav">
      <RouterLink class="secondary-btn" to="/exams">
        全部试卷
      </RouterLink>

      <RouterLink
        v-for="item in examCategoryGroups"
        :key="item.key"
        class="secondary-btn"
        :to="`/exams?group=${item.key}`"
      >
        {{ item.name }}
      </RouterLink>
    </div>

    <div v-if="errorMessage" class="api-warning">
      {{ errorMessage }}
    </div>

    <div v-if="isLoading" class="loading-box">
      正在加载试卷数据……
    </div>

    <div v-else-if="exams.length > 0" class="exam-card-grid">
      <div
        v-for="exam in exams"
        :key="exam.id"
        class="exam-card"
      >
        <p class="tag">
          {{ examCategoryNameMap[exam.gradeLevel] || exam.gradeLevel || '未分类' }}
        </p>

        <h2>{{ exam.title }}</h2>
        <p>{{ exam.description }}</p>

        <div class="exam-meta">
          <span>题目数量：{{ exam.questionCount }} 题</span>
          <span>考试时间：{{ formatTimeLimit(exam.timeLimit) }} 分钟</span>
          <span>试卷满分：{{ exam.totalScore }} 分</span>
        </div>

        <RouterLink
          class="primary-btn"
          :to="`/exam/${exam.id}`"
        >
          进入考试
        </RouterLink>
      </div>
    </div>

    <div v-else class="empty-card">
      <h2>暂无试卷</h2>
      <p>当前分类暂时没有可用试卷。</p>
      <RouterLink class="secondary-btn" to="/">
        返回首页
      </RouterLink>
    </div>
  </div>
</template>
