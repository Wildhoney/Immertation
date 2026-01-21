.PHONY: fmt lint typecheck unit build size checks start dev deploy integration

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

size:
	pnpm run size

start:
	pnpm run dev

dev:
	pnpm run dev

checks: fmt lint typecheck unit build size integration

deploy:
	pnpm install
	make build
	npx commit-and-tag-version
	npm publish
	git push
	git push --tags
