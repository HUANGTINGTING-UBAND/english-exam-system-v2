<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  confirmImportJob,
  createImportJob,
  getImportJob,
  getImportJobs,
  resolveImportWarning,
  updateImportDraftMaterial,
  updateImportDraftQuestion,
} from '../api/platformApi'

const router = useRouter()
const currentUser = ref(getSavedUser())
const jobs = ref([])
const selectedJob = ref(null)
const selectedFile = ref(null)
const isLoading = ref(false)
const isSubmitting = ref(false)
const isConfirming = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  title: '',
  gradeLevel: '',
  sourceType: 'manual',
  rawText: '',
})

const confirmForm = ref({
  title: '',
  gradeLevel: '',
  timeLimit: 3600,
  isPublished: true,
})

const questionForm = ref(null)
const materialForm = ref(null)

const canManageDrafts = computed(() => {
  return ['TEACHER', 'ADMIN'].includes(currentUser.value?.role)
})

const unresolvedWarnings = computed(() => {
  return selectedJob.value?.warnings?.filter((warning) => !warning.isResolved) || []
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

const reloadSelectedJob = async () => {
  if (!selectedJob.value?.id) {
    return
  }

  selectedJob.value = await getImportJob(selectedJob.value.id)
}

const handleFileChange = (event) => {
  selectedFile.value = event.target.files?.[0] || null
}

const handleCreateJob = async () => {
  if (!selectedFile.value && !form.value.rawText.trim()) {
    errorMessage.value = '请上传 TXT/DOCX/PDF 文件，或粘贴原始文本'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const created = await createImportJob({
      title: form.value.title || selectedFile.value?.name || '未命名导入草稿',
      gradeLevel: form.value.gradeLevel || null,
      sourceType: selectedFile.value ? 'file' : form.value.sourceType,
      rawText: form.value.rawText,
      file: selectedFile.value,
    })

    successMessage.value = '导入草稿创建成功，可开始人工校对'
    form.value.title = ''
    form.value.gradeLevel = ''
    form.value.rawText = ''
    selectedFile.value = null
    selectedJob.value = await getImportJob(created.id)
    confirmForm.value.title = selectedJob.value.title
    confirmForm.value.gradeLevel = selectedJob.value.gradeLevel || ''
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
  successMessage.value = ''
  questionForm.value = null
  materialForm.value = null

  try {
    selectedJob.value = await getImportJob(job.id)
    confirmForm.value.title = selectedJob.value.title
    confirmForm.value.gradeLevel = selectedJob.value.gradeLevel || ''
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿详情加载失败'
  }
}

const startEditQuestion = (question) => {
  questionForm.value = {
    ...question,
    optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
    answerText:
      question.answer === null || question.answer === undefined
        ? ''
        : String(question.answer),
  }
}

const saveQuestion = async () => {
  if (!selectedJob.value?.id || !questionForm.value?.id) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const options = questionForm.value.optionsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    await updateImportDraftQuestion(selectedJob.value.id, questionForm.value.id, {
      materialId: questionForm.value.materialId || null,
      type: questionForm.value.type,
      text: questionForm.value.text,
      options: options.length > 0 ? options : null,
      answer: questionForm.value.answerText,
      score: questionForm.value.score,
      knowledgePoint: questionForm.value.knowledgePoint,
      referenceAnswer: questionForm.value.referenceAnswer,
      explanation: questionForm.value.explanation,
      orderIndex: questionForm.value.orderIndex,
    })

    successMessage.value = '草稿题目已保存'
    questionForm.value = null
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿题目保存失败'
  }
}

const startEditMaterial = (material) => {
  materialForm.value = {
    ...material,
  }
}

const saveMaterial = async () => {
  if (!selectedJob.value?.id || !materialForm.value?.id) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await updateImportDraftMaterial(selectedJob.value.id, materialForm.value.id, {
      type: materialForm.value.type,
      title: materialForm.value.title,
      content: materialForm.value.content,
      audioUrl: materialForm.value.audioUrl,
      transcript: materialForm.value.transcript,
      orderIndex: materialForm.value.orderIndex,
    })

    successMessage.value = '草稿材料已保存'
    materialForm.value = null
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿材料保存失败'
  }
}

const handleResolveWarning = async (warning) => {
  if (!selectedJob.value?.id) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await resolveImportWarning(selectedJob.value.id, warning.id)
    successMessage.value = 'Warning 已标记为处理'
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || 'Warning 处理失败'
  }
}

const handleConfirmImport = async () => {
  if (!selectedJob.value?.id) {
    return
  }

  const confirmed = window.confirm(
    `确认将导入草稿《${selectedJob.value.title}》生成正式试卷吗？`
  )

  if (!confirmed) {
    return
  }

  isConfirming.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const result = await confirmImportJob(selectedJob.value.id, {
      title: confirmForm.value.title || selectedJob.value.title,
      gradeLevel: confirmForm.value.gradeLevel || selectedJob.value.gradeLevel,
      timeLimit: confirmForm.value.timeLimit,
      isPublished:
        currentUser.value.role === 'ADMIN'
          ? confirmForm.value.isPublished
          : false,
    })

    successMessage.value = `正式试卷已生成，共 ${result.questionCount} 题`
    await loadJobs()
    router.push(`/exam/${result.examId}`)
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '确认入库失败'
  } finally {
    isConfirming.value = false
  }
}

