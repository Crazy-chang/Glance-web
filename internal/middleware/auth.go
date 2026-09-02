package middleware

import (
	"crypto/subtle"

	"github.com/gin-gonic/gin"
)

// BasicAuth returns a middleware that enforces HTTP Basic Authentication.
// If both username and password are non-empty, every request must include
// valid Basic Auth credentials. If either is empty, the middleware is
// effectively a no-op (authentication is disabled).
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
