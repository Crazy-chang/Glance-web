// Package router configures all HTTP routes and middleware,
// returning the configured Gin engine ready to serve.
package router

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"glance/internal/config"
	"glance/internal/handlers"
	"glance/internal/middleware"
)

// SetupRouter 会配置所有路由和中间件，并返回 gin 引擎.
// 它会应用 CORS 中间件，根据配置可选择性地添加 BasicAuth.
func SetupRouter(cfg *config.Config, db *gorm.DB) *gin.Engine {
	gin.SetMode(cfg.GinMode)
	r := gin.Default() // 创建引擎

	// Global middleware.
	r.Use(middleware.CORS())

	// Optional BasicAuth: only enabled when both user and pass are set.
	if cfg.BasicAuthUser != "" && cfg.BasicAuthPass != "" {
		r.Use(middleware.BasicAuth(cfg.BasicAuthUser, cfg.BasicAuthPass))
	}

	// Initialize handlers. 创建 handler 实例（传入 db 连接）
	record := handlers.NewMarketRecordHandler(db)
	rss := handlers.NewRSSHandler(db)
	system := handlers.NewSystemHandler(db)
	webLink := handlers.NewWebLinkHandler(db)

	// 把 URL 路径和 handler 方法绑定
	api := r.Group("/api")
	{
		// --- 行情记录 ---
		api.GET("/market/records", record.GetRecords)
		api.POST("/market/records", record.CreateRecord)
		api.PUT("/market/records/:id", record.UpdateRecord)
		api.DELETE("/market/records/:id", record.DeleteRecord)

		// --- RSS 订阅源 ---
		api.GET("/rss/feeds", rss.GetFeeds)
		api.POST("/rss/feeds", rss.CreateFeed)
		api.POST("/rss/feeds/refresh", rss.RefreshAllFeeds)
		api.POST("/rss/feeds/:id/refresh", rss.RefreshFeed)
		api.POST("/rss/validate", rss.ValidateFeed)
		api.PUT("/rss/feeds/:id", rss.UpdateFeed)
		api.DELETE("/rss/feeds/:id", rss.DeleteFeed)
		api.GET("/rss/unread-counts", rss.GetUnreadCounts)
		api.GET("/rss/articles", rss.GetArticles)
		api.GET("/rss/articles/:id", rss.GetArticle)
		api.PUT("/rss/articles/:id/read", rss.MarkArticleRead)
		api.PUT("/rss/articles/:id/star", rss.ToggleArticleStar)
		api.PUT("/rss/feeds/:id/pin", rss.TogglePinFeed)

		// --- Web 链接 ---
		api.GET("/web-links", webLink.GetWebLinks)
		api.POST("/web-links", webLink.CreateWebLink)
		api.DELETE("/web-links/:id", webLink.DeleteWebLink)
		api.PUT("/web-links/update", webLink.UpdateWebLink)


		// --- System 系统设置 ---
		api.GET("/system/status", system.GetStatus)
		api.GET("/system/settings", system.GetSettings)  
		api.PUT("/system/settings", system.UpdateSettings)
	}

	return r
}
