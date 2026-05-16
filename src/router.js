import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('./views/Home.vue')
  },
  {
    path: '/torneo',
    name: 'Torneo',
    component: () => import('./views/Torneo.vue')
  },
  {
    path: '/torneo/partite',
    name: 'TorneoPartite',
    component: () => import('./views/TorneoPartite.vue')
  },
  {
    path: '/torneo/admin',
    name: 'TorneoAdmin',
    component: () => import('./views/TorneoAdmin.vue')
  },
  {
    path: '/torneo/admin/calendario',
    name: 'TorneoAdminCalendario',
    component: () => import('./views/TorneoAdminCalendario.vue')
  },
  {
    path: '/torneo/admin/reset',
    name: 'TorneoAdminReset',
    component: () => import('./views/TorneoAdminReset.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
