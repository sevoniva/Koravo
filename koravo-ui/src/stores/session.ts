import { defineStore } from 'pinia'

export const useSessionStore = defineStore('session', {
  state: () => ({
    tenantId: 'default',
    userId: 'admin'
  }),
  actions: {
    setTenantId(tenantId: string) {
      this.tenantId = tenantId || 'default'
    },
    setUserId(userId: string) {
      this.userId = userId || 'admin'
    }
  }
})
