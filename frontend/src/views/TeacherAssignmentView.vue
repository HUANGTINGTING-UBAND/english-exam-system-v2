<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import { getExams } from '../api/examApi'
import {
  createTeacherAssignment,
  getTeacherAssignmentAnalytics,
  getTeacherAssignments,
  getTeacherClassrooms,
} from '../api/platformApi'

const route = useRoute()
const currentUser = ref(getSavedUser())
const classrooms = ref([])
const exams = ref([])
const assignments = ref([])
const selectedAssignment = ref(null)
const submissions = ref([])
const selectedAnalytics = ref(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  classroomId: '',
  examId: '',
  title: '',
  description: '',
  dueAt: '',
})

const isTeacher = computed(() => currentUser.value?.role === 'TEACHER')
const selectedExam = computed(() => {
  return exams.value.find((exam) => exam.id === form.value.examId) || null
})

const questionTypeNameMap = {
  CHOICE: '选择题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

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

const formatDateTime = (value) => {
  return value ? new Date(value).toLocaleString() : '暂无'
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

const loadData = async () => {
  if (!isTeacher.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const [classroomResult, examResult, assignmentResult] = await Promise.all([
      getTeacherClassrooms(),
      getExams(),
      getTeacherAssignments(),
    ])

    classrooms.value = classroomResult
    exams.value = examResult
    assignments.value = assignmentResult

    if (!form.value.classroomId && classrooms.value[0]) {
      form.value.classroomId = classrooms.value[0].id
    }

    const queryExamId = route.query.examId
    const queryExam = queryExamId
      ? exams.value.find((exam) => exam.id === queryExamId)
      : null

    if (queryExam) {
      form.value.examId = queryExam.id
      form.value.title = form.value.title || queryExam.title
      successMessage.value = `已选择刚生成的试卷：${queryExam.title}`
    } else if (!form.value.examId && exams.value[0]) {
      form.value.examId = exams.value[0].id
    }

    const queryAssignmentId = route.query.assignmentId
    if (queryAssignmentId) {
      const assignment = assignmentResult.find((item) => item.id === queryAssignmentId)
      if (assignment) {
        await selectAssignment(assignment)
      }
    }
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '教师任务加载失败'
  } finally {
    isLoading.value = false
  }
}

const handleCreateAssignment = async () => {
  if (!form.value.classroomId || !form.value.examId) {
    errorMessage.value = '请选择班级和试卷'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await createTeacherAssignment({
      classroomId: form.value.classroomId,
      examId: form.value.examId,
      title: form.value.title,
      description: form.value.description,
      dueAt: form.value.dueAt || null,
    })

    successMessage.value = '任务发布成功'
    form.value.title = ''
    form.value.description = ''
    form.value.dueAt = ''
    await loadData()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '任务发布失败'
  } finally {
    isSubmitting.value = false
  }
}

const selectAssignment = async (assignment) => {
  selectedAssignment.value = assignment
  submissions.value = []
  selectedAnalytics.value = null
  errorMessage.value = ''

  try {
    const result = await getTeacherAssignmentAnalytics(assignment.id)
    selectedAnalytics.value = result
    selectedAssignment.value = result.assignment
    submissions.value = result.students
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '任务统计分析加载失败'
  }
}

watch(
  () => route.query.assignmentId,
  async (assignmentId) => {
    if (!assignmentId || assignments.value.length === 0) {
      return
    }

    const assignment = assignments.value.find((item) => item.id === assignmentId)
    if (assignment) {
      await selectAssignment(assignment)
    }
  }
)

watch(
  () => route.query.examId,
  (examId) => {
    if (!examId || exams.value.length === 0) {
      return
    }

    const exam = exams.value.find((item) => item.id === examId)
    if (exam) {
      form.value.examId = exam.id
      form.value.title = form.value.title || exam.title
    }
  }
)

onMounted(loadData)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Assignments</p>
      <h1>班级任务</h1>
      <p>把已有试卷发布给班级，并查看学生提交情况。</p>
    </section>

    <section v-if="!isTeacher" class="profile-empty-card">
      <h2>当前账号不能访问教师任务</h2>
      <p>请使用教师账号登录。</p>
    </section>

    <section v-else class="profile-section">
      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="api-success">
        {{ successMessage }}
      </div>

      <div class="profile-card">
        <div>
          <p class="tag">Publish</p>
          <h2>发布考试任务</h2>
          <p>第一轮先从已有试卷中选择，发布给一个班级。</p>
        </div>

        <div class="profile-actions">
          <RouterLink class="secondary-btn" to="/teacher">
            返回工作台
          </RouterLink>

          <RouterLink class="secondary-btn" to="/teacher/classrooms">
            管理班级
          </RouterLink>
        </div>
      </div>

      <div class="learning-overview-card">
        <label>
          班级
          <select v-model="form.classroomId">
            <option value="">请选择班级</option>
            <option
              v-for="classroom in classrooms"
              :key="classroom.id"
              :value="classroom.id"
            >
              {{ classroom.name }}
            </option>
          </select>
        </label>

        <label>
          试卷
          <select v-model="form.examId">
            <option value="">请选择试卷</option>
            <option
              v-for="exam in exams"
              :key="exam.id"
              :value="exam.id"
            >
              {{ exam.title }}
            </option>
          </select>
        </label>

        <div v-if="selectedExam" class="api-success">
          当前试卷：{{ selectedExam.title }}｜
          {{ selectedExam.questionCount || 0 }} 题｜
          {{ selectedExam.materialCount || 0 }} 组材料
          <RouterLink
            class="secondary-btn"
            :to="`/teacher/exams/${selectedExam.id}/edit`"
          >
            编辑这份试卷
          </RouterLink>
        </div>

        <label>
          任务标题
          <input v-model="form.title" type="text" placeholder="默认使用试卷标题" />
        </label>

        <label>
          任务说明
          <textarea v-model="form.description" placeholder="可填写任务说明"></textarea>
        </label>

        <label>
          截止时间
          <input v-model="form.dueAt" type="datetime-local" />
        </label>

        <button
          class="primary-btn"
          :disabled="isSubmitting"
          @click="handleCreateAssignment"
        >
          {{ isSubmitting ? '发布中……' : '发布任务' }}
        </button>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>我的试卷</h2>
        </div>

        <div v-if="exams.length > 0" class="attempt-list">
          <article
            v-for="exam in exams"
            :key="exam.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ exam.title }}</h3>
              <p>
                {{ exam.sourceType || 'TEACHER_CUSTOM' }}｜
                {{ exam.visibility || 'PRIVATE' }}｜
                {{ exam.publishStatus || (exam.isPublished ? 'PUBLISHED' : 'READY') }}
              </p>
              <p>题目 {{ exam.questionCount || 0 }} 道｜材料 {{ exam.materialCount || 0 }} 组</p>
            </div>

            <div class="profile-actions">
              <button class="secondary-btn" @click="form.examId = exam.id">
                选择发布
              </button>

              <RouterLink
                class="secondary-btn"
                :to="`/teacher/exams/${exam.id}/edit`"
              >
                编辑
              </RouterLink>
            </div>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无教师自建试卷，可先从导入草稿确认入库。
        </p>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>已发布任务</h2>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载任务……
        </div>

        <div v-else-if="assignments.length > 0" class="attempt-list">
          <article
            v-for="assignment in assignments"
            :key="assignment.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ assignment.title }}</h3>
              <p>{{ assignment.classroomName }}｜{{ assignment.examTitle }}</p>
              <p>状态：{{ assignment.status }}｜提交 {{ assignment.submissionCount }} 人</p>
            </div>

            <button class="secondary-btn" @click="selectAssignment(assignment)">
              查看提交
            </button>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无任务。
        </p>
      </div>

      <div v-if="selectedAssignment" class="learning-overview-card">
        <div class="section-title-row">
          <div>
            <h2>{{ selectedAssignment.title }} 任务分析</h2>
            <p>{{ selectedAssignment.classroomName }}｜{{ selectedAssignment.examTitle }}</p>
          </div>
        </div>

        <div v-if="selectedAnalytics?.summary" class="attempt-list">
          <article class="attempt-card">
            <div>
              <h3>班级人数</h3>
              <p>{{ selectedAnalytics.summary.classSize }} 人</p>
            </div>
          </article>

          <article class="attempt-card">
            <div>
              <h3>提交情况</h3>
              <p>
                已提交 {{ selectedAnalytics.summary.submittedCount }} 人｜
                未提交 {{ selectedAnalytics.summary.notSubmittedCount }} 人｜
                提交率 {{ formatPercent(selectedAnalytics.summary.submissionRate) }}
              </p>
            </div>
          </article>

          <article class="attempt-card">
            <div>
              <h3>成绩概览</h3>
              <p>
                平均分 {{ formatScore(selectedAnalytics.summary.averageScore) }}｜
                最高 {{ formatScore(selectedAnalytics.summary.highestScore) }}｜
                最低 {{ formatScore(selectedAnalytics.summary.lowestScore) }}
              </p>
            </div>
          </article>

          <article class="attempt-card">
            <div>
              <h3>及格情况</h3>
              <p>
                及格线 {{ formatScore(selectedAnalytics.summary.passLine) }}｜
                及格率 {{ formatPercent(selectedAnalytics.summary.passRate) }}
              </p>
            </div>
          </article>
        </div>

        <div v-if="selectedAnalytics?.basicOverview" class="api-success">
          <strong>基础学情概览：</strong>
          {{ selectedAnalytics.basicOverview.overallSummary }}
          <p
            v-for="note in selectedAnalytics.basicOverview.notes"
            :key="note"
          >
            {{ note }}
          </p>
        </div>

        <div v-if="submissions.length > 0" class="type-stat-table-wrap">
          <h3>学生提交表</h3>
          <table class="type-stat-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>状态</th>
                <th>得分</th>
                <th>正确率</th>
                <th>正确/错误</th>
                <th>用时</th>
                <th>提交时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="submission in submissions" :key="submission.studentId">
                <td>{{ submission.nickname || submission.username }}</td>
                <td>{{ submission.status === 'SUBMITTED' ? '已提交' : '未提交' }}</td>
                <td>
                  <template v-if="submission.status === 'SUBMITTED'">
                    {{ submission.totalScore }} / {{ submission.examTotalScore }}
                  </template>
                  <template v-else>暂无</template>
                </td>
                <td>
                  {{ formatPercent(submission.accuracyRate) }}
                </td>
                <td>
                  {{ submission.status === 'SUBMITTED' ? `${submission.correctCount} / ${submission.wrongCount}` : '暂无' }}
                </td>
                <td>
                  {{ formatUsedTime(submission.usedTime) }}
                </td>
                <td>
                  {{ formatDateTime(submission.submittedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-text">
          暂无学生。
        </p>

        <div
          v-if="selectedAnalytics?.questionStats?.length"
          class="type-stat-table-wrap"
        >
          <h3>题目正确率表</h3>
          <table class="type-stat-table">
            <thead>
              <tr>
                <th>题号</th>
                <th>题型</th>
                <th>分值</th>
                <th>正确答案</th>
                <th>作答人数</th>
                <th>正确/错误</th>
                <th>正确率</th>
                <th>常见错误</th>
                <th>高频错题</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="question in selectedAnalytics.questionStats"
                :key="question.questionId"
              >
                <td>{{ question.orderIndex }}</td>
                <td>{{ questionTypeNameMap[question.type] || question.type }}</td>
                <td>{{ formatScore(question.score) }}</td>
                <td>{{ question.manual_or_subjective ? '主观/人工判断' : question.correctAnswer }}</td>
                <td>{{ question.answeredCount }}</td>
                <td>
                  {{ question.manual_or_subjective ? 'manual_or_subjective' : `${question.correctCount} / ${question.wrongCount}` }}
                </td>
                <td>
                  {{ question.manual_or_subjective ? '主观题暂不统计' : formatPercent(question.correctRate) }}
                </td>
                <td>
                  <template v-if="question.commonWrongAnswers?.length">
                    {{ question.commonWrongAnswers.map((item) => `${item.answer}(${item.count})`).join('、') }}
                  </template>
                  <template v-else>暂无</template>
                </td>
                <td>{{ question.isHighFrequencyWrong ? '是' : '否' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="selectedAnalytics?.typeStats?.length"
          class="type-stat-table-wrap"
        >
          <h3>题型表现表</h3>
          <table class="type-stat-table">
            <thead>
              <tr>
                <th>题型</th>
                <th>题目数</th>
                <th>总分值</th>
                <th>班级平均得分</th>
                <th>得分率</th>
                <th>错误率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="typeStat in selectedAnalytics.typeStats" :key="typeStat.type">
                <td>{{ questionTypeNameMap[typeStat.type] || typeStat.type }}</td>
                <td>{{ typeStat.questionCount }}</td>
                <td>{{ formatScore(typeStat.totalScore) }}</td>
                <td>{{ formatScore(typeStat.classAverageScore) }}</td>
                <td>{{ formatPercent(typeStat.scoreRate) }}</td>
                <td>{{ formatPercent(typeStat.errorRate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="selectedAnalytics?.basicOverview?.priorityReviewQuestions?.length"
          class="api-warning"
        >
          <strong>建议优先讲评：</strong>
          第
          {{ selectedAnalytics.basicOverview.priorityReviewQuestions.map((question) => question.orderIndex).join('、') }}
          题。
        </div>
      </div>
    </section>
  </div>
</template>
