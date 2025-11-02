.PHONY: fmt lint typecheck unit build

fmt:
	npm run fmt

lint:
	npm run lint

typecheck:
	npx tsc --noEmit

unit:
	npm run unit

build:
	npm run build
