<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import {
  getExamById,
  getQuestionsByExamId,
  submitExamAttempt,
} from '../api/examApi'
import { getSavedUser } from '../api/authApi'


const route = useRoute()
const router = useRouter()

const isStarted = ref(false)
const isPaused = ref(false)
const isSubmitted = ref(false)
const isSubmitting = ref(false)
const currentUser = ref(getSavedUser())
const showLoginTip = ref(false)

const examData = ref(null)
const questionsData = ref([])
const isLoadingExam = ref(false)
const examErrorMessage = ref('')

const currentQuestionIndex = ref(0)
const userAnswers = ref({})
const subjectiveScores = ref({})

const remainingTime = ref(0)
const timerId = ref(null)
const submitType = ref('')

const pauseCount = ref(0)
const pauseStartedAt = ref(null)
const totalPausedDuration = ref(0)

const startedAt = ref(null)
const submittedAt = ref(null)

const examId = computed(() => route.params.examId)

const currentExam = computed(() => {
  return examData.value
})

const currentQuestions = computed(() => {
  return questionsData.value
})

const currentQuestion = computed(() => {
  return currentQuestions.value[currentQuestionIndex.value]
})

const answeredCount = computed(() => {
  return currentQuestions.value.filter((question) => {
    const answer = userAnswers.value[question.id]
    return answer !== undefined && answer !== ''
  }).length
})

const unansweredCount = computed(() => {
  return currentQuestions.value.length - answeredCount.value
})

const isCurrentQuestionAnswered = computed(() => {
  if (!currentQuestion.value) {
    return false
  }

  return isQuestionAnswered(currentQuestion.value.id)
})

const choiceQuestions = computed(() => {
  return currentQuestions.value.filter((question) => question.type === 'choice')
})

const subjectiveQuestions = computed(() => {
  return currentQuestions.value.filter((question) => question.type !== 'choice')
})

const objectiveScore = computed(() => {
  return choiceQuestions.value.reduce((total, question) => {
    const userAnswer = userAnswers.value[question.id]

    if (Number(userAnswer) === Number(question.answer)) {
      return total + Number(question.score || 0)
    }

    return total
  }, 0)
})

const correctChoiceCount = computed(() => {
  return choiceQuestions.value.filter((question) => {
    const userAnswer = userAnswers.value[question.id]
    return Number(userAnswer) === Number(question.answer)
  }).length
})

const subjectiveScore = computed(() => {
  return subjectiveQuestions.value.reduce((total, question) => {
    const score = Number(subjectiveScores.value[question.id] || 0)
    return total + score
  }, 0)
})

const totalScore = computed(() => {
  return objectiveScore.value + subjectiveScore.value
})
const realExamTotalScore = computed(() => {
  return currentQuestions.value.reduce((total, question) => {
    return total + Number(question.score || 0)
  }, 0)
})

const accuracyRate = computed(() => {
  if (choiceQuestions.value.length === 0) {
    return 0
  }

  return Math.round((correctChoiceCount.value / choiceQuestions.value.length) * 100)
})

const elapsedSeconds = computed(() => {
  if (!currentExam.value) {
    return 0
  }

  return currentExam.value.timeLimit - remainingTime.value
})

const submitTypeText = computed(() => {
  if (submitType.value === 'auto') {
    return '自动提交'
  }

  if (submitType.value === 'manual') {
    return '主动提交'
  }

  return '未提交'
})

const weakKnowledgePoints = computed(() => {
  const pointMap = {}

  currentQuestions.value.forEach((question) => {
    const pointName = question.knowledgePoint || '未分类'
    const questionScore = getQuestionScore(question)

    if (!pointMap[pointName]) {
      pointMap[pointName] = {
        name: pointName,
        totalScore: 0,
        earnedScore: 0,
      }
    }

    pointMap[pointName].totalScore += question.score
    pointMap[pointName].earnedScore += questionScore
  })

  return Object.values(pointMap)
    .map((point) => {
      const lostScore = point.totalScore - point.earnedScore
      const lossRate =
        point.totalScore === 0 ? 0 : Math.round((lostScore / point.totalScore) * 100)

      return {
        ...point,
        lostScore,
        lossRate,
      }
    })
    .sort((a, b) => b.lossRate - a.lossRate)
    .slice(0, 3)
})

