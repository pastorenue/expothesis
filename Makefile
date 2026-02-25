.PHONY: up up-ai down build restart logs status test test-backend test-frontend lint lint-backend lint-frontend typecheck typecheck-backend typecheck-frontend psql chsql psql-shell chsql-shell

up:
	docker-compose up -d --build

up-ai:
	docker-compose --profile ai up -d --build

down:
	docker-compose down

build:
	docker-compose build

restart:
	docker-compose down
	docker-compose --profile ai up -d --build

logs:
	docker-compose logs -f --tail=200

status:
	docker-compose ps

test:
	$(MAKE) test-backend
	$(MAKE) test-frontend

test-backend:
	docker-compose run --rm backend cargo test

test-frontend:
	docker-compose run --rm frontend npm run test --if-present

lint:
	$(MAKE) lint-backend
	$(MAKE) lint-frontend

lint-backend:
	docker-compose run --rm backend cargo fmt -- --check

lint-frontend:
	docker-compose run --rm frontend sh -c "npm install --no-package-lock && npm run lint"

typecheck:
	$(MAKE) typecheck-backend
	$(MAKE) typecheck-frontend

typecheck-backend:
	docker-compose run --rm backend cargo check

typecheck-frontend:
	docker-compose run --rm frontend sh -c "npm install --no-package-lock && npm run typecheck"

psql:
	@docker-compose exec -T postgres psql -U expothesis -d expothesis -c "$(QUERY)"

chsql:
	@docker-compose exec -T clickhouse clickhouse-client --query "$(QUERY)"

psql-shell:
	@docker-compose exec postgres psql -U expothesis -d expothesis

chsql-shell:
	@docker-compose exec clickhouse clickhouse-client
