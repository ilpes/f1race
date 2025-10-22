help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

client.dev:
	@docker compose run --rm -p 5173:5173 node bash -c "cd client && yarn dev"

client.watch: ## Watch client
	@docker compose run --rm node bash -c "cd client && yarn watch"

client.build: ## Build client
	@docker compose run --rm node bash -c "cd client && yarn build"

server.dev: ## Start development server
	@docker compose run --rm -p 3000:3000 node bash -c "cd server && yarn dev"

server.build: ## Build server
	@docker compose run --rm -p 3000:3000 node bash -c "cd server && yarn serve"

ssh: ## SSH into running web container
	@docker compose run --rm node bash
