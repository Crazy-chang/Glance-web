package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"
	"gorm.io/gorm"

	"glance/internal/models"
)

// urlCleaner 去掉 URL 首尾的空格、反引号、引号、尖括号、换行符。
var urlCleaner = regexp.MustCompile(`^[\s\x60"'<>\n\r]+|[\s\x60"'<>\n\r]+$`)

// RSSService 是 RSS 服务，负责获取和解析 RSS 订阅源的文章.
type RSSService struct {
	db     *gorm.DB
	parser *gofeed.Parser
	client *http.Client
}

// NewRSSService 创建一个新的 RSS 服务实例.
func NewRSSService(db *gorm.DB) *RSSService {
	return &RSSService{
		db:     db,
		parser: gofeed.NewParser(),
		client: &http.Client{
			Timeout: 30 * time.Second,
			// 禁用 keep-alive 避免某些站点 EOF
			Transport: &http.Transport{
				DisableKeepAlives: true,
			},
		},
	}
}

// browserUA 模拟真实浏览器的 User-Agent
const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ValidateFeedURL 验证一个 URL 是否为有效的 RSS/Atom 订阅地址.
// 它会请求 URL 并尝试解析它作为 RSS 源.
func (s *RSSService) ValidateFeedURL(ctx context.Context, url string) (*gofeed.Feed, error) {
	// 清理 URL：去掉首尾空格、反引号、引号、尖括号、换行
	url = strings.TrimSpace(urlCleaner.ReplaceAllString(url, ""))
	body, err := s.fetchURL(ctx, url)
	if err != nil {
		return nil, err
	}

	feed, err := s.parser.ParseString(body)
	if err != nil {
		return nil, fmt.Errorf("无法解析 RSS 源，请确认链接是否为有效的 RSS/Atom 订阅地址: %w", err)
	}

	if feed.Title == "" && len(feed.Items) == 0 {
		return nil, fmt.Errorf("RSS 源内容为空")
	}

	return feed, nil
}

