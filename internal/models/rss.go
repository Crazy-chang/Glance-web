package models

import "time"

// RSSFeed 存储一个 RSS 源订阅源.
type RSSFeed struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"title"`    // 订阅源名称
	URL       string    `json:"url"`      // RSS 地址
	Category  string    `json:"category"` // news / research / blog
	Active    bool      `json:"active"`   // 是否启用
	PinnedAt  *time.Time `json:"pinnedAt"` // 置顶时间（用于排序，新增/置顶的排最前）
	MaxArticles int        `json:"maxArticles"` // 最大文章数（0 表示跟随全局）
	LastError  string     `json:"lastError" gorm:"default:''"` // 最近一次抓取错误（空=正常）
	CreatedAt time.Time `json:"createdAt"` // 创建时间
}

// RSSArticle 存储从 RSS 源获取的单篇文章.
type RSSArticle struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	FeedID      uint      `json:"feedId" gorm:"index"` // 关联 RSSFeed ID
	Title       string    `json:"title"`               // 文章标题
	Link        string    `json:"link"`                // 文章链接
	Description string    `json:"description"`         // 纯文本摘要（列表用，≤500字）
	Content     string    `json:"content" gorm:"type:text"` // 完整 HTML 正文（阅读区用）
	PublishedAt time.Time `json:"publishedAt"`         // 发布时间
	IsRead      bool      `json:"read"`               // 是否已读
	IsStarred   bool      `json:"starred"`            // 是否收藏
	CreatedAt   time.Time `json:"createdAt"`
}
