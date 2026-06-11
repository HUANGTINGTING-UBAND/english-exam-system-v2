<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { getSavedUser } from '../api/authApi'
import {
  createExamMaterial,
  createExamQuestion,
  deleteExamMaterial,
  deleteExamQuestion,
  getEditableExam,
  updateEditableExam,
  updateExamMaterial,
  updateExamQuestion,
} from '../api/examApi'
import { examCategoryNameMap, examCategoryOptions } from '../utils/examCategories'

const route = useRoute()
const currentUser = ref(getSavedUser())
const exam = ref(null)
const isLoading = ref(false)
const isSavingExam = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const materialForm = ref(null)
const questionForm = ref(null)

const examId = computed(() => route.params.examId)
const isAdmin = computed(() => currentUser.value?.role === 'ADMIN')
const isTeacher = computed(() => currentUser.value?.role === 'TEACHER')

const backPath = computed(() => {
  return isAdmin.value ? '/admin' : '/teacher/assignments'
})

const previewPath = computed(() => {
  return `/exam/${examId.value}?preview=1`
})

const publishPath = computed(() => {
  return `/teacher/assignments?examId=${examId.value}`
})

const form = ref({
  title: '',
  description: '',
  gradeLevel: 'GENERAL',
  timeLimit: 3600,
  sourceType: 'PLATFORM_STANDARD',
  visibility: 'PUBLIC',
  publishStatus: 'READY',
  diagnosisQuality: 'BASIC',
})

const sourceTypeNameMap = {
  PLATFORM_STANDARD: '平台标准',
  TEACHER_CUSTOM: '教师自建',
}

const visibilityNameMap = {
  PUBLIC: '公开',
  PRIVATE: '私有',
  CLASS_ONLY: '仅班级',
}

const publishStatusNameMap = {
  DRAFT: '草稿',
  READY: '待发布',
  PUBLISHED: '已发布',
  ARCHIVED: '已归档',
}

const diagnosisQualityNameMap = {
  BASIC: '基础',
  STANDARD: '标准',
  DETAILED: '详细',
}

const materialTypeNameMap = {
  READING: '阅读材料',
  LISTENING: '听力材料',
  CLOZE: '完形材料',
  OTHER: '其他材料',
}

const questionTypeNameMap = {
  CHOICE: '选择题',
  TRANSLATION: '翻译题',
  ERROR_CORRECTION: '改错题',
  WRITING: '写作题',
  READING: '阅读理解',
  CLOZE: '完形填空',
}

const formattedTotalScore = computed(() => {
  const value = Number(exam.value?.totalScore || 0)
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
})

const canPublishToClass = computed(() => {
  return isTeacher.value && exam.value?.sourceType === 'TEACHER_CUSTOM'
})

const syncForm = () => {
  if (!exam.value) {
    return
  }

  form.value = {
    title: exam.value.title || '',
    description: exam.value.description || '',
    gradeLevel: exam.value.gradeLevel || 'GENERAL',
    timeLimit: exam.value.timeLimit || 3600,
    sourceType: exam.value.sourceType || 'PLATFORM_STANDARD',
    visibility: exam.value.visibility || 'PUBLIC',
    publishStatus: exam.value.publishStatus || (exam.value.isPublished ? 'PUBLISHED' : 'READY'),
    diagnosisQuality: exam.value.diagnosisQuality || 'BASIC',
  }
}

const loadExam = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    exam.value = await getEditableExam(examId.value)
    syncForm()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式试卷编辑详情加载失败'
  } finally {
    isLoading.value = false
  }
}

const saveExam = async () => {
  isSavingExam.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    exam.value = await updateEditableExam(examId.value, {
      title: form.value.title,
      description: form.value.description,
      gradeLevel: form.value.gradeLevel,
      timeLimit: form.value.timeLimit,
      sourceType: form.value.sourceType,
      visibility: form.value.visibility,
      publishStatus: form.value.publishStatus,
      diagnosisQuality: form.value.diagnosisQuality,
    })
    syncForm()
    successMessage.value = '试卷信息已保存'
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式试卷保存失败'
  } finally {
    isSavingExam.value = false
  }
}

const getMaterialTitle = (materialId) => {
  const material = exam.value?.materials?.find((item) => item.id === materialId)
  return material?.title || (material ? `材料 ${material.orderIndex}` : '未绑定材料')
}

