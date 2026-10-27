package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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
	if date := c.Query("date"); date != "" { //  取前端url上的date参数
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

// BatchSaveRecords 批量导入行情记录（按 date 做 upsert：已存在则覆盖，不存在则新增）。
// POST /api/market/records/batch
// 请求体为 MarketRecord JSON 数组，前端导入弹窗中用户确认勾选后的数据一次性提交到这里。
func (h *MarketRecordHandler) BatchSaveRecords(c *gin.Context) {
	var records []models.MarketRecord
	if err := c.ShouldBindJSON(&records); err != nil {
		failed(c, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(records) == 0 {
		failed(c, http.StatusBadRequest, "records is empty")
		return
	}

	// 校验并清掉客户端可能携带的 id，避免干扰 upsert
	for i := range records {
		if records[i].Date == "" {
			failed(c, http.StatusBadRequest, "date is required")
			return
		}
		records[i].ID = 0
	}

	// date 冲突时更新除 id/created_at 之外的全部业务字段
	updateCols := []string{
		"index_value", "index_change", "amount", "volume_change",
		"up_count", "down_count", "limit_up", "limit_down", "broken_rate",
		"first_board", "second_board", "third_board", "multi_board",
		"sentiment", "review", "tomorrow_plan", "remark", "updated_at",
	}

	// 事务内单条 INSERT ... ON CONFLICT DO UPDATE，SQLite 支持多行 values
	err := h.db.Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "date"}},
			DoUpdates: clause.AssignmentColumns(updateCols),
		}).Create(&records).Error
	})
	if err != nil {
		log.Printf("[market] batch save failed: %v", err)
		failed(c, http.StatusInternalServerError, "failed to batch save market records")
		return
	}

	log.Printf("[market] batch saved %d records", len(records))
	success(c, gin.H{"count": len(records)})
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