const questionTypeMap = {
  choice: '单选题',
  translation: '翻译题',
  error_correction: '改错题',
  writing: '写作题',
  reading: '阅读理解',
  cloze: '完形填空',
}

const knowledgeAdviceMap = {
  动词时态: '建议复习一般现在时、一般过去时和现在完成时，整理常见不规则动词变化。',
  翻译: '建议每天练习 5 句中译英，重点关注语序、时态和固定搭配。',
  动词过去式: '建议集中复习过去时间标志词，如 yesterday、last week，并背熟常见动词过去式。',
  写作: '建议积累开头句、过渡句和结尾句，每周完成 2 篇短文训练表达结构。',
  基础词汇: '建议每天复习 10 个基础高频词，并结合图片或例句记忆。',
  'be 动词': '建议复习 am、is、are 与不同主语的搭配，并通过造句巩固。',
}

const getQuestionTypeName = (type) => {
  return questionTypeMap[type] || '未知题型'
}

const getKnowledgeAdvice = (pointName) => {
  return knowledgeAdviceMap[pointName] || '建议回看本知识点相关错题，整理错误原因，并进行专项练习。'
}

const formatTimeLimit = (seconds) => {
  return Math.round(seconds / 60)
}

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(seconds, 0)
  const minutes = Math.floor(safeSeconds / 60)
  const restSeconds = safeSeconds % 60

  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(restSeconds).padStart(2, '0')

  return `${paddedMinutes}:${paddedSeconds}`
}

const getChoiceAnswerText = (question, answerIndex) => {
  if (answerIndex === undefined || answerIndex === '') {
    return '未作答'
  }

  const optionText = question.options?.[answerIndex]

  if (!optionText) {
    return '未作答'
  }

  return `${String.fromCharCode(65 + answerIndex)}. ${optionText}`
}

const isChoiceCorrect = (question) => {
  return Number(userAnswers.value[question.id]) === Number(question.answer)
}

const getQuestionScore = (question) => {
  if (question.type === 'choice') {
    return isChoiceCorrect(question) ? question.score : 0
  }

  return Number(subjectiveScores.value[question.id] || 0)
}

const isQuestionAnswered = (questionId) => {
  const answer = userAnswers.value[questionId]
  return answer !== undefined && answer !== ''
}

const getQuestionNavClass = (question, index) => {
  return {
    active: index === currentQuestionIndex.value,
    answered: isQuestionAnswered(question.id),
    correct: isSubmitted.value && question.type === 'choice' && isChoiceCorrect(question),
    wrong: isSubmitted.value && question.type === 'choice' && !isChoiceCorrect(question),
  }
}

const getProgressStorageKey = () => {
  return `exam-progress-${examId.value}`
}

const saveProgress = () => {
  if (!currentExam.value || !isStarted.value || isSubmitted.value) {
    return
  }

  const progress = {
    examId: examId.value,
    isStarted: isStarted.value,
    isPaused: isPaused.value,
    currentQuestionIndex: currentQuestionIndex.value,
    userAnswers: userAnswers.value,
    subjectiveScores: subjectiveScores.value,
    remainingTime: remainingTime.value,
    pauseCount: pauseCount.value,
    totalPausedDuration: totalPausedDuration.value,
    startedAt: startedAt.value,
  }

  localStorage.setItem(getProgressStorageKey(), JSON.stringify(progress))
}

const clearProgress = () => {
  localStorage.removeItem(getProgressStorageKey())
}

