package models

import "time"

// MarketRecord 每日行情记录（含情绪温度、复盘笔记）。
// 每个交易日一条记录，包含大盘数据、连板统计、情绪温度和复盘内容。
// json:"date" tag: 返回前端时字段名是 date
type MarketRecord struct {
	ID           uint      `json:"id" gorm:"primaryKey"` // ← gorm tag: 告诉数据库这是主键
	Date         string    `json:"date" gorm:"uniqueIndex"` // 日期 YYYY-MM-DD    gorm tag: 建唯一索引
	IndexValue   float64   `json:"indexValue"`              // 指数点位   
	IndexChange  float64   `json:"indexChange"`              // 指数涨跌（%）
	Amount       float64   `json:"amount"`                  // 成交额（亿）
	VolumeChange string    `json:"volumeChange"`            // 缩/放量描述
	UpCount      int       `json:"upCount"`                 // 上涨数
	DownCount    int       `json:"downCount"`               // 下跌数
	LimitUp      int       `json:"limitUp"`                 // 涨停数
	LimitDown    int       `json:"limitDown"`               // 跌停数
	BrokenRate   float64   `json:"brokenRate"`              // 炸板率（%）
	FirstBoard   int       `json:"firstBoard"`              // 一板数
	SecondBoard  int       `json:"secondBoard"`             // 二板数
	ThirdBoard   int       `json:"thirdBoard"`              // 三板数
	MultiBoard   int       `json:"multiBoard"`              // 高度板数（三板以上）
	Sentiment    int       `json:"sentiment"`               // 情绪温度 0-100（100=过热，0=冰点）
	Review       string    `json:"review"`                  // 当天复盘
	TomorrowPlan string    `json:"tomorrowPlan"`            // 第二天操作记录
	Remark       string    `json:"remark"`                  // 备注
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}
