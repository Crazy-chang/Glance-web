package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"glance/internal/models"
)

// struct 里只放一个 db 字段，就是数据库连接，
// 所有方法都通过 h.db 操作数据库（依赖注入思想：handler 不自己建连接，外面传进来）
type WebLinkHandler struct {
	db *gorm.DB
}

// NewWebLinkHandler 构造函数：创建 handler 实例，把数据库连接塞进去。
// 在 router.go 里会调用它一次：handlers.NewWebLinkHandler(db)
func NewWebLinkHandler(db *gorm.DB) *WebLinkHandler {
	return &WebLinkHandler{db: db}
}

// 获取所有Web链接
func (h *WebLinkHandler) GetWebLinks(c *gin.Context) {
	// models.WebLink 是数据库模型，用于表示 Web 链接
	// GORM 能从 links「目标变量」推断表名时，Model() 可以省
	var links []models.WebLink 
	// h.db.Model(&models.WebLink{}) —— 告诉 GORM 要查哪张表（web_links）；这一句就不用写了直接Find() 就行
	// Find() 是 GORM 提供的方法，用于查询所有记录
	if err := h.db.Order("created_at DESC").Find(&links).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch web links")
		return
	}

	// 返回 JSON 响应
	success(c, links)
}

// 创建Web链接
func (h *WebLinkHandler) CreateWebLink(c *gin.Context) { 
	var body models.WebLink
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	// 业务校验：名称必填（去掉首尾空格后为空就算没填）
	// strings.TrimSpace(" abc ") = "abc"
	if strings.TrimSpace(body.Title) == "" {
		failed(c, http.StatusBadRequest, "title is required")
		return
	}

	if strings.TrimSpace(body.Link) == "" {
		failed(c, http.StatusBadRequest, "link is required")
		return
	}

	// 业务校验：URL 要以 http:// 或 https:// 开头（防止存脏数据）
	// strings.HasPrefix("https://a.com", "http") = true
	if !strings.HasPrefix(body.Link, "http://") && !strings.HasPrefix(body.Link, "https://") {
		failed(c, http.StatusBadRequest, "link must start with http:// or https://")
		return
	}

	link := models.WebLink{
		Title: body.Title,
		Link:  body.Link,
		Description: body.Description,
	}

	if err := h.db.Create(&link).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to create web link")
		return
	}

	success(c, link)
}

// 删除Web链接
func (h *WebLinkHandler) DeleteWebLink(c *gin.Context) {
	id := c.Param("id")

	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	// 先查一下这条记录存不存在
	// First(&link, id) 对应 SQL：SELECT * FROM web_links WHERE id = 3 LIMIT 1;
	// 找不到时 err 不为 nil（gorm.ErrRecordNotFound）
	var link models.WebLink
	if err := h.db.First(&link, id).Error; err != nil {
		failed(c, http.StatusNotFound, "web link not found")
		return
	}

	// 执行删除。对应 SQL：DELETE FROM web_links WHERE id = 3;
	// &models.WebLink{} 告诉 GORM 删哪张表，id 作为条件
	if err := h.db.Delete(&models.WebLink{}, id).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to delete web link")
		return
	}

	// 返回被删的 ID，前端拿它从列表里移除对应项
	success(c, gin.H{"id": id})
}

// 更新Web链接
func (h *WebLinkHandler) UpdateWebLink(c *gin.Context) {
	// 获取更新的body数据（前端约定：id 也放在请求体里）
	var body models.WebLink
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	// 业务校验：和 Create 保持一致，防止把好数据改坏
	// uint 的零值是 0，等于 0 就说明前端没传 id
	if body.ID == 0 {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	if strings.TrimSpace(body.Title) == "" {
		failed(c, http.StatusBadRequest, "title is required")
		return
	}

	if strings.TrimSpace(body.Link) == "" {
		failed(c, http.StatusBadRequest, "link is required")
		return
	}

	if !strings.HasPrefix(body.Link, "http://") && !strings.HasPrefix(body.Link, "https://") {
		failed(c, http.StatusBadRequest, "link must start with http:// or https://")
		return
	}

	// 先查记录是否存在（和 Delete 的写法保持一致）
	// 不存在直接 404，避免对不存在的 id 执行一次"空更新"
	var link models.WebLink
	if err := h.db.First(&link, body.ID).Error; err != nil {
		failed(c, http.StatusNotFound, "web link not found")
		return
	}

	// Updates 用 map 而不是 struct：
	// struct 版本会跳过零值字段——把描述清空成 "" 时，数据库里的老描述还留着；
	// map 版本空字符串也会原样写入，"清空描述"才能真正生效
	// 对应 SQL：UPDATE web_links SET title=?, link=?, description=? WHERE id=?;
	if err := h.db.Model(&models.WebLink{}).Where("id = ?", body.ID).Updates(map[string]interface{}{
		"title":       body.Title,
		"link":        body.Link,
		"description": body.Description,
	}).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update web link")
		return
	}

	success(c, gin.H{"msg": "success"})
}