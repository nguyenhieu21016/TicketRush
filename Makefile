.PHONY: dev dev-down prod prod-down prod-logs prod-seed logs seed clean

# --- MÔI TRƯỜNG LOCAL (DEV) ---
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# --- MÔI TRƯỜNG CLOUD EC2 (PROD: dùng RDS & ElastiCache Redis) ---
prod:
	docker compose --env-file backend/.env -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f --tail=100

prod-seed:
	docker compose -f docker-compose.prod.yml exec backend python seed_admin.py

# --- TIỆN ÍCH VẬN HÀNH (LOCAL) ---
logs:
	docker compose logs -f --tail=100

seed:
	docker compose exec backend python seed_admin.py

clean:
	docker system prune -f