const loadProgress = () => {
  const rawProgress = localStorage.getItem(getProgressStorageKey())

  if (!rawProgress) {
    return
  }

  const confirmed = window.confirm('检测到你有一场未完成的考试，是否继续？')

  if (!confirmed) {
    clearProgress()
    return
  }

  try {
    const progress = JSON.parse(rawProgress)

    isStarted.value = true
    isPaused.value = progress.isPaused || false
    isSubmitted.value = false
    currentQuestionIndex.value = progress.currentQuestionIndex || 0
    userAnswers.value = progress.userAnswers || {}
    subjectiveScores.value = progress.subjectiveScores || {}
    remainingTime.value = progress.remainingTime || currentExam.value?.timeLimit || 0
    pauseCount.value = progress.pauseCount || 0
    totalPausedDuration.value = progress.totalPausedDuration || 0
    startedAt.value = progress.startedAt || Date.now()

    if (!isPaused.value) {
      startTimer()
    }
  } catch (error) {
    clearProgress()
  }
}

const normalizeQuestionFromApi = (question) => {
  const typeMap = {
    CHOICE: 'choice',
    TRANSLATION: 'translation',
    ERROR_CORRECTION: 'error_correction',
    WRITING: 'writing',
    READING: 'reading',
    CLOZE: 'cloze',
  }

  return {
    ...question,
    type: typeMap[question.type] || question.type,
  }
}

const loadExamFromApi = async () => {
  isLoadingExam.value = true
  examErrorMessage.value = ''

  try {
    const [examResult, questionsResult] = await Promise.all([
      getExamById(examId.value),
      getQuestionsByExamId(examId.value),
    ])

    examData.value = {
      ...examResult,
      gradeLevel: String(examResult.gradeLevel).toLowerCase(),
    }

    questionsData.value = questionsResult.map(normalizeQuestionFromApi)
  } catch (error) {
    console.error(error)
    examErrorMessage.value = '后端考试数据暂时不可用，请检查后端服务或刷新页面重试。'
    examData.value = null
    questionsData.value = []
  } finally {
    isLoadingExam.value = false
  }
}

const stopTimer = () => {
  if (timerId.value) {
    clearInterval(timerId.value)
    timerId.value = null
  }
}

const autoSubmitExam = async () => {
  if (isSubmitted.value || isSubmitting.value) {
    return
  }

  await finalizeSubmit('auto')
}

const startTimer = () => {
  stopTimer()

  timerId.value = setInterval(() => {
    if (isPaused.value || isSubmitted.value) {
      return
    }

    if (remainingTime.value > 0) {
      remainingTime.value -= 1
    }

    if (remainingTime.value <= 0) {
      autoSubmitExam()
    }
  }, 1000)
}

const startExam = () => {
  currentUser.value = getSavedUser()

  if (!currentUser.value) {
    const confirmed = window.confirm(
      '你需要先登录才能开始考试，这样系统才能保存考试记录和错题。是否现在去登录？'
    )

    if (confirmed) {
     router.push({
       path: '/login',
       query: {
         redirect: route.fullPath,
        },
     })
   }

    return
  }

  showLoginTip.value = false
  isStarted.value = true
  isPaused.value = false
  isSubmitted.value = false
  submitType.value = ''
  currentQuestionIndex.value = 0
  userAnswers.value = {}
  subjectiveScores.value = {}
  pauseCount.value = 0
  totalPausedDuration.value = 0
  startedAt.value = Date.now()
  submittedAt.value = null
  remainingTime.value = currentExam.value?.timeLimit || 0

  startTimer()
  saveProgress()
}

const pauseExam = () => {
  if (isSubmitted.value || isPaused.value) {
    return
  }

  isPaused.value = true
  pauseCount.value += 1
  pauseStartedAt.value = Date.now()
  stopTimer()
  saveProgress()
}

const resumeExam = () => {
  if (!isPaused.value) {
    return
  }

  if (pauseStartedAt.value) {
    totalPausedDuration.value += Math.floor((Date.now() - pauseStartedAt.value) / 1000)
  }

  isPaused.value = false
  pauseStartedAt.value = null
  startTimer()
  saveProgress()
}

const goBackToPreview = () => {
  isStarted.value = false
  isPaused.value = false
  stopTimer()
  saveProgress()
}

