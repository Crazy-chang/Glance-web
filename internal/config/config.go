// Package config defines the application configuration structure
// and loads values from environment variables with sensible defaults.
package config

import (
	"os"
	"strconv"
)

// Config holds all application configuration values.
type Config struct {
	// DBPath is the SQLite database file path.
	DBPath string

	// Port 是 HTTP 服务器端口号。
	Port int

	// GinMode 控制 Gin 的行为模式：debug、release、test。
	GinMode string

	// 基本认证可选凭据；当两者都不为空时，所有路由均启用HTTP基本认证
	BasicAuthUser string
	BasicAuthPass string
}

// Load 从环境变量中加载配置，若不存在则返回默认值。
func Load() *Config {
	return &Config{
		DBPath:        getEnv("DB_PATH", "./data/dashboard.db"),
		Port:          getEnvInt("PORT", 8080),
		GinMode:       getEnv("GIN_MODE", "debug"),
		BasicAuthUser: getEnv("AUTH_USER", ""),
		BasicAuthPass: getEnv("AUTH_PASS", ""),
	}
}

// getEnv 从环境变量中读取字符串值，若不存在则返回默认值。
func getEnv(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

// getEnvInt 从环境变量中读取整数值值，若不存在则返回默认值。
func getEnvInt(key string, defaultValue int) int {
	if val := os.Getenv(key); val != "" {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultValue
}
