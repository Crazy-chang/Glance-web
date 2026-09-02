.PHONY: dev dev-frontend dev-backend build run docker-up docker-down clean

# 本地开发（同时启动前后端）
dev:
	@echo "Starting backend and frontend..."
	@make dev-backend & make dev-frontend

dev-backend:
	cd cmd/server && go run .

dev-frontend:
	cd web && npm run dev

# 构建前端
build-frontend:
	cd web && npm run build

# 构建后端
build-backend:
	go build -o bin/server ./cmd/server

# 构建全部
build: build-frontend build-backend

# Docker
docker-up:
	docker-compose up -d --build

docker-down:
	docker-compose down

# 清理
clean:
	rm -rf bin/ web/dist data/*.db

# Go 依赖
tidy:
	go mod tidy
