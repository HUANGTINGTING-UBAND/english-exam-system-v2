<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  createImportJob,
  getImportJob,
  getImportJobs,
} from '../api/platformApi'

const currentUser = ref(getSavedUser())
const jobs = ref([])
const selectedJob = ref(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  title: '',
  gradeLevel: '',
  sourceType: 'manual',
  rawText: '',
})

const canManageDrafts = computed(() => {
  return ['TEACHER', 'ADMIN'].includes(currentUser.value?.role)
})

const loadJobs = async () => {
  if (!canManageDrafts.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    jobs.value = await getImportJobs()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿加载失败'
  } finally {
    isLoading.value = false
  }
}

const handleCreateJob = async () => {
  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const created = await createImportJob({
      title: form.value.title || '未命名导入草稿',
      gradeLevel: form.value.gradeLevel || null,
      sourceType: form.value.sourceType,
      rawText: form.value.rawText,
      warnings: form.value.rawText
        ? []
        : [
            {
              level: 'warning',
              field: 'rawText',
              message: '当前导入草稿暂未填写原始文本',
            },
          ],
    })

    successMessage.value = '导入草稿创建成功'
    form.value.title = ''
    form.value.gradeLevel = ''
    form.value.rawText = ''
    selectedJob.value = created
    await loadJobs()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿创建失败'
  } finally {
    isSubmitting.value = false
  }
}

const selectJob = async (job) => {
  errorMessage.value = ''

  try {
    selectedJob.value = await getImportJob(job.id)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿详情加载失败'
  }
}

onMounted(loadJobs)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Import Draft</p>
      <h1>导入草稿</h1>
      <p>第一轮先沉淀导入任务、草稿题目、草稿材料和 warning，后续再接 AI 解析与人工校对。</p>
    </section>

    <section v-if="!canManageDrafts" class="profile-empty-card">
      <h2>当前账号不能访问导入草稿</h2>
      <p>请使用教师或管理员账号登录。</p>
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
          <p class="tag">Create</p>
          <h2>创建导入草稿</h2>
          <p>本轮不做复杂 AI 拆题，只先保存导入任务和草稿数据。</p>
        </div>

        <div class="profile-actions">
          <RouterLink
            v-if="currentUser.role === 'TEACHER'"
            class="secondary-btn"
            to="/teacher"
          >
            返回教师工作台
          </RouterLink>

          <RouterLink
            v-if="currentUser.role === 'ADMIN'"
            class="secondary-btn"
            to="/admin"
          >
            返回管理后台
          </RouterLink>
        </div>
      </div>

      <div class="learning-overview-card">
        <label>
          草稿标题
          <input v-model="form.title" type="text" placeholder="例如：四级真题导入草稿" />
        </label>

        <label>
          试卷分类
          <select v-model="form.gradeLevel">
            <option value="">暂不指定</option>
            <option value="PRIMARY">小学</option>
            <option value="JUNIOR">初中</option>
            <option value="SENIOR">高中</option>
            <option value="CET4">四级</option>
            <option value="CET6">六级</option>
            <option value="IELTS">雅思</option>
            <option value="TOEFL">托福</option>
            <option value="OTHER">其他</option>
          </select>
        </label>

        <label>
          原始文本
          <textarea
            v-model="form.rawText"
            placeholder="可先粘贴非标准试卷文本，后续再解析为草稿题目"
          ></textarea>
        </label>

        <button
          class="primary-btn"
          :disabled="isSubmitting"
          @click="handleCreateJob"
        >
          {{ isSubmitting ? '创建中……' : '创建草稿' }}
        </button>
      </div>

      <div class="learning-overview-card">
        <div class="section-title-row">
          <h2>导入任务</h2>
        </div>

        <div v-if="isLoading" class="loading-box">
          正在加载导入草稿……
        </div>

        <div v-else-if="jobs.length > 0" class="attempt-list">
          <article
            v-for="job in jobs"
            :key="job.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ job.title }}</h3>
              <p>状态：{{ job.status }}｜题目 {{ job.draftQuestionCount }}｜材料 {{ job.draftMaterialCount }}｜警告 {{ job.warningCount }}</p>
              <p>创建人：{{ job.creatorName || '暂无' }}</p>
            </div>

            <button class="secondary-btn" @click="selectJob(job)">
              查看详情
            </button>
          </article>
        </div>

        <p v-else class="empty-text">
          暂无导入草稿。
        </p>
      </div>

      <div v-if="selectedJob" class="learning-overview-card">
        <div class="section-title-row">
          <div>
            <h2>{{ selectedJob.title }}</h2>
            <p>状态：{{ selectedJob.status }}｜分类：{{ selectedJob.gradeLevel || '未指定' }}</p>
          </div>
        </div>

        <h3>草稿材料</h3>
        <div v-if="selectedJob.draftMaterials?.length" class="attempt-list">
          <article
            v-for="material in selectedJob.draftMaterials"
            :key="material.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ material.title || `材料 ${material.orderIndex}` }}</h3>
              <p>{{ material.type }}</p>
              <p>{{ material.content || '暂无内容' }}</p>
            </div>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿材料。</p>

        <h3>草稿题目</h3>
        <div v-if="selectedJob.draftQuestions?.length" class="attempt-list">
          <article
            v-for="question in selectedJob.draftQuestions"
            :key="question.id"
            class="attempt-card"
          >
            <div>
              <h3>第 {{ question.orderIndex }} 题</h3>
              <p>{{ question.text || '暂无题干' }}</p>
              <p>题型：{{ question.type }}｜知识点：{{ question.knowledgePoint || '未分类' }}</p>
            </div>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿题目。</p>

        <h3>Warnings</h3>
        <div v-if="selectedJob.warnings?.length" class="attempt-list">
          <article
            v-for="warning in selectedJob.warnings"
            :key="warning.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ warning.level }}</h3>
              <p>{{ warning.message }}</p>
              <p v-if="warning.field">字段：{{ warning.field }}</p>
            </div>
          </article>
        </div>
        <p v-else class="empty-text">暂无 warning。</p>
      </div>
    </section>
  </div>
</template>
