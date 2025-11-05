.PHONY: fmt lint typecheck unit build checks start

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

start:
	npm run dev

checks: fmt lint typecheck unit