// fetchURL 请求 URL 并返回响应体字符串，带有重试和完整浏览器头。
func (s *RSSService) fetchURL(ctx context.Context, url string) (string, error) {
	var lastErr error

	for attempt := 0; attempt < 2; attempt++ {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return "", fmt.Errorf("无效的 URL: %w", err)
		}

		// 完整的浏览器请求头，绕过基本反爬
		req.Header.Set("User-Agent", browserUA)
		req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, application/atom+xml, */*")
		req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
		req.Header.Set("Accept-Encoding", "identity")
		req.Header.Set("Cache-Control", "no-cache")

		resp, err := s.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("请求失败（可能网络不通或被目标站点拒绝）: %w", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("读取响应失败: %w", err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			lastErr = fmt.Errorf("目标站点返回 HTTP %d", resp.StatusCode)
			continue
		}

		return string(body), nil
	}

	return "", lastErr
}

// FetchAndSaveArticles 从单个订阅源 URL 获取文章并保存到数据库.
// 它会验证 URL 是否为有效的 RSS/Atom 订阅地址，然后解析 RSS 源并保存新文章.
func (s *RSSService) FetchAndSaveArticles(ctx context.Context, feedID uint, feedURL string) (int, error) {
	feed, err := s.ValidateFeedURL(ctx, feedURL)
	if err != nil {
		if uerr := s.db.Model(&models.RSSFeed{}).Where("id = ?", feedID).Update("last_error", err.Error()).Error; uerr != nil {
			log.Printf("[rss] failed to record last_error for feed %d: %v", feedID, uerr)
		}
		return 0, err
	}

	newCount := 0
	for _, item := range feed.Items {
		if item.Link == "" && item.GUID == "" {
			continue
		}

		link := item.Link
		if link == "" {
			link = item.GUID
		}

		// 检查是否已存在相同链接的文章
		// 如果存在，跳过
		var existing models.RSSArticle
		result := s.db.Where("feed_id = ? AND link = ?", feedID, link).First(&existing)
		if result.Error == nil {
			continue
		}

		var publishedAt time.Time
		if item.PublishedParsed != nil {
			publishedAt = *item.PublishedParsed
		} else if item.UpdatedParsed != nil {
			publishedAt = *item.UpdatedParsed
		} else {
			publishedAt = time.Now()
		}

		desc := item.Description
		if desc == "" && item.Content != "" {
			desc = item.Content
		}
		// Content 保留完整 HTML（含图片等），Description 存纯文本摘要供列表展示
		fullContent := fixLazyImages(desc)
		plainDesc := stripHTML(desc)
		if len(plainDesc) > 500 {
			plainDesc = plainDesc[:500] + "..."
		}

		article := models.RSSArticle{
			FeedID:      feedID,
			Title:       stripHTML(item.Title),
			Link:        link,
			Description: plainDesc,
			Content:     fullContent,
			PublishedAt: publishedAt,
		}

		if err := s.db.Create(&article).Error; err != nil {
			log.Printf("[rss] failed to save article %s: %v", link, err)
			continue
		}
		newCount++
	}

	// 抓取成功，清空错误状态（失败要记日志，否则感叹号会一直留在界面上）
	if uerr := s.db.Model(&models.RSSFeed{}).Where("id = ?", feedID).Update("last_error", "").Error; uerr != nil {
		log.Printf("[rss] failed to clear last_error for feed %d: %v", feedID, uerr)
	}

	// 清理超出上限文章
	var feedCfg models.RSSFeed
	s.db.First(&feedCfg, feedID)
	maxArticles := feedCfg.MaxArticles
	if maxArticles <= 0 {
		maxArticles = 500 // 兜底默认值
	}

	var total int64
	s.db.Model(&models.RSSArticle{}).Where("feed_id = ?", feedID).Count(&total)

	// 总数大于最大文章数，删除最早的文章，直到总数不超过最大文章数
	if int(total) > maxArticles {
		deleteCount := int(total) - maxArticles
		var idsToDelete []uint
		// 先用排序+限制找出要删的那些文章 ID
		s.db.Model(&models.RSSArticle{}).
			Where("feed_id = ?", feedID).            // 只查当前订阅源的文章
			Order("is_read DESC, published_at ASC"). // 先删除未读文章，再删除已读文章，按发布时间升序
			Limit(deleteCount).                      // 只取需要删除的文章数量
			Pluck("id", &idsToDelete)                // 拿到这需要删除的文章的 ID

		if len(idsToDelete) > 0 {
			// 从数据库中删除这个源的这些文章
			s.db.Where("id IN ?", idsToDelete).Delete(&models.RSSArticle{})
			log.Printf("[rss] cleaned %d old articles for feed %d", len(idsToDelete), feedID)
		}
	}

	return newCount, nil
}

// RefreshAllFeeds 会立即刷新所有活动的订阅源.
func (s *RSSService) RefreshAllFeeds(ctx context.Context) (int, error) {
	var feeds []models.RSSFeed
	if err := s.db.Where("active = ?", true).Find(&feeds).Error; err != nil {
		return 0, fmt.Errorf("failed to fetch feeds: %w", err)
	}

	type result struct {
		count int
		err   error
	}

	results := make(chan result, len(feeds))

	for _, feed := range feeds {
		go func(f models.RSSFeed) {
			count, err := s.FetchAndSaveArticles(ctx, f.ID, f.URL)
			results <- result{count: count, err: err}
		}(feed)
	}

	totalNew := 0
	for i := 0; i < len(feeds); i++ {
		r := <-results
		if r.err != nil {
			log.Printf("[rss] feed fetch error: %v", r.err)
		}
		totalNew += r.count
	}

	return totalNew, nil
}

// fixLazyImages 修正懒加载图片：将 data-src / data-original 等属性写入 src，
// 并添加 referrerpolicy="no-referrer" 防止图片被防盗链拦截。
var (
	lazyImgRe   = regexp.MustCompile(`<img\b([^>]*?)>`)
	lazySrcRe   = regexp.MustCompile(`data-(?:original|src|lazy-src|lazy)\s*=\s*["']([^"']+)["']`)
	srcRe       = regexp.MustCompile(`\s+src\s*=\s*["'][^"']*["']`)
	cleanLazyRe = regexp.MustCompile(`\s+data-(?:original|src|lazy-src|lazy)\s*=\s*["'][^"']*["']`)
	referrerRe  = regexp.MustCompile(`(?i)\breferrerpolicy\s*=`)
)

func fixLazyImages(html string) string {
	return lazyImgRe.ReplaceAllStringFunc(html, func(match string) string {
		attrs := match[4 : len(match)-1] // strip "<img" and ">"

		lazyMatch := lazySrcRe.FindStringSubmatch(attrs)
		fixed := attrs
		if lazyMatch != nil {
			fixed = srcRe.ReplaceAllString(fixed, "")
			fixed = cleanLazyRe.ReplaceAllString(fixed, "")
			fixed += ` src="` + lazyMatch[1] + `"`
		}
		if !referrerRe.MatchString(fixed) {
			fixed += ` referrerpolicy="no-referrer"`
		}
		return `<img` + fixed + `>`
	})
}

// stripHTML 移除字符串中的所有 HTML 标签.
func stripHTML(s string) string {
	var result strings.Builder
	inTag := false
	for _, r := range s {
		switch r {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				result.WriteRune(r)
			}
		}
	}
	return strings.TrimSpace(result.String())
}
