import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardPage from '@/pages/DashboardPage.vue'
import ProjectPage from '@/pages/ProjectPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
      meta: { title: 'Dashboard Geral' }
    },
    {
      path: '/project/:id',
      name: 'project',
      component: ProjectPage,
      meta: { title: 'Detalhes do Projeto' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsPage,
      meta: { title: 'Configurações' }
    }
  ]
})
