package models

import "time"

type WebLink struct {
	ID uint `json:"id" gorm:"primaryKey"`
	Link string `json:"link" gorm:"not null"`
	Title string `json:"title" gorm:"not null"`
	Description string `json:"description"` 	// 描述非必填
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}