const startCreateMaterial = () => {
  const nextOrderIndex = (exam.value?.materials?.length || 0) + 1

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
  if (!materialForm.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  const payload = {
    type: materialForm.value.type,
    title: materialForm.value.title,
    content: materialForm.value.content,
    audioUrl: materialForm.value.audioUrl,
    transcript: materialForm.value.transcript,
    orderIndex: materialForm.value.orderIndex,
  }

  try {
    if (materialForm.value.isNew) {
      await createExamMaterial(examId.value, payload)
    } else {
      await updateExamMaterial(examId.value, materialForm.value.id, payload)
    }

    successMessage.value = materialForm.value.isNew ? '正式材料已新增' : '正式材料已保存'
    materialForm.value = null
    await loadExam()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式材料保存失败'
  }
}

const deleteMaterial = async (material) => {
  const boundQuestionCount = material._count?.questions || material.questionCount || 0
  const materialTitle = material.title || `材料 ${material.orderIndex}`

  if (boundQuestionCount > 0) {
    window.alert(`材料「${materialTitle}」已有 ${boundQuestionCount} 道题绑定，请先调整题目绑定后再删除。`)
    return
  }

  const confirmed = window.confirm(`确认删除材料「${materialTitle}」吗？此操作不可恢复。`)

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteExamMaterial(examId.value, material.id)
    successMessage.value = '正式材料已删除'
    await loadExam()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式材料删除失败'
  }
}

const startCreateQuestion = () => {
  const nextOrderIndex = (exam.value?.questions?.length || 0) + 1

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
    materialId: question.materialId || '',
    optionsText: Array.isArray(question.options) ? question.options.join('\n') : '',
    answerText:
      question.answer === null || question.answer === undefined
        ? ''
        : String(question.answer),
  }
}

const saveQuestion = async () => {
  if (!questionForm.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

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

  try {
    if (questionForm.value.isNew) {
      await createExamQuestion(examId.value, payload)
    } else {
      await updateExamQuestion(examId.value, questionForm.value.id, payload)
    }

    successMessage.value = questionForm.value.isNew ? '正式题目已新增' : '正式题目已保存'
    questionForm.value = null
    await loadExam()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式题目保存失败'
  }
}

const deleteQuestion = async (question) => {
  const confirmed = window.confirm(`确认删除第 ${question.orderIndex} 题吗？如果该题已有历史作答，后端会阻止删除。`)

  if (!confirmed) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    await deleteExamQuestion(examId.value, question.id)
    successMessage.value = '正式题目已删除'
    await loadExam()
  } catch (error) {
    console.error(error)
    errorMessage.value = error.message || '正式题目删除失败'
  }
}

onMounted(loadExam)
</script>