onMounted(loadJobs)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Import Draft</p>
      <h1>导入草稿校对</h1>
      <p>上传非标准试卷，先生成可编辑草稿，人工校对后再确认入库为正式试卷。</p>
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
          <p>支持 TXT、DOCX、文字型 PDF。解析不确定处会生成 warning。</p>
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
          上传文件
          <input type="file" accept=".txt,.docx,.pdf" @change="handleFileChange" />
        </label>

        <label>
          或粘贴原始文本
          <textarea
            v-model="form.rawText"
            placeholder="支持题号、A/B/C/D 选项和答案区的基础规则解析"
          ></textarea>
        </label>

        <button
          class="primary-btn"
          :disabled="isSubmitting"
          @click="handleCreateJob"
        >
          {{ isSubmitting ? '解析中……' : '创建并解析草稿' }}
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
              校对
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
            <p>状态：{{ selectedJob.status }}｜未处理 warning：{{ unresolvedWarnings.length }}</p>
          </div>
        </div>

        <div class="profile-card">
          <div>
            <p class="tag">Confirm</p>
            <h2>确认入库</h2>
            <p>确认后会生成正式 Exam、QuestionMaterial 和 Question。</p>
          </div>

          <div class="profile-actions">
            <button
              class="primary-btn"
              :disabled="isConfirming"
              @click="handleConfirmImport"
            >
              {{ isConfirming ? '入库中……' : '确认入库' }}
            </button>
          </div>
        </div>

        <label>
          正式试卷标题
          <input v-model="confirmForm.title" type="text" />
        </label>

        <label>
          正式试卷分类
          <select v-model="confirmForm.gradeLevel">
            <option value="GENERAL">通用</option>
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
          考试时长（秒）
          <input v-model.number="confirmForm.timeLimit" type="number" min="60" />
        </label>

        <label v-if="currentUser.role === 'ADMIN'">
          <input v-model="confirmForm.isPublished" type="checkbox" />
          管理员入库后发布到公开试卷列表
        </label>

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
            <button class="secondary-btn" @click="startEditMaterial(material)">
              编辑材料
            </button>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿材料。</p>

        <div v-if="materialForm" class="learning-overview-card">
          <h3>编辑材料</h3>
          <label>
            类型
            <select v-model="materialForm.type">
              <option value="READING">阅读</option>
              <option value="LISTENING">听力</option>
              <option value="CLOZE">完形</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          <label>
            标题
            <input v-model="materialForm.title" type="text" />
          </label>
          <label>
            内容
            <textarea v-model="materialForm.content"></textarea>
          </label>
          <label>
            听力原文
            <textarea v-model="materialForm.transcript"></textarea>
          </label>
          <button class="primary-btn" @click="saveMaterial">保存材料</button>
        </div>

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
              <p>题型：{{ question.type }}｜分值：{{ question.score ?? '默认' }}｜知识点：{{ question.knowledgePoint || '未分类' }}</p>
              <p v-if="question.materialId">已绑定材料</p>
            </div>
            <button class="secondary-btn" @click="startEditQuestion(question)">
              编辑题目
            </button>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿题目。</p>

        <div v-if="questionForm" class="learning-overview-card">
          <h3>编辑题目</h3>
          <label>
            题型
            <select v-model="questionForm.type">
              <option value="CHOICE">选择题</option>
              <option value="TRANSLATION">翻译题</option>
              <option value="ERROR_CORRECTION">改错题</option>
              <option value="WRITING">写作题</option>
              <option value="READING">阅读理解</option>
              <option value="CLOZE">完形填空</option>
            </select>
          </label>
          <label>
            绑定材料
            <select v-model="questionForm.materialId">
              <option value="">不绑定材料</option>
              <option
                v-for="material in selectedJob.draftMaterials"
                :key="material.id"
                :value="material.id"
              >
                {{ material.title || `材料 ${material.orderIndex}` }}
              </option>
            </select>
          </label>
          <label>
            题干
            <textarea v-model="questionForm.text"></textarea>
          </label>
          <label>
            选项（一行一个）
            <textarea v-model="questionForm.optionsText"></textarea>
          </label>
          <label>
            答案
            <input v-model="questionForm.answerText" type="text" placeholder="选择题可填 A/B/C/D 或 0/1/2/3" />
          </label>
          <label>
            分值
            <input v-model.number="questionForm.score" type="number" min="0" />
          </label>
          <label>
            知识点
            <input v-model="questionForm.knowledgePoint" type="text" />
          </label>
          <label>
            参考答案
            <textarea v-model="questionForm.referenceAnswer"></textarea>
          </label>
          <label>
            解析
            <textarea v-model="questionForm.explanation"></textarea>
          </label>
          <button class="primary-btn" @click="saveQuestion">保存题目</button>
        </div>

        <h3>Warnings</h3>
        <div v-if="selectedJob.warnings?.length" class="attempt-list">
          <article
            v-for="warning in selectedJob.warnings"
            :key="warning.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ warning.isResolved ? '已处理' : warning.level }}</h3>
              <p>{{ warning.message }}</p>
              <p v-if="warning.field">字段：{{ warning.field }}</p>
            </div>
            <button
              v-if="!warning.isResolved"
              class="secondary-btn"
              @click="handleResolveWarning(warning)"
            >
              标记已处理
            </button>
          </article>
        </div>
        <p v-else class="empty-text">暂无 warning。</p>
      </div>
    </section>
  </div>
</template>
