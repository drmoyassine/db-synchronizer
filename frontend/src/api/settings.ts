import { api } from './client'
import { RedisSettings, RedisTestResult } from '../types'

export const settingsApi = {
    getRedis: () => api.get<RedisSettings>('/api/settings/redis'),
    updateRedis: (data: Partial<RedisSettings>) => api.put<RedisSettings>('/api/settings/redis', data),
    testRedis: (data: Partial<RedisSettings>) => api.post<RedisTestResult>('/api/settings/redis/test', data),
}
