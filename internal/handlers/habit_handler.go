package handlers

import (
	"errors"
	"net/http"
	"strings"

	"glance/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// HabitHandler 习惯打卡相关接口.
// 习惯（Habit）与打卡记录（HabitCheck）为一对多，
// 打卡通过 (habit_id, date) 唯一索引保证同一天不重复.
type HabitHandler struct {
	db *gorm.DB
}

func NewHabitHandler(db *gorm.DB) *HabitHandler {
	return &HabitHandler{db: db}
}

// GetHabits 获取全部习惯（含各自打卡记录）.
// GET /api/habits
func (h *HabitHandler) GetHabits(c *gin.Context) {
	var habits []models.Habit
	// Preload 一次性带出 checks，避免 N+1 查询
	if err := h.db.Preload("Checks").Order("id ASC").Find(&habits).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch habits")
		return
	}
	// 没有打卡记录时 GORM 得到的是 nil 切片（JSON 序列化为 null），
	// 统一成空数组，保证前端 h.checks.map 始终可用
	for i := range habits {
		if habits[i].Checks == nil {
			habits[i].Checks = []models.HabitCheck{}
		}
	}
	success(c, habits)
}

// CreateHabit 新建习惯.
// POST /api/habits  body: {"name": "...", "color": "#ef4444"}
func (h *HabitHandler) CreateHabit(c *gin.Context) {
	var body struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	name := strings.TrimSpace(body.Name)
	if name == "" {
		failed(c, http.StatusBadRequest, "name is required")
		return
	}

	habit := models.Habit{
		Name:  name,
		Color: strings.TrimSpace(body.Color),
	}
	if err := h.db.Create(&habit).Error; err != nil {
		// unique 约束冲突 → 同名习惯已存在
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			failed(c, http.StatusConflict, "habit name already exists")
			return
		}
		failed(c, http.StatusInternalServerError, "failed to create habit")
		return
	}

	success(c, habit)
}

// DeleteHabit 删除习惯（级联删除其全部打卡记录）.
// DELETE /api/habits/:id
func (h *HabitHandler) DeleteHabit(c *gin.Context) {
	id := c.Param("id")
	result := h.db.Delete(&models.Habit{}, id)
	if result.Error != nil {
		failed(c, http.StatusInternalServerError, "failed to delete habit")
		return
	}
	if result.RowsAffected == 0 {
		failed(c, http.StatusNotFound, "habit not found")
		return
	}
	success(c, gin.H{"id": id})
}

// ToggleCheck 切换某天打卡状态：已打卡则删除记录，未打卡则插入.
// PUT /api/habits/:id/toggle  body: {"date": "YYYY-MM-DD"}
// 返回 {"checked": bool} 表示切换后的最新状态.
func (h *HabitHandler) ToggleCheck(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Date string `json:"date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}
	date := strings.TrimSpace(body.Date)
	if date == "" {
		failed(c, http.StatusBadRequest, "date is required")
		return
	}

	// 先确认习惯存在，避免对不存在的 habit 写入孤立记录
	var habit models.Habit
	if err := h.db.First(&habit, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			failed(c, http.StatusNotFound, "habit not found")
			return
		}
		failed(c, http.StatusInternalServerError, "failed to fetch habit")
		return
	}

	// 查现有打卡记录
	var existing models.HabitCheck
	err := h.db.Where("habit_id = ? AND date = ?", habit.ID, date).First(&existing).Error
	if err == nil {
		// 已打卡 → 取消
		if delErr := h.db.Delete(&existing).Error; delErr != nil {
			failed(c, http.StatusInternalServerError, "failed to uncheck habit")
			return
		}
		success(c, gin.H{"checked": false})
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		failed(c, http.StatusInternalServerError, "failed to query check")
		return
	}

	// 未打卡 → 新增（唯一索引兜底并发同天重复）
	check := models.HabitCheck{HabitID: habit.ID, Date: date}
	if err := h.db.Create(&check).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to check habit")
		return
	}
	success(c, gin.H{"checked": true})
}
