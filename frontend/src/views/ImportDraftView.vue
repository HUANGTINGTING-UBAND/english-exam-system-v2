<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  confirmImportJob,
  createImportDraftMaterial,
  createImportDraftQuestion,
  createImportJob,
  deleteImportDraftMaterial,
  deleteImportDraftQuestion,
  getImportJob,
  getImportJobs,
  resolveImportWarning,
  updateImportDraftMaterial,
  updateImportDraftQuestion,
  validateImportJob,
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
const validateResult = ref(null)

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
  isPublished: false,
})

const questionForm = ref(null)
const materialForm = ref(null)

const canManageDrafts = computed(() => {
  return ['TEACHER', 'ADMIN'].includes(currentUser.value?.role)
})

const unresolvedWarnings = computed(() => {
  return selectedJob.value?.warnings?.filter((warning) => !warning.isResolved) || []
})

const getMaterialTitle = (materialId) => {
  const material = selectedJob.value?.draftMaterials?.find((item) => item.id === materialId)
  return material?.title || (material ? `材料 ${material.orderIndex}` : '未绑定材料')
}

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
  validateResult.value = null
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
  validateResult.value = null

  try {
    selectedJob.value = await getImportJob(job.id)
    confirmForm.value.title = selectedJob.value.title
    confirmForm.value.gradeLevel = selectedJob.value.gradeLevel || ''
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿详情加载失败'
  }
}

const startCreateQuestion = () => {
  const nextOrderIndex = (selectedJob.value?.draftQuestions?.length || 0) + 1

  questionForm.value = {
    isNew: true,
    id: '',
    materialId: '',
    type: 'CHOICE',
    text: '',
    optionsText: '',
    answerText: '',
    score: 2,
    knowledgePoint: '未分类',
    referenceAnswer: '',
    explanation: '',
    orderIndex: nextOrderIndex,
  }
}

const startEditQuestion = (question) => {
  questionForm.value = {
    ...question,
    isNew: false,
    optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
    answerText:
      question.answer === null || question.answer === undefined
        ? ''
        : String(question.answer),
  }
}

const saveQuestion = async () => {
  if (!selectedJob.value?.id || !questionForm.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const options = questionForm.value.optionsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)

    const payload = {
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
    }

    if (questionForm.value.isNew) {
      await createImportDraftQuestion(selectedJob.value.id, payload)
    } else {
      await updateImportDraftQuestion(selectedJob.value.id, questionForm.value.id, payload)
    }

    successMessage.value = questionForm.value.isNew ? '草稿题目已新增' : '草稿题目已保存'
    questionForm.value = null
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿题目保存失败'
  }
}

const deleteQuestion = async (question) => {
  if (!selectedJob.value?.id) {
    return
  }

  const confirmed = window.confirm(`确认删除第 ${question.orderIndex} 题吗？此操作不可恢复。`)

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteImportDraftQuestion(selectedJob.value.id, question.id)
    successMessage.value = '草稿题目已删除'
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿题目删除失败'
  }
}

const startCreateMaterial = () => {
  const nextOrderIndex = (selectedJob.value?.draftMaterials?.length || 0) + 1

  materialForm.value = {
    isNew: true,
    id: '',
    type: 'READING',
    title: `材料 ${nextOrderIndex}`,
    content: '',
    audioUrl: '',
    transcript: '',
    orderIndex: nextOrderIndex,
  }
}

const startEditMaterial = (material) => {
  materialForm.value = {
    ...material,
    isNew: false,
  }
}

const saveMaterial = async () => {
  if (!selectedJob.value?.id || !materialForm.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      type: materialForm.value.type,
      title: materialForm.value.title,
      content: materialForm.value.content,
      audioUrl: materialForm.value.audioUrl,
      transcript: materialForm.value.transcript,
      orderIndex: materialForm.value.orderIndex,
    }

    if (materialForm.value.isNew) {
      await createImportDraftMaterial(selectedJob.value.id, payload)
    } else {
      await updateImportDraftMaterial(selectedJob.value.id, materialForm.value.id, payload)
    }

    successMessage.value = materialForm.value.isNew ? '草稿材料已新增' : '草稿材料已保存'
    materialForm.value = null
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿材料保存失败'
  }
}