<template>
  <div class="profile-page">
    <section class="profile-hero">
      <p class="tag">Exam Editor</p>
      <h1>正式试卷编辑</h1>
      <p>维护正式试卷信息、材料、题目，并在发布前预览考试效果。</p>
    </section>

    <section class="profile-section">
      <div v-if="errorMessage" class="api-warning">
        {{ errorMessage }}
      </div>

      <div v-if="successMessage" class="api-success">
        {{ successMessage }}
      </div>

      <div class="profile-card">
        <div>
          <p class="tag">Current</p>
          <h2>{{ exam?.title || '正在加载试卷' }}</h2>
          <p v-if="exam">
            题目 {{ exam.questionCount }} 道，材料 {{ exam.materialCount }} 组，满分 {{ formattedTotalScore }} 分。
          </p>
        </div>

        <div class="profile-actions">
          <RouterLink class="secondary-btn" :to="backPath">
            返回
          </RouterLink>

          <RouterLink v-if="exam" class="secondary-btn" :to="previewPath">
            预览考试效果
          </RouterLink>

          <RouterLink
            v-if="canPublishToClass"
            class="primary-btn"
            :to="publishPath"
          >
            去发布到班级
          </RouterLink>
        </div>
      </div>

      <div v-if="isLoading" class="loading-box">
        正在加载正式试卷……
      </div>

      <template v-if="exam">
        <div class="learning-overview-card">
          <div class="section-title-row">
            <div>
              <h2>试卷信息</h2>
              <p class="section-subtitle">
                导入草稿：{{ exam.importJobId ? `是（${exam.importJobTitle || exam.importJobId}）` : '否' }}｜
                创建者：{{ exam.creatorName || exam.creatorRole || '系统/旧数据' }}
              </p>
            </div>
          </div>

          <label>
            试卷标题
            <input v-model="form.title" type="text" />
          </label>

          <label>
            试卷说明
            <textarea v-model="form.description" rows="3"></textarea>
          </label>

          <label>
            试卷分类
            <select v-model="form.gradeLevel">
              <optgroup
                v-for="group in examCategoryOptions"
                :key="group.group"
                :label="group.group"
              >
                <option
                  v-for="option in group.options"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </optgroup>
            </select>
          </label>

          <label>
            考试时长（秒）
            <input v-model.number="form.timeLimit" type="number" min="60" />
          </label>

          <label>
            试卷来源
            <select v-model="form.sourceType" :disabled="isTeacher">
              <option value="PLATFORM_STANDARD">平台标准</option>
              <option value="TEACHER_CUSTOM">教师自建</option>
            </select>
          </label>

          <label>
            可见范围
            <select v-model="form.visibility">
              <option v-if="isAdmin" value="PUBLIC">公开</option>
              <option value="PRIVATE">私有</option>
              <option value="CLASS_ONLY">仅班级</option>
            </select>
          </label>

          <label>
            发布状态
            <select v-model="form.publishStatus">
              <option value="DRAFT">草稿</option>
              <option value="READY">待发布</option>
              <option value="PUBLISHED">已发布</option>
              <option value="ARCHIVED">已归档</option>
            </select>
          </label>

          <label>
            诊断质量等级
            <select v-model="form.diagnosisQuality">
              <option value="BASIC">基础</option>
              <option value="STANDARD">标准</option>
              <option value="DETAILED">详细</option>
            </select>
          </label>

          <div class="admin-exam-meta">
            <span>来源：{{ sourceTypeNameMap[form.sourceType] }}</span>
            <span>可见范围：{{ visibilityNameMap[form.visibility] }}</span>
            <span>发布状态：{{ publishStatusNameMap[form.publishStatus] }}</span>
            <span>诊断质量：{{ diagnosisQualityNameMap[form.diagnosisQuality] }}</span>
            <span>分类：{{ examCategoryNameMap[form.gradeLevel] || form.gradeLevel }}</span>
          </div>

          <button
            class="primary-btn"
            :disabled="isSavingExam"
            @click="saveExam"
          >
            {{ isSavingExam ? '保存中……' : '保存试卷信息' }}
          </button>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <div>
              <h2>正式材料</h2>
              <p class="section-subtitle">阅读、听力等材料可被多道题共享，一篇材料只显示一次。</p>
            </div>

            <button class="secondary-btn" @click="startCreateMaterial">
              新增材料
            </button>
          </div>

          <div v-if="exam.materials?.length" class="attempt-list">
            <article
              v-for="material in exam.materials"
              :key="material.id"
              class="attempt-card"
            >
              <div>
                <h3>{{ material.title || `材料 ${material.orderIndex}` }}</h3>
                <p>
                  {{ materialTypeNameMap[material.type] || material.type }}｜
                  排序 {{ material.orderIndex }}｜
                  绑定 {{ material._count?.questions || 0 }} 题
                </p>
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

          <p v-else class="empty-text">
            暂无正式材料。
          </p>

          <div v-if="materialForm" class="learning-overview-card">
            <h3>{{ materialForm.isNew ? '新增正式材料' : '编辑正式材料' }}</h3>

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
              <textarea v-model="materialForm.content" rows="5"></textarea>
            </label>

            <label>
              音频地址
              <input v-model="materialForm.audioUrl" type="text" />
            </label>

            <label>
              听力原文
              <textarea v-model="materialForm.transcript" rows="4"></textarea>
            </label>

            <label>
              排序
              <input v-model.number="materialForm.orderIndex" type="number" min="1" />
            </label>

            <div class="edit-question-actions">
              <button class="primary-btn" @click="saveMaterial">
                {{ materialForm.isNew ? '新增材料' : '保存材料' }}
              </button>

              <button class="secondary-btn" @click="materialForm = null">
                取消
              </button>
            </div>
          </div>
        </div>

        <div class="learning-overview-card">
          <div class="section-title-row">
            <div>
              <h2>正式题目</h2>
              <p class="section-subtitle">可维护题干、选项、答案、解析、分值、知识点和材料绑定。</p>
            </div>

            <button class="secondary-btn" @click="startCreateQuestion">
              新增题目
            </button>
          </div>

          <div v-if="exam.questions?.length" class="attempt-list">
            <article
              v-for="question in exam.questions"
              :key="question.id"
              class="attempt-card"
            >
              <div>
                <h3>第 {{ question.orderIndex }} 题</h3>
                <p>{{ question.text || '暂无题干' }}</p>
                <p>
                  题型：{{ questionTypeNameMap[question.type] || question.type }}｜
                  分值：{{ question.score }}｜
                  知识点：{{ question.knowledgePoint || '未分类' }}
                </p>
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

          <p v-else class="empty-text">
            暂无正式题目。
          </p>

          <div v-if="questionForm" class="learning-overview-card">
            <h3>{{ questionForm.isNew ? '新增正式题目' : '编辑正式题目' }}</h3>

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
                  v-for="material in exam.materials"
                  :key="material.id"
                  :value="material.id"
                >
                  {{ material.title || `材料 ${material.orderIndex}` }}
                </option>
              </select>
            </label>

            <label>
              题干
              <textarea v-model="questionForm.text" rows="4"></textarea>
            </label>

            <label>
              选项（一行一个）
              <textarea v-model="questionForm.optionsText" rows="4"></textarea>
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
              <textarea v-model="questionForm.referenceAnswer" rows="3"></textarea>
            </label>

            <label>
              解析
              <textarea v-model="questionForm.explanation" rows="3"></textarea>
            </label>

            <div class="edit-question-actions">
              <button class="primary-btn" @click="saveQuestion">
                {{ questionForm.isNew ? '新增题目' : '保存题目' }}
              </button>

              <button class="secondary-btn" @click="questionForm = null">
                取消
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>
