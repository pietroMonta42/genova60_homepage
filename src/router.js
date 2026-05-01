import { createRouter, createWebHistory } from 'vue-router'
import Home from './views/Home.vue'
import Torneo from './views/Torneo.vue'
import TorneoPartite from './views/TorneoPartite.vue'
import TorneoAdmin from './views/TorneoAdmin.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/torneo',
    name: 'Torneo',
    component: Torneo
  },
  {
    path: '/torneo/partite',
    name: 'TorneoPartite',
    component: TorneoPartite
  },
  {
    path: '/torneo/admin',
    name: 'TorneoAdmin',
    component: TorneoAdmin
  },
  {
    path: '/torneo/admin/calendario',
    name: 'TorneoAdminCalendario',
    component: () => import('./views/TorneoAdminCalendario.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
