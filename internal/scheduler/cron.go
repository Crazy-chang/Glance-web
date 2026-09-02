// Package scheduler 管理 RSS 订阅源的定期刷新任务.
package scheduler

import (
	"context"
	"log"
	"strconv"
	"time"

	"gorm.io/gorm"

	"glance/internal/models"
	"glance/internal/services"
)

// 调度器通过 goroutine 循环定期刷新 RSS 订阅源.
// 不用 robfig/cron 了：cron 的 @every 注册后无法动态改间隔，
// goroutine + Sleep 每轮从 DB 读最新的 refreshInterval，改设置后下轮生效.
type Scheduler struct {
	db     *gorm.DB
	rssSvc *services.RSSService
	stopCh chan struct{}
}

func New(db *gorm.DB) *Scheduler {
	return &Scheduler{
		db:     db,
		rssSvc: services.NewRSSService(db),
		stopCh: make(chan struct{}),
	}
}

// Start 启动调度器 goroutine.
func (s *Scheduler) Start() {
	go s.loop()
	log.Println("[scheduler] started (RSS refresh interval configurable, default 15m)")
}

// Stop 停止调度器.
func (s *Scheduler) Stop() {
	close(s.stopCh)
	log.Println("[scheduler] stopped")
}

// TriggerInitialFetch 在启动时立即刷新 RSS.
func (s *Scheduler) TriggerInitialFetch() {
	go s.fetchRSSFeeds()
}

// loop 主循环：抓取 → 读间隔 → 等待 → 重复.
// 每轮从 DB 读 interval，设置改了不用重启服务.
func (s *Scheduler) loop() {
	s.fetchRSSFeeds()

	for {
		interval := s.getRefreshInterval()
		select {
		case <-s.stopCh:
			return
		case <-time.After(interval):
		}
		s.fetchRSSFeeds()
	}
}

// getRefreshInterval 从系统设置读取刷新间隔，默认 15 分钟.
func (s *Scheduler) getRefreshInterval() time.Duration {
	var setting models.SystemSetting
	if err := s.db.Where("key = ?", "refreshInterval").First(&setting).Error; err == nil {
		if n, err := strconv.Atoi(setting.Value); err == nil && n >= 5 {
			return time.Duration(n) * time.Minute
		}
	}
	return 15 * time.Minute
}

// fetchRSSFeeds 获取所有活跃 RSS 订阅源的文章.
func (s *Scheduler) fetchRSSFeeds() {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	count, err := s.rssSvc.RefreshAllFeeds(ctx)
	if err != nil {
		log.Printf("[scheduler] RSS feed refresh failed: %v", err)
		return
	}
	log.Printf("[scheduler] RSS refresh complete: %d new articles", count)
}
