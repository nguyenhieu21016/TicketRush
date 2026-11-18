.PHONY: dev dev-down prod prod-down logs seed clean

# --- MÔI TRƯỜNG LOCAL (DEV) ---
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# --- MÔI TRƯỜNG CLOUD EC2 (PROD) ---
prod:
	docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# --- TIỆN ÍCH VẬN HÀNH ---
logs:
	docker compose logs -f --tail=100

seed:
	docker compose exec backend python seed_admin.py

clean:
	docker system prune -f