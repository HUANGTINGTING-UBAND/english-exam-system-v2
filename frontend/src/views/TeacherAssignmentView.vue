<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import { getExams } from '../api/examApi'
import {
  createTeacherAssignment,
  getTeacherAssignmentSubmissions,
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

    if (!form.value.examId && exams.value[0]) {
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
  errorMessage.value = ''

  try {
    const result = await getTeacherAssignmentSubmissions(assignment.id)
    selectedAssignment.value = result.assignment
    submissions.value = result.submissions
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '提交情况加载失败'
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
            <h2>{{ selectedAssignment.title }} 提交情况</h2>
            <p>{{ selectedAssignment.classroomName }}｜{{ selectedAssignment.examTitle }}</p>
          </div>
        </div>

        <div v-if="submissions.length > 0" class="type-stat-table-wrap">
          <table class="type-stat-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>状态</th>
                <th>得分</th>
                <th>正确率</th>
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
                  {{ submission.accuracyRate === null ? '暂无' : `${submission.accuracyRate}%` }}
                </td>
                <td>
                  {{ submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : '暂无' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-else class="empty-text">
          暂无学生。
        </p>
      </div>
    </section>
  </div>
</template>
