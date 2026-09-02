package handlers

import (
	"fmt"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"glance/internal/models"
)

// SystemHandler 处理系统状态的 HTTP 请求.
type SystemHandler struct {
	db *gorm.DB
}

// NewSystemHandler 使用给定的 GORM DB 创建一个新的 SystemHandler 实例。
func NewSystemHandler(db *gorm.DB) *SystemHandler {
	return &SystemHandler{db: db}
}

// GetStatus 获取当前系统状态，包括数据库健康、Go 版本和运行时指标。
// GET /api/system/status
func (h *SystemHandler) GetStatus(c *gin.Context) {
	sqlDB, err := h.db.DB()
	if err != nil {
		failed(c, http.StatusInternalServerError, "failed to get database connection")
		return
	}

	var dbStatus string
	if err := sqlDB.Ping(); err != nil {
		dbStatus = "error"
	} else {
		dbStatus = "ok"
	}

	success(c, gin.H{
		"status":     "running",
		"dbStatus":   dbStatus,
		"goVersion":  runtime.Version(),
		"goroutines": runtime.NumGoroutine(),
		"timestamp":  time.Now(),
	})
}

// GetSettings 获取系统设置.
// GET /api/system/settings
func (h *SystemHandler) GetSettings(c *gin.Context) {
	var settings []models.SystemSetting
	h.db.Find(&settings)

	// 转成 map 方便前端读
	result := gin.H{}
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	// maxArticlesPerFeed 默认 500
	if result["maxArticlesPerFeed"] == nil {
		result["maxArticlesPerFeed"] = "500"
	}

	// refreshInterval 默认 15（分钟）
	if result["refreshInterval"] == nil {
		result["refreshInterval"] = "15"
	}

	success(c, result)
}

// UpdateSettings 更新系统设置.
// PUT /api/system/settings  body: {"maxArticlesPerFeed": 500, "refreshInterval": 15}
func (h *SystemHandler) UpdateSettings(c *gin.Context) {
	var body map[string]interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	// 遍历 body 里的每个 key-value，写入数据库
	for key, val := range body {
		strVal := fmt.Sprintf("%v", val)

		// refreshInterval 校验：5-360 分钟
		if key == "refreshInterval" {
			if n, err := strconv.Atoi(strVal); err != nil || n < 5 || n > 360 {
				failed(c, http.StatusBadRequest, "refreshInterval must be 5-360 minutes")
				return
			}
		}

		// Upsert：存在就更新，不存在就创建
		h.db.Where("key = ?", key).
			Assign(models.SystemSetting{Value: strVal}).
			FirstOrCreate(&models.SystemSetting{Key: key, Value: strVal})

		// 如果是 maxArticlesPerFeed，同步批量更新所有 feed 的 MaxArticles
		if key == "maxArticlesPerFeed" {
			if n, err := strconv.Atoi(strVal); err == nil && n >= 50 && n <= 500 {
				h.db.Model(&models.RSSFeed{}).
					Where("1 = 1").
					Update("max_articles", n)
			}
		}
	}

	// 返回更新后的设置
	var settings []models.SystemSetting
	h.db.Find(&settings)
	result := gin.H{}
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	if result["maxArticlesPerFeed"] == nil {
		result["maxArticlesPerFeed"] = "500"
	}
	if result["refreshInterval"] == nil {
		result["refreshInterval"] = "15"
	}

	success(c, result)
}
