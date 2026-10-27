package middleware

import (
	"crypto/subtle"

	"github.com/gin-gonic/gin"
)

// BasicAuth 返回一个中间件，用于强制执行 HTTP 基本认证。
// 如果用户名和密码都不为空，则每个请求都必须包含有效的基本认证头。
// 如果用户名或密码为空，则中间件将作为无操作（认证已禁用）处理。
func BasicAuth(username, password string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if username == "" || password == "" {
			c.Next()
			return
		}

		user, pass, hasAuth := c.Request.BasicAuth()
		if !hasAuth ||
			subtle.ConstantTimeCompare([]byte(user), []byte(username)) != 1 ||
			subtle.ConstantTimeCompare([]byte(pass), []byte(password)) != 1 {
			c.Header("WWW-Authenticate", `Basic realm="Restricted"`)
			c.AbortWithStatus(401)
			return
		}

		c.Next()
	}
}
