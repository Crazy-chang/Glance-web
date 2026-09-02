package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"glance/internal/models"
)

// MarketRecordHandler 行情记录 CRUD（含情绪温度、复盘笔记）。
type MarketRecordHandler struct {
	db *gorm.DB
}

func NewMarketRecordHandler(db *gorm.DB) *MarketRecordHandler {
	return &MarketRecordHandler{db: db}
}

// 详细接口与数据库交互操作说明
//-- 没传 date 参数时：
// SELECT * FROM market_records ORDER BY date DESC;

// -- 传了 date 参数时：
// SELECT * FROM market_records WHERE date = '2026-08-21' ORDER BY date DESC;

// GetRecords 返回行情记录列表，支持按日期搜索。
// GET /api/market/records?date=2026-08-21
// c *gin.Context 就是请求对象
func (h *MarketRecordHandler) GetRecords(c *gin.Context) {
	// 1 声明一个变量，类型是 []models.MarketRecord（MarketRecord 的切片数组）
  //    用来装数据库查出来的结果
	var records []models.MarketRecord
	// 2. 构造数据库查询条件 Order("date DESC") = SQL 的 ORDER BY date DESC
	query := h.db.Order("date DESC")  
	if date := c.Query("date"); date != "" {  //  取前端url上的date参数
    //   query.Where("date = ?", date) = SQL 的 WHERE date = '2026-08-21'
		//    ? 是占位符，GORM 自动防 SQL 注入（不会拼字符串）
		query = query.Where("date = ?", date) //   给查询数据库追加 WHERE 条件
	}

	// 真正执行查询的4种方法（Find/Create/Save/Delete）（GORM 提供的方法，用于执行数据库操作）
	//  Find(&records) = 执行 SELECT * FROM market_records ORDER BY date DESC
  //  &records = 把查询结果填充到 records 变量里（传指针让函数内部能修改它）
  //  .Error = GORM 查询结果对象上的错误字段，nil 表示成功
	if err := query.Find(&records).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to fetch market records")
		return
	}

	// 查询成功 返回 JSON 给前端
	success(c, records)
}

// CreateRecord 创建行情记录。
// POST /api/market/records
func (h *MarketRecordHandler) CreateRecord(c *gin.Context) {
	var record models.MarketRecord
	// 1. ShouldBindJSON 是从请求体中解析 JSON 数据赋值给 record 变量里
	if err := c.ShouldBindJSON(&record); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if record.Date == "" {
		failed(c, http.StatusBadRequest, "date is required")
		return
	}

	if err := h.db.Create(&record).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to create market record")
		return
	}

	success(c, record)
}

// UpdateRecord 更新行情记录。
// PUT /api/market/records/:id
func (h *MarketRecordHandler) UpdateRecord(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	var record models.MarketRecord
	if err := h.db.First(&record, id).Error; err != nil {
		failed(c, http.StatusNotFound, "market record not found")
		return
	}

	if err := c.ShouldBindJSON(&record); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.db.Save(&record).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to update market record")
		return
	}

	success(c, record)
}

// DeleteRecord 删除行情记录。
// DELETE /api/market/records/:id
func (h *MarketRecordHandler) DeleteRecord(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		failed(c, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.db.Delete(&models.MarketRecord{}, id).Error; err != nil {
		failed(c, http.StatusInternalServerError, "failed to delete market record")
		return
	}

	success(c, gin.H{"id": id})
}
