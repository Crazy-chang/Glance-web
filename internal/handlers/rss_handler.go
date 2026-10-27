package handlers

import (
	"context"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"glance/internal/models"
	"glance/internal/services"
)

// urlCleaner 去掉 URL 首尾的空格、反引号、引号、尖括号、换行符。
var urlCleaner = regexp.MustCompile(`^[\s\x60"'<>\n\r]+|[\s\x60"'<>\n\r]+$`)

// cleanURL 清理 URL。
func cleanURL(s string) string {
	return strings.TrimSpace(urlCleaner.ReplaceAllString(s, ""))
}

// RSSHandler 处理 RSS 订阅源和文章 HTTP 请求.
type RSSHandler struct {
	db     *gorm.DB
	rssSvc *services.RSSService
}

// NewRSSHandler 创建一个新的处理 RSS 订阅源和文章 HTTP 请求的处理程序.
func NewRSSHandler(db *gorm.DB) *RSSHandler {
	return &RSSHandler{
		db:     db,
		rssSvc: services.NewRSSService(db),
	}
}

// GetFeeds 获取所有 RSS 订阅源，包含未读文章数量.
// GET /api/rss/feeds
func (h *RSSHandler) GetFeeds(c *gin.Context) {
	var feeds []models.RSSFeed
	// 先按置顶时间降序排，置顶时间相同再按创建时间降序排序
	if err := h.db.Order("pinned_at DESC, created_at DESC").Find(&feeds).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch feeds")
		return
	}

	type feedWithUnread struct {
		models.RSSFeed
		UnreadCount int `json:"unreadCount"`
	}

	var result []feedWithUnread
	for _, feed := range feeds {
		var unreadCount int64
		h.db.Model(&models.RSSArticle{}).
			Where("feed_id = ? AND is_read = ?", feed.ID, false).
			Count(&unreadCount)

		result = append(result, feedWithUnread{
			RSSFeed:     feed,
			UnreadCount: int(unreadCount),
		})
	}

	success(c, result)
}

