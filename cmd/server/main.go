// Package main 是应用程序的入口点.
// 它加载配置，初始化数据库和建表，启动调度器，注册路由，并提供带有优雅关闭的HTTP服务。
package main

import (
	// 标准库（Go 语言自带的库，不需要额外安装）
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	// 三方库（从 GitHub，go.mod里下载的库，需要提前安装的库）
	"github.com/joho/godotenv"
	// 项目内部包
	"glance/internal/config"
	"glance/internal/database"
	"glance/internal/router"
	"glance/internal/scheduler"
)

func main() {
	// --- 加载 .env 文件（如果不存在则忽略错误；环境变量优先）---
	_ = godotenv.Load()

	// --- 加载配置 ---
	cfg := config.Load()
	log.Printf("[main] config loaded: port=%d, ginMode=%s, dbPath=%s",
		cfg.Port, cfg.GinMode, cfg.DBPath)

	// --- 初始化数据库连接（连数据库 + 自动建表） ---
	db, err := database.Init(cfg.DBPath)
	if err != nil {
		log.Fatalf("[main] failed to initialize database: %v", err)
	}
	log.Println("[main] database initialized successfully")

	// --- 确保数据库连接在退出时关闭 ---
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("[main] failed to get underlying sql.DB: %v", err)
	}
	defer func() { // defer = 函数返回前执行，不管正常还是 panic 都会执行
		if err := sqlDB.Close(); err != nil {
			log.Printf("[main] error closing database: %v", err)
		}
	}()

	// --- 启动调度器（定时任务）（代码是RSS 刷新） ---
	sched := scheduler.New(db) // 创建调度器，传入数据库连接
	sched.Start() // 启动调度器

	//（go 关键字 = 开新协程，异步执行不阻塞）
	go sched.TriggerInitialFetch() // 启动时触发一次初始化任务，立刻抓取一次 

	// --- 设置路由配置 --- 把所有路由绑定到 Gin 引擎
	r := router.SetupRouter(cfg, db)

	// --- 启动 HTTP 服务器 ---
	//  创建 handler 实例 → 注册所有 GET/POST/PUT/DELETE 路由
	srv := &http.Server{ // 创建原生 http.Server（Go 标准库的，不是 Gin 的）
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: r,
	}

	//  新协程启动 HTTP 服务（不阻塞主线程，这样才能继续监听关闭信号）
	go func() {
		log.Printf("[main] server starting on port %d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[main] server failed: %v", err)
		}
	}()

	// --- 优雅关闭 ---
	quit := make(chan os.Signal, 1) // 创建一个channel通道，用于接收关闭信号。类比前端：类似 EventEmitter，等一个事件通知
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[main] shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("[main] server shutdown error: %v", err)
	}

	// --- 停止调度器（定时任务） ---
	sched.Stop()

	log.Println("[main] server exited")
}
