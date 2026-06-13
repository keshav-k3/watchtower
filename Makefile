.PHONY: install up down restart status logs bundle test build help

PID_FILE := .watchtower-dev.pid
LOG_FILE := .watchtower-dev.log

help:
	@printf "Available targets:\n"
	@printf "  make install  Install dependencies\n"
	@printf "  make up       Start Watchtower in the background\n"
	@printf "  make down     Stop the background Watchtower process\n"
	@printf "  make restart  Restart the background Watchtower process\n"
	@printf "  make status   Show whether Watchtower is running\n"
	@printf "  make logs     Tail the Watchtower dev log\n"
	@printf "  make bundle   Rebuild bundled plugins\n"
	@printf "  make test     Run tests\n"
	@printf "  make build    Run the production build\n"

install:
	bun install

up:
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "Watchtower is already running with PID $$(cat "$(PID_FILE)")"; \
	else \
		rm -f "$(PID_FILE)"; \
		touch "$(LOG_FILE)"; \
		nohup bun run tauri dev >>"$(LOG_FILE)" 2>&1 & \
		echo $$! >"$(PID_FILE)"; \
		echo "Watchtower started with PID $$(cat "$(PID_FILE)")"; \
		echo "Logs: $(LOG_FILE)"; \
	fi

down:
	@if [ -f "$(PID_FILE)" ]; then \
		pid="$$(cat "$(PID_FILE)")"; \
		if kill -0 "$$pid" 2>/dev/null; then \
			kill "$$pid"; \
			echo "Stopped Watchtower (PID $$pid)"; \
		else \
			echo "Watchtower was not running, cleaning up stale PID file"; \
		fi; \
		rm -f "$(PID_FILE)"; \
	else \
		echo "Watchtower is not running"; \
	fi

restart:
	@$(MAKE) down
	@$(MAKE) up

status:
	@if [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "Watchtower is running with PID $$(cat "$(PID_FILE)")"; \
	else \
		echo "Watchtower is not running"; \
	fi

logs:
	@touch "$(LOG_FILE)"
	tail -f "$(LOG_FILE)"

bundle:
	bun run bundle:plugins

test:
	bun run test

build:
	bun run build
