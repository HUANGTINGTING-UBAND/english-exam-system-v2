<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getStudentAttemptReport } from '../api/examApi'

const route = useRoute()
const report = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')

const typeNameMap = {
  CHOICE: '选择题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const weakTypeNames = computed(() => {
  return report.value?.weakTypes?.map((item) => typeNameMap[item.type] || item.type) || []
})

const formatScore = (score) => {
  if (score === null || score === undefined) {
    return '暂无'
  }

  const value = Number(score || 0)
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return '暂无'
  }

  return `${value}%`
}

const formatUsedTime = (seconds) => {
  if (seconds === null || seconds === undefined) {
    return '暂无'
  }

  const safeSeconds = Math.max(Number(seconds || 0), 0)
  const minutes = Math.floor(safeSeconds / 60)
  const restSeconds = safeSeconds % 60

  return `${minutes}分${String(restSeconds).padStart(2, '0')}秒`
}

const formatDateTime = (value) => {
  return value ? new Date(value).toLocaleString() : '暂无'
}

const loadReport = async () => {
  const attemptId = route.params.attemptId

  if (!attemptId) {
    errorMessage.value = '缺少考试记录 ID'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    report.value = await getStudentAttemptReport(attemptId)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '个人学习报告加载失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadReport)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Learning Report</p>
      <h1>个人学习报告</h1>
      <p>基于本次考试作答、错题和题型得分生成规则版学习建议。</p>
    </section>

    <section class="profile-section">
      <div v-if="isLoading" class="loading-box">
        正在加载个人学习报告……
      </div>

      <div v-else-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <template v-else-if="report">
        <div class="profile-card">
          <div>
            <p class="tag">Report</p>
            <h2>{{ report.exam.title }}</h2>
            <p v-if="report.assignment">
              来自班级任务：{{ report.assignment.classroomName }}｜{{ report.assignment.title }}
            </p>
            <p v-else>
              普通考试记录
            </p>
          </div>

          <div class="profile-actions">
            <RouterLink class="secondary-btn" to="/student/assignments">
              返回我的班级任务
            </RouterLink>

            <RouterLink class="secondary-btn" to="/profile">
              返回个人中心
            </RouterLink>

            <RouterLink
              class="secondary-btn"
              :to="`/attempts/${report.attempt.id}`"
            >
              查看结果详情
            </RouterLink>
          </div>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <h2>成绩概览</h2>
          </div>

          <div class="learning-stats-grid">
            <div class="learning-stat-item">
              <span>总分</span>
              <strong>{{ formatScore(report.summary.totalScore) }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>得分</span>
              <strong>{{ formatScore(report.summary.earnedScore) }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>得分率</span>
              <strong>{{ formatPercent(report.summary.scoreRate) }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>正确题数</span>
              <strong>{{ report.summary.correctCount }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>错误题数</span>
              <strong>{{ report.summary.wrongCount }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>未作答</span>
              <strong>{{ report.summary.unansweredCount }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>用时</span>
              <strong>{{ formatUsedTime(report.summary.usedTime) }}</strong>
            </div>

            <div class="learning-stat-item">
              <span>提交时间</span>
              <strong>{{ formatDateTime(report.summary.submittedAt) }}</strong>
            </div>
          </div>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <h2>基础学习建议</h2>
          </div>

          <div class="api-success">
            <strong>{{ report.basicAdvice.summary }}</strong>
            <p
              v-for="suggestion in report.basicAdvice.suggestions"
              :key="suggestion"
            >
              {{ suggestion }}
            </p>
          </div>

          <p v-if="weakTypeNames.length > 0">
            薄弱题型：{{ weakTypeNames.join('、') }}
          </p>
          <p v-else class="empty-text">
            暂无明显薄弱题型。
          </p>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <h2>题型表现</h2>
          </div>

          <div v-if="report.typeStats.length > 0" class="type-stat-table-wrap">
            <table class="type-stat-table">
              <thead>
                <tr>
                  <th>题型</th>
                  <th>题目数</th>
                  <th>总分值</th>
                  <th>学生得分</th>
                  <th>得分率</th>
                  <th>正确</th>
                  <th>错误</th>
                  <th>未作答</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in report.typeStats" :key="item.type">
                  <td>{{ typeNameMap[item.type] || item.type }}</td>
                  <td>{{ item.questionCount }}</td>
                  <td>{{ formatScore(item.totalScore) }}</td>
                  <td>{{ formatScore(item.studentScore) }}</td>
                  <td>{{ formatPercent(item.scoreRate) }}</td>
                  <td>{{ item.correctCount }}</td>
                  <td>{{ item.wrongCount }}</td>
                  <td>{{ item.unansweredCount }}</td>
                  <td>{{ item.manual_or_subjective ? 'manual_or_subjective' : '客观题自动统计' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-else class="empty-text">
            暂无题型统计。
          </p>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <div>
              <h2>建议优先复习题目</h2>
              <p class="section-subtitle">按失分和题号排序，最多显示 5 道。</p>
            </div>
          </div>

          <div v-if="report.reviewPriorityQuestions.length > 0" class="attempt-list">
            <article
              v-for="question in report.reviewPriorityQuestions"
              :key="question.questionId"
              class="attempt-card"
            >
              <div>
                <h3>第 {{ question.orderIndex }} 题</h3>
                <p>{{ typeNameMap[question.type] || question.type }}｜{{ question.knowledgePoint }}</p>
                <p>{{ question.text }}</p>
              </div>
            </article>
          </div>

          <p v-else class="empty-text">
            暂无需要优先复习的题目。
          </p>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <div>
              <h2>错题列表</h2>
              <p class="section-subtitle">包含错误、未作答和主观题失分项。</p>
            </div>
          </div>

          <div v-if="report.wrongQuestions.length > 0" class="attempt-list">
            <article
              v-for="question in report.wrongQuestions"
              :key="question.questionId"
              class="attempt-card"
            >
              <div>
                <h3>第 {{ question.orderIndex }} 题</h3>
                <p>{{ typeNameMap[question.type] || question.type }}｜{{ question.knowledgePoint }}</p>
                <p v-if="question.materialTitle">材料：{{ question.materialTitle }}</p>
                <p>{{ question.text }}</p>
                <p>你的答案：{{ question.studentAnswer }}</p>
                <p>正确答案：{{ question.correctAnswer }}</p>
                <p>
                  得分：{{ formatScore(question.userScore) }} / {{ formatScore(question.score) }}
                  <template v-if="question.manual_or_subjective">
                    ｜manual_or_subjective
                  </template>
                </p>
                <p v-if="question.explanation">解析：{{ question.explanation }}</p>
              </div>
            </article>
          </div>

          <p v-else class="empty-text">
            本次没有明显错题。
          </p>
        </div>
      </template>

      <p v-else class="empty-text">
        暂无学习报告。
      </p>
    </section>
  </div>
</template>
