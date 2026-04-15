import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/pages/DashboardPage.vue'),
      meta: { title: 'Dashboard Geral' }
    },
    {
      path: '/project/:id',
      name: 'project',
      component: () => import('@/pages/ProjectPage.vue'),
      meta: { title: 'Detalhes do Projeto' }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/pages/SettingsPage.vue'),
      meta: { title: 'Configurações' }
    }
  ]
})