const saveChoiceAnswer = (questionId, optionIndex) => {
  if (isSubmitted.value) {
    return
  }

  userAnswers.value[questionId] = optionIndex
  saveProgress()
}

const saveTextAnswer = (questionId, answerText) => {
  if (isSubmitted.value) {
    return
  }

  userAnswers.value[questionId] = answerText
  saveProgress()
}

const saveSubjectiveScore = (question, scoreValue) => {
  const score = Number(scoreValue)

  if (Number.isNaN(score)) {
    subjectiveScores.value[question.id] = 0
    return
  }

  if (score < 0) {
    subjectiveScores.value[question.id] = 0
    return
  }

  if (score > question.score) {
    subjectiveScores.value[question.id] = question.score
    return
  }

  subjectiveScores.value[question.id] = score
}

const goToPreviousQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value -= 1
    saveProgress()
  }
}

const goToNextQuestion = () => {
  if (currentQuestionIndex.value < currentQuestions.value.length - 1) {
    currentQuestionIndex.value += 1
    saveProgress()
  }
}

const goToQuestion = (index) => {
  currentQuestionIndex.value = index
  saveProgress()
}

const buildAttemptPayload = (type) => {
  return {
    examId: examId.value,
    objectiveScore: objectiveScore.value,
    subjectiveScore: subjectiveScore.value,
    totalScore: totalScore.value,
    accuracyRate: accuracyRate.value,
    submitType: type,
    usedTime: elapsedSeconds.value,
    pauseCount: pauseCount.value,
    totalPausedDuration: totalPausedDuration.value,
    startedAt: startedAt.value ? new Date(startedAt.value).toISOString() : null,
    submittedAt: new Date().toISOString(),
    answers: currentQuestions.value.map((question) => {
      const userAnswer = userAnswers.value[question.id]

      if (question.type === 'choice') {
        return {
          questionId: question.id,
          selectedIndex:
            userAnswer === undefined || userAnswer === ''
              ? null
              : Number(userAnswer),
          answerText: null,
          score: getQuestionScore(question),
          isCorrect: isChoiceCorrect(question),
        }
      }

      return {
        questionId: question.id,
        selectedIndex: null,
        answerText: userAnswer || '',
        score: getQuestionScore(question),
        isCorrect: null,
      }
    }),
  }
}

const finalizeSubmit = async (type) => {
  if (isSubmitting.value || isSubmitted.value) {
    return
  }

  isSubmitting.value = true
  isSubmitted.value = true
  isPaused.value = false
  submitType.value = type
  submittedAt.value = Date.now()
  stopTimer()
  clearProgress()

  try {
    const result = await submitExamAttempt(buildAttemptPayload(type))

    const attemptId = result?.attempt?.id || result?.id

    if (attemptId) {
      router.push(`/attempts/${attemptId}`)
      return
    }

    window.alert('考试结果已保存到数据库。')
  } catch (error) {
    console.error(error)

    isSubmitted.value = false
    startTimer()

    window.alert('考试保存到数据库失败，请检查后端服务后重试。')
  } finally {
    isSubmitting.value = false
  }
}


const submitExam = async () => {
  if (unansweredCount.value > 0) {
    const confirmed = window.confirm(
      `你还有 ${unansweredCount.value} 道题未作答，确认提交吗？`
    )

    if (!confirmed) {
      return
    }
  } else {
    const confirmed = window.confirm('确认提交试卷吗？提交后将不能修改答案。')

    if (!confirmed) {
      return
    }
  }

  await finalizeSubmit('manual')
}

const restartExam = () => {
  const confirmed = window.confirm('确认重新考试吗？当前答案和分数将被清空。')

  if (!confirmed) {
    return
  }

  userAnswers.value = {}
  subjectiveScores.value = {}
  currentQuestionIndex.value = 0
  isSubmitted.value = false
  isPaused.value = false
  submitType.value = ''
  pauseCount.value = 0
  totalPausedDuration.value = 0
  pauseStartedAt.value = null
  startedAt.value = Date.now()
  submittedAt.value = null
  remainingTime.value = currentExam.value?.timeLimit || 0

  startTimer()
  saveProgress()
}

