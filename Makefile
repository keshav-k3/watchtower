.PHONY: install up down restart status logs bundle test build icons help

PID_FILE := .watchtower-dev.pid
LOG_FILE := .watchtower-dev.log
READY_TIMEOUT := 180

help:
	@printf "Available targets:\n"
	@printf "  make install  Install dependencies\n"
	@printf "  make up       Start Watchtower in the background\n"
	@printf "  make down     Stop the background Watchtower process\n"
	@printf "  make restart  Restart the background Watchtower process\n"
	@printf "  make status   Show whether Watchtower is running\n"
	@printf "  make logs     Tail the Watchtower dev log\n"
	@printf "  make icons    Regenerate app icons from assets/watchtower-icon.svg\n"
	@printf "  make bundle   Rebuild bundled plugins\n"
	@printf "  make test     Run tests\n"
	@printf "  make build    Run the production build\n"

install:
	bun install

icons:
	bun run tauri icon assets/watchtower-icon.svg -o src-tauri/icons
	git checkout HEAD -- src-tauri/icons/tray-icon.png

up:
	@if pgrep -x watchtower >/dev/null 2>&1; then \
		echo "Watchtower is already running."; \
		exit 0; \
	fi
	@$(MAKE) down >/dev/null 2>&1 || true
	@rm -f "$(PID_FILE)"
	@: >"$(LOG_FILE)"
	@nohup bun run tauri dev >>"$(LOG_FILE)" 2>&1 & echo $$! >"$(PID_FILE)"
	@echo "Starting Watchtower (PID $$(cat "$(PID_FILE)"))..."
	@i=0; \
	while [ $$i -lt $(READY_TIMEOUT) ]; do \
		if pgrep -x watchtower >/dev/null 2>&1 && lsof -ti:1420 >/dev/null 2>&1; then \
			echo "Watchtower is ready in the menu bar."; \
			echo "Logs: $(LOG_FILE)"; \
			exit 0; \
		fi; \
		if ! kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
			echo "Watchtower failed to start. Recent log output:"; \
			tail -30 "$(LOG_FILE)"; \
			rm -f "$(PID_FILE)"; \
			exit 1; \
		fi; \
		if grep -Eq "error: could not compile|Error The \"beforeDevCommand\"|Port 1420 is already in use|proc macro panicked" "$(LOG_FILE)" 2>/dev/null \
			&& ! pgrep -x watchtower >/dev/null 2>&1 \
			&& ! pgrep -f "cargo (run|build)" >/dev/null 2>&1 \
			&& ! pgrep -f "bun run tauri dev" >/dev/null 2>&1; then \
			echo "Watchtower failed to start. Recent log output:"; \
			tail -30 "$(LOG_FILE)"; \
			$(MAKE) down >/dev/null 2>&1 || true; \
			exit 1; \
		fi; \
		i=$$((i + 2)); \
		sleep 2; \
	done; \
	echo "Watchtower is still starting (first compile can take a few minutes)."; \
	echo "Check progress with: make logs"; \
	echo "Logs: $(LOG_FILE)"

down:
	@if [ -f "$(PID_FILE)" ]; then \
		pid="$$(cat "$(PID_FILE)")"; \
		if kill -0 "$$pid" 2>/dev/null; then \
			kill "$$pid" 2>/dev/null || true; \
		fi; \
		rm -f "$(PID_FILE)"; \
	fi
	@pkill -x watchtower 2>/dev/null || true
	@pkill -f "node.*tauri dev" 2>/dev/null || true
	@pkill -f "bun run tauri dev" 2>/dev/null || true
	@lsof -ti:1420 2>/dev/null | xargs kill -9 2>/dev/null || true
	@echo "Stopped Watchtower dev processes"

restart:
	@$(MAKE) down
	@$(MAKE) up

status:
	@if pgrep -x watchtower >/dev/null 2>&1; then \
		echo "Watchtower is running (menu bar app active)"; \
	elif [ -f "$(PID_FILE)" ] && kill -0 "$$(cat "$(PID_FILE)")" 2>/dev/null; then \
		echo "Watchtower is starting (PID $$(cat "$(PID_FILE)"))"; \
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
