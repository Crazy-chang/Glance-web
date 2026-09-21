package handlers

import (
	"errors"
	"net/http"
	"strings"

	"glance/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NoteHandler struct {
	db *gorm.DB
}

func NewNoteHandler(db *gorm.DB) *NoteHandler {
	return &NoteHandler{db: db}
}

// CreateNote 创建便签.
// POST /api/notes  body: {"content": "..."}
func (h *NoteHandler) CreateNote(c *gin.Context) {
	var body struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	content := strings.TrimSpace(body.Content)
	if content == "" {
		failed(c, http.StatusBadRequest, "content is required")
		return
	}

	note := models.Note{
		Content: content,
	}

	if err := h.db.Create(&note).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to create note")
		return
	}

	success(c, note)
}

// GetNotes 获取全部便签，置顶在前，其余按更新时间倒序.
// GET /api/notes
func (h *NoteHandler) GetNotes(c *gin.Context) {
	var notes []models.Note

	if err := h.db.Order("pinned DESC, updated_at DESC").Find(&notes).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch notes")
		return
	}

	success(c, notes)
}

// UpdateNote 更新便签内容或置顶状态（支持部分更新）.
// PUT /api/notes/:id  body: {"content": "..."} 或 {"pinned": true}
func (h *NoteHandler) UpdateNote(c *gin.Context) {
	id := c.Param("id")

	// Pinned 用 *bool 指针：区分"没传该字段"（nil）和"传了 false"
	var body struct {
		Content string `json:"content"`
		Pinned  *bool  `json:"pinned"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	content := strings.TrimSpace(body.Content)
	if content == "" && body.Pinned == nil {
		failed(c, http.StatusBadRequest, "nothing to update")
		return
	}

	var note models.Note
	if err := h.db.First(&note, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			failed(c, http.StatusNotFound, "note not found")
			return
		}
		failed(c, http.StatusInternalServerError, "failed to fetch note")
		return
	}

	if content != "" {
		note.Content = content
	}
	if body.Pinned != nil {
		note.Pinned = *body.Pinned
	}

	// Save 会整行更新，UpdatedAt 由 autoUpdateTime 自动刷新
	if err := h.db.Save(&note).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update note")
		return
	}

	success(c, note)
}

// DeleteNote 删除便签.
// DELETE /api/notes/:id
func (h *NoteHandler) DeleteNote(c *gin.Context) {
	id := c.Param("id")

	// RowsAffected 为 0 说明 id 不存在（删除不存在的 id 不会报错）
	result := h.db.Delete(&models.Note{}, id)
	if result.Error != nil {
		failed(c, http.StatusInternalServerError, "failed to delete note")
		return
	}
	if result.RowsAffected == 0 {
		failed(c, http.StatusNotFound, "note not found")
		return
	}

	success(c, gin.H{"id": id})
}
