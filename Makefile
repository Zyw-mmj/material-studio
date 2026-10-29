.PHONY: help up down db logs check frontend-check backend-check
help:
	@echo "up              check configuration/database credentials, build and start services"
	@echo "db              start MySQL for native development"
	@echo "check           run frontend checks and Java tests/build (Docker required)"
	@echo "down            stop services and preserve volumes"
	@echo "logs            follow service logs"
up:
	bash scripts/up.sh
down:
	docker compose down
db:
	bash scripts/up.sh --mysql-only
logs:
	docker compose logs -f
frontend-check:
	cd frontend && npm run lint && npm run typecheck && npm run test:run && npm run build
backend-check:
	cd backend && ./mvnw -B -ntp verify
check: frontend-check backend-check
