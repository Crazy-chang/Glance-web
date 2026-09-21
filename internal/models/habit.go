package models

import "time"

// Habit 习惯打卡项.
// 每个习惯由用户自定义（名称+颜色），打卡记录存 HabitCheck 表.
// 删除习惯时通过外键级联删除其全部打卡记录.
type Habit struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"uniqueIndex;size:50"` // 同名去重
	Color     string    `json:"color" gorm:"size:9"`             // hex，如 #ef4444
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	// 级联删除：删习惯时连带删打卡记录
	// 不加 omitempty：空切片也要序列化为 [] 而非省略字段，前端依赖 h.checks.map
	Checks []HabitCheck `json:"checks" gorm:"constraint:OnDelete:CASCADE"`
}

// HabitCheck 单次打卡记录（习惯+日期）.
// (habit_id, date) 唯一索引防止同一天重复打卡，也是 toggle 判重的依据.
type HabitCheck struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	HabitID uint   `json:"habitId" gorm:"uniqueIndex:idx_habit_date"`
	Date    string `json:"date" gorm:"uniqueIndex:idx_habit_date;size:10"` // YYYY-MM-DD
}
