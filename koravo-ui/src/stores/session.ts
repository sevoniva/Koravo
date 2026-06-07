import { defineStore } from 'pinia'

const storageKey = 'koravo.session'

interface SessionState {
  tenantId: string
  userId: string
  requestId: string
}

function loadState(): SessionState {
  if (typeof localStorage === 'undefined') {
    return defaultState()
  }
  const raw = localStorage.getItem(storageKey)
  if (!raw) {
    return defaultState()
  }
  try {
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function defaultState(): SessionState {
  return {
    tenantId: 'default',
    userId: 'admin',
    requestId: ''
  }
}

export const useSessionStore = defineStore('session', {
  state: loadState,
  actions: {
    setTenantId(tenantId: string) {
      this.tenantId = tenantId || 'default'
      this.save()
    },
    setUserId(userId: string) {
      this.userId = userId || 'admin'
      this.save()
    },
    setRequestId(requestId: string) {
      this.requestId = requestId
      this.save()
    },
    save() {
      localStorage.setItem(storageKey, JSON.stringify({
        tenantId: this.tenantId || 'default',
        userId: this.userId || 'admin',
        requestId: this.requestId || ''
      }))
    }
  }
})