// ValidateFeed 验证 RSS 订阅源 URL.
// POST /api/rss/validate  body: {"url": "https://..."}
func (h *RSSHandler) ValidateFeed(c *gin.Context) {
	var body struct {
		URL string `json:"url"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if body.URL == "" {
		failed(c, http.StatusBadRequest, "url is required")
		return
	}
	body.URL = cleanURL(body.URL)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	feed, err := h.rssSvc.ValidateFeedURL(ctx, body.URL)
	if err != nil {
		failed(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	success(c, gin.H{
		"title":       feed.Title,
		"description": feed.Description,
		"itemCount":   len(feed.Items),
	})
}

// CreateFeed 创建一个新的 RSS 订阅源.
// POST /api/rss/feeds  body: {"name": "...", "url": "...", "category": "..."}
func (h *RSSHandler) CreateFeed(c *gin.Context) {
	var feed models.RSSFeed
	if err := c.ShouldBindJSON(&feed); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if feed.URL == "" {
		failed(c, http.StatusBadRequest, "url is required")
		return
	}
	feed.URL = cleanURL(feed.URL)

	// 名称为空时，自动从 RSS 源获取标题
	if feed.Name == "" {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
		if validated, err := h.rssSvc.ValidateFeedURL(ctx, feed.URL); err == nil && validated.Title != "" {
			feed.Name = validated.Title
		} else {
			feed.Name = "未命名订阅"
		}
		cancel()
	}

	if feed.Category == "" {
		feed.Category = "news"
	}

	feed.Active = true

	// 新增订阅时默认置顶（排在列表最前）
	now := time.Now()
	feed.PinnedAt = &now

	if err := h.db.Create(&feed).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to create feed")
		return
	}

	// 同步抓取一次文章：返回时未读数即为真实值，避免前端首屏拿到 0.
	// 抓取失败不阻断订阅创建（订阅本身已入库），仅记录日志，等下一轮定时任务补齐.
	ctx, cancel := context.WithTimeout(c.Request.Context(), 25*time.Second)
	defer cancel()

	count, err := h.rssSvc.FetchAndSaveArticles(ctx, feed.ID, feed.URL)
	if err != nil {
		log.Printf("[rss] initial fetch for %s failed: %v", feed.Name, err)
	}
	log.Printf("[rss] initial fetch for %s: %d new articles", feed.Name, count)

	var unreadCount int64
	h.db.Model(&models.RSSArticle{}).
		Where("feed_id = ? AND is_read = ?", feed.ID, false).
		Count(&unreadCount)

	success(c, gin.H{
		"feed":         feed,
		"articleCount": count,
		"unreadCount":  int(unreadCount),
	})
}

// GetUnreadCounts 返回所有订阅源的未读文章数（轻量接口，一条 GROUP BY 查询）.
// GET /api/rss/unread-counts
func (h *RSSHandler) GetUnreadCounts(c *gin.Context) {
	type rowCount struct {
		FeedID uint  `json:"feedId"`
		Count  int64 `json:"count"`
	}

	var rows []rowCount
	if err := h.db.Model(&models.RSSArticle{}).
		Select("feed_id, COUNT(*) as count").
		Where("is_read = ?", false).
		Group("feed_id").
		Find(&rows).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to count unread")
		return
	}

	counts := make(map[uint]int, len(rows))
	for _, r := range rows {
		counts[r.FeedID] = int(r.Count)
	}

	success(c, counts)
}

// RefreshFeed 触发立即刷新单个订阅源.
// POST /api/rss/feeds/:id/refresh
func (h *RSSHandler) RefreshFeed(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var feed models.RSSFeed
	if err := h.db.First(&feed, id).Error; err != nil {
		failed(c, http.StatusNotFound, "feed not found")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	count, err := h.rssSvc.FetchAndSaveArticles(ctx, feed.ID, feed.URL)
	if err != nil {
		failed(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	success(c, gin.H{
		"feedId":   feed.ID,
		"newCount": count,
		"feedName": feed.Name,
	})
}

// RefreshAllFeeds 会立即刷新所有活动的订阅源.
// POST /api/rss/feeds/refresh
func (h *RSSHandler) RefreshAllFeeds(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	count, err := h.rssSvc.RefreshAllFeeds(ctx)
	if err != nil {
		failed(c, http.StatusInternalServerError, err.Error())
		return
	}

	success(c, gin.H{
		"newCount": count,
	})
}

// UpdateFeed 更新一个存在的 RSS 订阅源的详细信息.
// PUT /api/rss/feeds/:id
func (h *RSSHandler) UpdateFeed(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var feed models.RSSFeed
	if err := h.db.First(&feed, id).Error; err != nil {
		failed(c, http.StatusNotFound, "feed not found")
		return
	}

	if err := c.ShouldBindJSON(&feed); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	// 校验文章上限：0 表示跟随全局，否则必须在 50-500 之间
	if feed.MaxArticles < 0 || feed.MaxArticles > 500 || (feed.MaxArticles > 0 && feed.MaxArticles < 50) {
		failed(c, http.StatusBadRequest, "文章上限应在 50-500 之间")
		return
	}

	if err := h.db.Save(&feed).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update feed")
		return
	}

	success(c, feed)
}

// DeleteFeed 删除一个存在的 RSS 订阅源，包括其所有文章.
// DELETE /api/rss/feeds/:id
func (h *RSSHandler) DeleteFeed(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	// Delete articles first.
	h.db.Where("feed_id = ?", id).Delete(&models.RSSArticle{})

	if err := h.db.Delete(&models.RSSFeed{}, id).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to delete feed")
		return
	}

	success(c, gin.H{"id": id})
}

// GetArticles 获取文章列表（不含正文，点击时单独拉详情）.
// GET /api/rss/articles?feedId=1&readFilter=unread&q=关键词
func (h *RSSHandler) GetArticles(c *gin.Context) {
	// 获取对应表的查询对象
	baseQuery := h.db.Model(&models.RSSArticle{})

	// 搜索模式：有 q 参数时搜全部文章，不按 feed 筛选
	if q := c.Query("q"); q != "" {
		like := "%" + q + "%"
		baseQuery = baseQuery.Where("title LIKE ? OR content LIKE ?", like, like)
	} else if feedID := c.Query("feedId"); feedID != "" {
		// 非搜索模式才按 feed 筛选
		baseQuery = baseQuery.Where("feed_id = ?", feedID)
	}

	// 今日零点（本地时区），用于「今日」筛选与计数
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// 统计未读/已读/总数/今日数
	var unreadCount, readCount, totalCount, todayCount int64
	baseQuery.Session(&gorm.Session{}).Count(&totalCount)
	baseQuery.Session(&gorm.Session{}).Where("is_read = ?", false).Count(&unreadCount)
	baseQuery.Session(&gorm.Session{}).Where("is_read = ?", true).Count(&readCount)
	baseQuery.Session(&gorm.Session{}).Where("published_at >= ?", startOfDay).Count(&todayCount)

	// 应用 readFilter 过滤
	query := baseQuery
	readFilter := c.Query("readFilter")
	switch readFilter {
	case "unread":
		query = query.Where("is_read = ?", false)
	case "read":
		query = query.Where("is_read = ?", true)
	case "today":
		query = query.Where("published_at >= ?", startOfDay)
	}

	// 默认按发布时间倒序；只在"已读"列表里改用阅读时间倒序
	orderClause := "published_at DESC"
	if readFilter == "read" {
		orderClause = "read_at DESC"
	}

	// 不再 Limit，返回全部；用 Select 排除 content 字段
	var articles []models.RSSArticle
	if err := query.
		Select("id, feed_id, title, link, description, published_at, is_read, is_starred, created_at").
		Order(orderClause).
		Find(&articles).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch articles")
		return
	}

	success(c, gin.H{
		"list":        articles,
		"unreadCount": unreadCount,
		"readCount":   readCount,
		"totalCount":  totalCount,
		"todayCount":  todayCount,
	})
}

// GetArticle 获取单篇文章详情（含完整正文）.
// GET /api/rss/articles/:id
func (h *RSSHandler) GetArticle(c *gin.Context) {
	id := c.Param("id")

	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var article models.RSSArticle
	if err := h.db.First(&article, id).Error; err != nil {
		failed(c, http.StatusNotFound, "article not found")
		return
	}

	success(c, article)
}

// MarkArticleRead 标记一篇文章为已读.
// PUT /api/rss/articles/:id/read
func (h *RSSHandler) MarkArticleRead(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.db.Model(&models.RSSArticle{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_read": true,
		"read_at": gorm.Expr("COALESCE(read_at, ?)", time.Now()),
	}).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to mark article as read")
		return
	}

	success(c, gin.H{"id": id, "isRead": true})
}

// ToggleArticleStar 切换一篇文章的收藏状态.
// PUT /api/rss/articles/:id/star
func (h *RSSHandler) ToggleArticleStar(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var article models.RSSArticle
	if err := h.db.First(&article, id).Error; err != nil {
		failed(c, http.StatusNotFound, "article not found")
		return
	}

	article.IsStarred = !article.IsStarred
	if err := h.db.Save(&article).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update article")
		return
	}

	success(c, gin.H{"id": id, "isStarred": article.IsStarred})
}

// TogglePinFeed 置顶订阅源.
// PUT /api/rss/feeds/:id/pin
func (h *RSSHandler) TogglePinFeed(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var feed models.RSSFeed // 获取订阅源详情

	// 检查订阅源是否存在，若不存在则返回错误，若存在则把订阅源详情赋值给 feed 变量
	if err := h.db.First(&feed, id).Error; err != nil {
		failed(c, http.StatusNotFound, "feed not found")
		return
	}

	now := time.Now()
	feed.PinnedAt = &now
	// 更新订阅源详情，保存到数据库中
	if err := h.db.Save(&feed).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update feed")
		return
	}

	// 返回更新后的订阅源详情
	success(c, gin.H{"isPinned": feed.PinnedAt != nil})
}
