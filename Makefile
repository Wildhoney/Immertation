.PHONY: fmt lint typecheck unit build checks start dev deploy integration

fmt:
	pnpm run fmt

lint:
	pnpm run lint

typecheck:
	npx tsc --noEmit

unit:
	pnpm run unit

integration:
	pnpm run integration

build:
	pnpm run build

start:
	pnpm run dev

dev:
	pnpm run dev

checks: fmt lint typecheck unit integration

deploy:
	yarn --force
	make build
	npx commit-and-tag-version
	npm publish
	git push
	git push --tags
