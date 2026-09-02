// Package handlers contains all HTTP handler implementations.
// Each handler reads from or writes to the database via GORM and
// returns a unified JSON response format.
package handlers

import "github.com/gin-gonic/gin"

// success sends a successful JSON response with the unified format:
// {"code": 0, "message": "ok", "data": ...}
func success(c *gin.Context, data interface{}) {
	c.JSON(200, gin.H{
		"code":    0,
		"message": "ok",
		"data":    data,
	})
}

// failed sends an error JSON response with the given HTTP status code.
// The response body follows the unified format:
// {"code": <httpCode>, "message": "<message>", "data": null}
func failed(c *gin.Context, code int, message string) {
	c.JSON(code, gin.H{
		"code":    code,
		"message": message,
		"data":    nil,
	})
}
