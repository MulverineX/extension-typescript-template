DIST_DIR := dist

all: build pack

build:
	@bun install
	@bun run build

opt:
	@wasm-opt -Oz $(DIST_DIR)/ext.wasm -o $(DIST_DIR)/ext.wasm

pack:
	@mopack --path .

test: build copy
	bun run test
