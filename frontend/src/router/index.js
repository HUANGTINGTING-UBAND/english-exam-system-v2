import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ExamListView from '../views/ExamListView.vue'
import ExamView from '../views/ExamView.vue'
import ProfileView from '../views/ProfileView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import AdminView from '../views/AdminView.vue'
import AttemptDetailView from '../views/AttemptDetailView.vue'
import WrongPracticeView from '../views/WrongPracticeView.vue'
import AdminAttemptsView from '../views/AdminAttemptsView.vue'
import TeacherDashboardView from '../views/TeacherDashboardView.vue'
import TeacherClassroomsView from '../views/TeacherClassroomsView.vue'
import TeacherAssignmentView from '../views/TeacherAssignmentView.vue'
import StudentAssignmentsView from '../views/StudentAssignmentsView.vue'
import ImportDraftView from '../views/ImportDraftView.vue'
import SkillManageView from '../views/SkillManageView.vue'
import ExamEditView from '../views/ExamEditView.vue'
import StudentAttemptReportView from '../views/StudentAttemptReportView.vue'
import { getSavedUser } from '../api/authApi'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/exams',
    name: 'exams',
    component: ExamListView,
  },
  {
    path: '/exam/:examId',
    name: 'exam-detail',
    component: ExamView,
  },
  {
    path: '/assignments/:assignmentId/exam/:examId',
    name: 'assignment-exam',
    component: ExamView,
    meta: {
      requiresAuth: true,
      roles: ['STUDENT'],
    },
  },
  {
    path: '/student/assignments',
    name: 'student-assignments',
    component: StudentAssignmentsView,
    meta: {
      requiresAuth: true,
      roles: ['STUDENT'],
    },
  },
  {
    path: '/student/attempts/:attemptId/report',
    name: 'student-attempt-report',
    component: StudentAttemptReportView,
    meta: {
      requiresAuth: true,
      roles: ['STUDENT'],
    },
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/attempts/:attemptId',
    name: 'attempt-detail',
    component: AttemptDetailView,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/wrong-practice/:wrongQuestionId',
    name: 'wrong-practice',
    component: WrongPracticeView,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/attempts',
    name: 'admin-attempts',
    component: AdminAttemptsView,
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
    },
  },
  {
    path: '/admin/exams/:examId/edit',
    name: 'admin-exam-edit',
    component: ExamEditView,
    meta: {
      requiresAuth: true,
      roles: ['ADMIN'],
    },
  },
  {
    path: '/teacher',
    name: 'teacher-dashboard',
    component: TeacherDashboardView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER'],
    },
  },
  {
    path: '/teacher/exams/:examId/edit',
    name: 'teacher-exam-edit',
    component: ExamEditView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER'],
    },
  },
  {
    path: '/teacher/classrooms',
    name: 'teacher-classrooms',
    component: TeacherClassroomsView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER'],
    },
  },
  {
    path: '/teacher/assignments',
    name: 'teacher-assignments',
    component: TeacherAssignmentView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER'],
    },
  },
  {
    path: '/import-drafts',
    name: 'import-drafts',
    component: ImportDraftView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER', 'ADMIN'],
    },
  },
  {
    path: '/skills',
    name: 'skills',
    component: SkillManageView,
    meta: {
      requiresAuth: true,
      roles: ['TEACHER', 'ADMIN'],
    },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const currentUser = getSavedUser()
  const roleHomePath = {
    ADMIN: '/admin',
    TEACHER: '/teacher',
    STUDENT: '/profile',
  }

  if (to.meta.requiresAuth && !currentUser) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.roles && !to.meta.roles.includes(currentUser?.role)) {
    window.alert('当前账号没有权限访问该页面。')

    return {
      path: roleHomePath[currentUser?.role] || '/',
    }
  }

  if (to.meta.requiresAdmin && currentUser?.role !== 'ADMIN') {
    window.alert('你没有管理员权限，已返回个人中心。')

    return {
      path: roleHomePath[currentUser?.role] || '/profile',
    }
  }

  if ((to.path === '/login' || to.path === '/register') && currentUser) {
    return {
      path: '/profile',
    }
  }

  return true
})

window.addEventListener('auth-expired', (event) => {
  const message = event.detail?.message || '登录状态已过期，请重新登录'

  window.alert(message)

  if (router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
})

export default router
