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

  if (to.meta.requiresAuth && !currentUser) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (to.meta.requiresAdmin && currentUser?.role !== 'ADMIN') {
    window.alert('你没有管理员权限，已返回个人中心。')

    return {
      path: '/profile',
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
