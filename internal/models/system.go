package models

// SystemSetting 系统设置（key-value 存储）.
type SystemSetting struct {
	Key   string `json:"key" gorm:"primaryKey"`
	Value string `json:"value"`
}