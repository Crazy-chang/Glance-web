import axios, { AxiosError } from 'axios'
import type { ApiResponse } from '@/types'

/**
 * axios 实例
 * baseURL: /api （通过 Vite proxy 代理到后端 http://localhost:8080）
 */
const client = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 统一响应拦截器
 * 后端返回格式: { code, message, data }
 * 拦截器提取 data.data 直接返回，简化调用方代码
 */
client.interceptors.response.use(
  (response) => {
    const apiResponse = response.data as ApiResponse

    // 如果返回的是标准 ApiResponse 结构，检查 code
    if (apiResponse && typeof apiResponse.code === 'number') {
      if (apiResponse.code !== 0 && apiResponse.code !== 200) {
        return Promise.reject(new Error(apiResponse.message || '请求失败'))
      }
      // 提取 data 字段
      return { ...response, data: apiResponse.data }
    }

    // 非标准结构直接返回
    return response
  },
  (error: AxiosError<{ message?: string }>) => {
    const message =
      error.response?.data?.message || error.message || '网络异常，请稍后重试'
    console.error('[API Error]', error.config?.url, message)
    return Promise.reject(new Error(message))
  },
)

export default client