const deleteMaterial = async (material) => {
  if (!selectedJob.value?.id) {
    return
  }

  const boundQuestionCount = material._count?.questions || 0
  const message = boundQuestionCount > 0
    ? `材料「${material.title || `材料 ${material.orderIndex}`}」已有 ${boundQuestionCount} 道题绑定。请先调整题目绑定后再删除。`
    : `确认删除材料「${material.title || `材料 ${material.orderIndex}`}」吗？`

  if (boundQuestionCount > 0) {
    window.alert(message)
    return
  }

  const confirmed = window.confirm(message)

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteImportDraftMaterial(selectedJob.value.id, material.id)
    successMessage.value = '草稿材料已删除'
    await reloadSelectedJob()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '草稿材料删除失败'
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

const runValidate = async () => {
  if (!selectedJob.value?.id) {
    return null
  }

  errorMessage.value = ''

  try {
    validateResult.value = await validateImportJob(selectedJob.value.id)
    return validateResult.value
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '导入草稿质量检查失败'
    return null
  }
}

const handleConfirmImport = async () => {
  if (!selectedJob.value?.id) {
    return
  }

  const validation = await runValidate()

  if (!validation) {
    return
  }

  if (!validation.canConfirm) {
    errorMessage.value = '导入草稿存在阻塞问题，请先修复后再确认入库。'
    return
  }

  const warningText = validation.warnings?.length
    ? `\n\n仍有 ${validation.warnings.length} 条一般提示，确认继续吗？`
    : ''

  const confirmed = window.confirm(
    `确认将导入草稿《${selectedJob.value.title}》生成正式试卷吗？${warningText}`
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

    successMessage.value = `正式试卷已生成：${result.examId}，共 ${result.questionCount} 题`
    window.alert(`已生成正式试卷：${result.examId}`)
    await loadJobs()
    if (currentUser.value.role === 'TEACHER') {
      router.push(`/teacher/assignments?examId=${result.examId}`)
    } else {
      router.push('/admin')
    }
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
          <p>支持 TXT、DOCX、文字型 PDF。严格中文题块格式会优先解析，解析不确定处会生成 warning。</p>
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
            placeholder="优先支持【题目开始】/【题目结束】严格格式，也兼容题号、A/B/C/D 选项和答案区的基础规则解析"
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
              class="secondary-btn"
              :disabled="isConfirming"
              @click="runValidate"
            >
              质量检查
            </button>

            <button
              class="primary-btn"
              :disabled="isConfirming"
              @click="handleConfirmImport"
            >
              {{ isConfirming ? '入库中……' : '确认入库' }}
            </button>
          </div>
        </div>

        <div v-if="validateResult" class="learning-overview-card">
          <h3>质量检查结果</h3>
          <p>
            {{ validateResult.canConfirm ? '可以确认入库' : '存在阻塞问题，暂不能入库' }}
          </p>

          <div v-if="validateResult.errors?.length">
            <h4>阻塞问题</h4>
            <ul>
              <li v-for="item in validateResult.errors" :key="`${item.code}-${item.message}`">
                {{ item.message }}
              </li>
            </ul>
          </div>

          <div v-if="validateResult.warnings?.length">
            <h4>一般提示</h4>
            <ul>
              <li v-for="item in validateResult.warnings" :key="`${item.code}-${item.message}`">
                {{ item.message }}
              </li>
            </ul>
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
        <button class="secondary-btn" @click="startCreateMaterial">
          新增材料
        </button>
        <div v-if="selectedJob.draftMaterials?.length" class="attempt-list">
          <article
            v-for="material in selectedJob.draftMaterials"
            :key="material.id"
            class="attempt-card"
          >
            <div>
              <h3>{{ material.title || `材料 ${material.orderIndex}` }}</h3>
              <p>{{ material.type }}</p>
              <p>绑定题目：{{ material._count?.questions || 0 }} 道</p>
              <p>{{ material.content || '暂无内容' }}</p>
            </div>
            <div class="profile-actions">
              <button class="secondary-btn" @click="startEditMaterial(material)">
                编辑材料
              </button>

              <button class="danger-btn" @click="deleteMaterial(material)">
                删除材料
              </button>
            </div>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿材料。</p>

        <div v-if="materialForm" class="learning-overview-card">
          <h3>{{ materialForm.isNew ? '新增材料' : '编辑材料' }}</h3>
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
            音频地址
            <input v-model="materialForm.audioUrl" type="text" />
          </label>
          <label>
            听力原文
            <textarea v-model="materialForm.transcript"></textarea>
          </label>
          <label>
            排序
            <input v-model.number="materialForm.orderIndex" type="number" min="1" />
          </label>
          <button class="primary-btn" @click="saveMaterial">
            {{ materialForm.isNew ? '新增材料' : '保存材料' }}
          </button>
        </div>

        <h3>草稿题目</h3>
        <button class="secondary-btn" @click="startCreateQuestion">
          新增题目
        </button>
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
              <p>绑定材料：{{ getMaterialTitle(question.materialId) }}</p>
              <p v-if="Array.isArray(question.options) && question.options.length">
                选项：{{ question.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join(' / ') }}
              </p>
            </div>
            <div class="profile-actions">
              <button class="secondary-btn" @click="startEditQuestion(question)">
                编辑题目
              </button>

              <button class="danger-btn" @click="deleteQuestion(question)">
                删除题目
              </button>
            </div>
          </article>
        </div>
        <p v-else class="empty-text">暂无草稿题目。</p>

        <div v-if="questionForm" class="learning-overview-card">
          <h3>{{ questionForm.isNew ? '新增题目' : '编辑题目' }}</h3>
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
            排序 / 题号
            <input v-model.number="questionForm.orderIndex" type="number" min="1" />
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
          <button class="primary-btn" @click="saveQuestion">
            {{ questionForm.isNew ? '新增题目' : '保存题目' }}
          </button>
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
