import { type FSWatcher, watch, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { useEffect, useRef } from 'react'
import { logForDebugging } from '../utils/debug.js'
import { enqueue, getCommandQueue } from '../utils/messageQueueManager.js'

const WAKEUP_FILE = join(process.env.TEMP || '/tmp', 'agentchat-wakeup.json')
const DEBOUNCE_MS = 500

/**
 * Hook that watches for AgentChat wake-up signals.
 *
 * The AgentChat daemon writes to a JSON file when a new message arrives.
 * This hook detects the change via fs.watch and enqueues "leia a mensagem"
 * as user input, waking the agent from idle state.
 *
 * Flow: daemon receives WS message → writes wakeup file → this hook
 * detects → enqueue() → REPL processes as user input → hook fires →
 * agent sees message and reacts.
 */
export function useAgentChatWatcher({
  isLoading,
}: {
  isLoading: boolean
}): void {
  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Ensure the wakeup file exists
    try {
      if (!existsSync(WAKEUP_FILE)) {
        writeFileSync(WAKEUP_FILE, JSON.stringify({ wake: false }))
      }
    } catch {}

    let watcher: FSWatcher | null = null

    const handleWakeup = (): void => {
      // Dedup: skip if there's already a wake prompt in the queue
      const queue = getCommandQueue()
      if (queue.some(cmd => typeof cmd.value === 'string' && cmd.value.includes('digitando...'))) {
        logForDebugging('[AgentChatWatcher] Wake already queued, skipping')
        return
      }

      // Read and validate the wakeup signal
      try {
        const data = JSON.parse(readFileSync(WAKEUP_FILE, 'utf8'))
        if (!data.wake) return

        const from = data.from || 'unknown'
        logForDebugging(
          `[AgentChatWatcher] Wake signal received from ${from}`,
        )

        // Clear the signal immediately to avoid re-processing
        writeFileSync(WAKEUP_FILE, JSON.stringify({ wake: false }))

        // Build wake text with sender name (e.g. "Home digitando...")
        const FRIENDLY_NAMES: Record<string, string> = {
          'agent-home': 'Home',
          'agent-work': 'Work',
        }
        const friendly = FRIENDLY_NAMES[from] || from
        enqueue({ value: `${friendly} digitando...`, mode: 'prompt' })
      } catch {
        // File doesn't exist or invalid JSON — ignore
      }
    }

    const debouncedCheck = (): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(handleWakeup, DEBOUNCE_MS)
    }

    try {
      watcher = watch(WAKEUP_FILE, debouncedCheck)
      watcher.unref()
      logForDebugging(
        `[AgentChatWatcher] Watching ${WAKEUP_FILE} for wake signals`,
      )
    } catch (error) {
      logForDebugging(
        `[AgentChatWatcher] Failed to watch ${WAKEUP_FILE}: ${error}`,
      )
    }

    return () => {
      if (watcher) watcher.close()
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  // When agent goes idle, check for pending wake signals
  useEffect(() => {
    if (isLoading) return
    try {
      const data = JSON.parse(readFileSync(WAKEUP_FILE, 'utf8'))
      if (data.wake) {
        const from = data.from || 'unknown'
        logForDebugging('[AgentChatWatcher] Pending wake signal found on idle')
        writeFileSync(WAKEUP_FILE, JSON.stringify({ wake: false }))
        const FRIENDLY_NAMES: Record<string, string> = {
          'agent-home': 'Home',
          'agent-work': 'Work',
        }
        const friendly = FRIENDLY_NAMES[from] || from
        enqueue({ value: `${friendly} digitando...`, mode: 'prompt' })
      }
    } catch {}
  }, [isLoading])
}