watch(
  [
    userAnswers,
    subjectiveScores,
    currentQuestionIndex,
    remainingTime,
    isPaused,
    pauseCount,
    totalPausedDuration,
  ],
  () => {
    saveProgress()
  },
  { deep: true }
)

onMounted(async () => {
  await loadExamFromApi()
  loadProgress()
})

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<template>
  <div class="exam-page">
    <div v-if="examErrorMessage" class="api-warning">
     {{ examErrorMessage }}
    </div>
    <div v-if="isLoadingExam" class="loading-box">
     正在加载考试数据……
    </div>
    <div v-if="currentExam && !isStarted" class="exam-start-card">
      <p class="tag">Exam Preview</p>
      <h1>{{ currentExam.title }}</h1>
      <p class="exam-desc">{{ currentExam.description }}</p>

      <div class="exam-info-grid">
        <div class="exam-info-item">
          <span class="info-label">题目数量</span>
          <strong>{{ currentQuestions.length }} 题</strong>
        </div>

        <div class="exam-info-item">
          <span class="info-label">试卷满分</span>
          <strong>{{ realExamTotalScore || currentExam.totalScore }} 分</strong>
        </div>

        <div class="exam-info-item">
          <span class="info-label">考试时间</span>
          <strong>{{ formatTimeLimit(currentExam.timeLimit) }} 分钟</strong>
        </div>
      </div>

      <div class="exam-notice">
        <h2>考试说明</h2>
        <ul>
          <li>点击“开始考试”前，请先登录账号，系统会保存你的考试记录和错题。</li>
          <li>考试过程中可暂停，暂停时不允许继续答题。</li>
          <li>系统会暂存在本地保存答题进度，刷新后可选择继续考试。</li>
        </ul>
      </div>

      <section class="question-preview-section">
        <h2>本卷题目预览</h2>

        <div v-if="currentQuestions.length > 0" class="question-preview-list">
          <div
            v-for="(question, index) in currentQuestions"
            :key="question.id"
            class="question-preview-card"
          >
            <p class="question-index">第 {{ index + 1 }} 题</p>
            <h3>{{ question.text }}</h3>

            <div class="question-meta">
              <span>题型：{{ getQuestionTypeName(question.type) }}</span>
              <span>知识点：{{ question.knowledgePoint }}</span>
              <span>分值：{{ question.score }} 分</span>
            </div>
          </div>
        </div>

        <p v-else class="empty-text">
          当前试卷暂未配置题目。
        </p>
      </section>

      <button class="primary-btn start-exam-btn" @click="startExam">
        开始考试
      </button>

      <RouterLink class="back-link" to="/exams">
        返回试卷列表
      </RouterLink>
    </div>

    <div v-else-if="currentExam && isStarted" class="exam-answer-card">
      <div class="answer-header">
        <div>
          <p class="tag">Answering</p>
          <h1>{{ currentExam.title }}</h1>
          <p class="answer-progress">
            已答 {{ answeredCount }} / 共 {{ currentQuestions.length }} 题
          </p>
          <p class="answer-progress">
            提交方式：{{ submitTypeText }}｜暂停 {{ pauseCount }} 次｜累计暂停
            {{ formatCountdown(totalPausedDuration) }}
          </p>
          <p v-if="isSubmitted" class="answer-progress">
            用时：{{ formatCountdown(elapsedSeconds) }}
          </p>
        </div>
        
        <div v-if="showLoginTip" class="login-tip-box">
         <p>
           你当前处于游客模式。建议登录后再考试，这样考试记录和错题会保存到你的账号。
         </p>

         <div class="login-tip-actions">
           <RouterLink class="primary-btn" to="/login">
             去登录
           </RouterLink>

           <button class="secondary-btn" @click="showLoginTip = false">
             继续游客考试
           </button>
         </div>
       </div>

        <div class="timer-box">
          剩余时间：{{ formatCountdown(remainingTime) }}
        </div>

        <div class="answer-header-actions">
          <button
            v-if="!isSubmitted && !isPaused"
            class="secondary-btn"
            @click="pauseExam"
          >
            暂停考试
          </button>

          <button
            v-if="!isSubmitted && isPaused"
            class="primary-btn"
            @click="resumeExam"
          >
            继续考试
          </button>

          <button class="secondary-btn" @click="goBackToPreview">
            返回说明页
          </button>

          <button
           v-if="!isSubmitted"
           class="primary-btn"
           :disabled="isSubmitting"
           @click="submitExam"
          >
           {{ isSubmitting ? '提交中……' : '提交试卷' }}
          </button>

          <span v-else class="submitted-badge">
            已提交
          </span>
        </div>
      </div>

      <div v-if="isPaused" class="pause-overlay">
        <h2>考试已暂停</h2>
        <p>暂停期间不会继续倒计时，也不能继续答题。</p>
        <button class="primary-btn" @click="resumeExam">
          继续考试
        </button>
      </div>

      <template v-else>
        <div class="question-nav">
          <button
            v-for="(question, index) in currentQuestions"
            :key="question.id"
            class="question-nav-item"
            :class="getQuestionNavClass(question, index)"
            @click="goToQuestion(index)"
          >
            {{ index + 1 }}
          </button>
        </div>

        <div v-if="isSubmitted" class="submit-result-box">
          <div class="result-header">
            <div>
              <p class="tag">Result</p>
              <h2>考试结果</h2>
            </div>

            <span class="submitted-badge">
              已提交
            </span>
          </div>

          <p v-if="submitType === 'auto'" class="result-desc">
            考试时间已结束，系统已自动提交。系统已根据选择题自动评分，并结合主观题自评分生成当前成绩。
          </p>

          <p v-else class="result-desc">
            本次考试已完成提交，系统已根据选择题自动评分，并结合主观题自评分生成当前成绩。
          </p>

          <div class="score-summary">
            <div class="score-item score-main">
              <span>最终得分</span>
              <strong>{{ totalScore }} / {{ realExamTotalScore }}</strong>
            </div>

            <div class="score-item">
              <span>正确率</span>
              <strong>{{ accuracyRate }}%</strong>
            </div>

            <div class="score-item">
              <span>客观题得分</span>
              <strong>{{ objectiveScore }} 分</strong>
            </div>

            <div class="score-item">
              <span>主观题自评分</span>
              <strong>{{ subjectiveScore }} 分</strong>
            </div>

            <div class="score-item">
              <span>选择题正确数</span>
              <strong>{{ correctChoiceCount }} / {{ choiceQuestions.length }}</strong>
            </div>
          </div>

          <div class="weak-points-section">
            <h3>薄弱项分析</h3>

            <div v-if="weakKnowledgePoints.length > 0" class="weak-point-list">
              <div
                v-for="point in weakKnowledgePoints"
                :key="point.name"
                class="weak-point-item"
              >
                <div class="weak-point-content">
                  <strong>{{ point.name }}</strong>
                  <p>
                    得分 {{ point.earnedScore }} / {{ point.totalScore }}，
                    失分 {{ point.lostScore }} 分
                  </p>
                  <p class="advice-text">
                    建议：{{ getKnowledgeAdvice(point.name) }}
                  </p>
                </div>

                <span class="loss-rate">
                  失分率 {{ point.lossRate }}%
                </span>
              </div>
            </div>

            <p v-else class="empty-text">
              暂无薄弱项数据。
            </p>
          </div>

          <div class="result-actions">
           <button class="primary-btn" @click="restartExam">
             重新考试
           </button>

           <RouterLink class="secondary-btn" to="/profile">
             查看个人中心
           </RouterLink>

           <RouterLink class="secondary-btn" to="/exams">
             返回试卷列表
           </RouterLink>
          </div>
        </div>

        <div v-if="currentQuestion" class="answer-question-card">
          <p class="question-index">
            第 {{ currentQuestionIndex + 1 }} 题 / 共 {{ currentQuestions.length }} 题
          </p>

          <p
            class="answer-status"
            :class="{ answered: isCurrentQuestionAnswered }"
          >
            {{ isCurrentQuestionAnswered ? '当前题：已答' : '当前题：未答' }}
          </p>

          <h2>{{ currentQuestion.text }}</h2>

          <div class="question-meta">
            <span>题型：{{ getQuestionTypeName(currentQuestion.type) }}</span>
            <span>知识点：{{ currentQuestion.knowledgePoint }}</span>
            <span>分值：{{ currentQuestion.score }} 分</span>
          </div>

          <div v-if="currentQuestion.type === 'choice'" class="choice-options">
            <label
              v-for="(option, index) in currentQuestion.options"
              :key="option"
              class="choice-option"
            >
              <input
                type="radio"
                :name="currentQuestion.id"
                :checked="userAnswers[currentQuestion.id] === index"
                :disabled="isSubmitted"
                @change="saveChoiceAnswer(currentQuestion.id, index)"
              />
              <span>{{ String.fromCharCode(65 + index) }}. {{ option }}</span>
            </label>
          </div>

          <textarea
            v-else
            class="subjective-answer"
            placeholder="请在这里输入你的答案"
            :value="userAnswers[currentQuestion.id] || ''"
            :disabled="isSubmitted"
            @input="saveTextAnswer(currentQuestion.id, $event.target.value)"
          ></textarea>

          <div v-if="isSubmitted" class="question-result-box">
            <template v-if="currentQuestion.type === 'choice'">
              <p>
                <strong>你的答案：</strong>
                {{ getChoiceAnswerText(currentQuestion, userAnswers[currentQuestion.id]) }}
              </p>

              <p>
                <strong>正确答案：</strong>
                {{ getChoiceAnswerText(currentQuestion, currentQuestion.answer) }}
              </p>

              <p>
                <strong>结果：</strong>
                <span :class="isChoiceCorrect(currentQuestion) ? 'result-correct' : 'result-wrong'">
                  {{ isChoiceCorrect(currentQuestion) ? '正确' : '错误' }}
                </span>
              </p>

              <p>
                <strong>得分：</strong>
                {{ getQuestionScore(currentQuestion) }} / {{ currentQuestion.score }}
              </p>
            </template>

            <template v-else>
              <p>
                <strong>你的答案：</strong>
                {{ userAnswers[currentQuestion.id] || '未作答' }}
              </p>

              <p>
                <strong>参考答案：</strong>
                {{ currentQuestion.referenceAnswer || '暂无参考答案' }}
              </p>

              <div class="subjective-score-control">
                <label>
                  本题自评分：
                  <input
                    type="number"
                    min="0"
                    :max="currentQuestion.score"
                    :value="subjectiveScores[currentQuestion.id] || 0"
                    @input="saveSubjectiveScore(currentQuestion, $event.target.value)"
                  />
                  / {{ currentQuestion.score }} 分
                </label>
              </div>
            </template>

            <p v-if="currentQuestion.explanation">
              <strong>解析：</strong>{{ currentQuestion.explanation }}
            </p>
          </div>

          <div class="question-actions">
            <button
              class="secondary-btn"
              :disabled="currentQuestionIndex === 0"
              @click="goToPreviousQuestion"
            >
              上一题
            </button>

            <button
              class="primary-btn"
              :disabled="currentQuestionIndex === currentQuestions.length - 1"
              @click="goToNextQuestion"
            >
              下一题
            </button>
          </div>
        </div>

        <p v-else class="empty-text">
          当前试卷暂无可作答题目。
        </p>
      </template>
    </div>

    <div v-else class="page-placeholder">
      <h1>试卷不存在</h1>
      <p>没有找到 ID 为 {{ examId }} 的试卷，请返回试卷列表重新选择。</p>

      <RouterLink class="primary-btn" to="/exams">
        返回试卷列表
      </RouterLink>
    </div>
  </div>
</template>