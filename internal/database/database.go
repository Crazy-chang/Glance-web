// Package database initializes the GORM + SQLite connection,
// enables WAL mode for concurrent reads, and runs AutoMigrate
// for all registered models.
package database

import (
	"fmt"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"glance/internal/models"
)

// 初始化通过 GORM 打开 SQLite 连接，启用 WAL 模式,
// 并为所有模型运行 AutoMigrate。如果父目录不存在，则会自动创建 dbPath 的父目录
func Init(dbPath string) (*gorm.DB, error) {
	// Ensure the parent directory exists.
	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil { // ① 创建 data 目录（如果不存在）
			return nil, fmt.Errorf("failed to create database directory: %w", err)
		}
	}

	// ② 连接数据库（GORM + SQLite 驱动）
	// TranslateError: 把各驱动的唯一约束冲突等错误统一翻译成 gorm.ErrDuplicatedKey，
	// handler 才能用 errors.Is 准确识别"同名重复"并返回 409
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger:         logger.Default.LogMode(logger.Warn),
		TranslateError: true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// ③ 设置数据库参数
	// 启用 WAL 模式以获得更好的并发读取性能
	if err := db.Exec("PRAGMA journal_mode=WAL").Error; err != nil {
		return nil, fmt.Errorf("failed to enable WAL mode: %w", err)
	}

	// 启用外键约束以维护数据完整性
	if err := db.Exec("PRAGMA foreign_keys=ON").Error; err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// 写锁被占时等待（毫秒）而不是立即报 database is locked。
	// 并发刷新订阅源时（多 goroutine 同时写库）必须有这个缓冲。
	if err := db.Exec("PRAGMA busy_timeout=5000").Error; err != nil {
		return nil, fmt.Errorf("failed to set busy_timeout: %w", err)
	}

	// ④ 自动迁移所有模型（创建表、添加索引等）
	// 如果表不存在，会自动创建；如果表存在，会根据模型结构更新表结构
	if err := db.AutoMigrate(
		&models.RSSFeed{},
		&models.RSSArticle{},
		&models.MarketRecord{},
		&models.SystemSetting{},
		&models.WebLink{},
		&models.Note{},
		&models.Habit{},
		&models.HabitCheck{},
	); err != nil {
		return nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	return db, nil
}
