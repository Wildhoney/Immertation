.PHONY: fmt lint typecheck unit build checks start deploy

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

deploy:
	yarn --force
	make build
	npx commit-and-tag-version
	npm publish
	git push
	git push --tags
